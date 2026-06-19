import { PipelineLogAction, Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import { createPipelineLog } from '@/modules/pipeline-logs/pipeline-logs.service';
import type { CreateCardBody, UpdateCardBody, MoveCardBody, ListCardsQuery } from './cards.schemas';

export interface PublicCard {
  id: string;
  title: string;
  pipelineColumnId: string;
  value: string | null;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  position: number;
  organizationId: string;
  contactId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toPublicCard(deal: {
  id: string;
  title: string;
  pipelineColumnId: string;
  value: Prisma.Decimal | null;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  position: number;
  organizationId: string;
  contactId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicCard {
  return {
    id: deal.id,
    title: deal.title,
    pipelineColumnId: deal.pipelineColumnId,
    value: deal.value != null ? deal.value.toFixed(2) : null,
    companyName: deal.companyName,
    contactName: deal.contactName,
    email: deal.email,
    phone: deal.phone,
    notes: deal.notes,
    position: deal.position,
    organizationId: deal.organizationId,
    contactId: deal.contactId,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  };
}

async function assertMember(userId: string, organizationId: string): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
}

async function assertPipelineColumnForOrg(
  pipelineColumnId: string,
  organizationId: string
): Promise<{ id: string; title: string }> {
  const col = await prisma.pipelineColumn.findFirst({
    where: { id: pipelineColumnId, organizationId },
    select: {
      id: true,
      title: true,
    },
  });

  if (!col) {
    throw new AppError(400, 'INVALID_REFERENCE', 'Pipeline column not found for organization');
  }

  return col;
}

async function nextPositionForColumn(pipelineColumnId: string): Promise<number> {
  const agg = await prisma.deal.aggregate({
    where: { pipelineColumnId },
    _max: { position: true },
  });

  return (agg._max.position ?? -1) + 1;
}

export async function createCard(userId: string, input: CreateCardBody): Promise<PublicCard> {
  await assertMember(userId, input.organizationId);
  const column = await assertPipelineColumnForOrg(input.pipelineColumnId, input.organizationId);

  const nextPosition = await nextPositionForColumn(input.pipelineColumnId);

  try {
    const deal = await prisma.deal.create({
      data: {
        title: input.title,
        pipelineColumnId: input.pipelineColumnId,
        value: input.value != null ? new Prisma.Decimal(input.value.toString()) : null,
        companyName: input.companyName ?? null,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        position: nextPosition,
        organizationId: input.organizationId,
        contactId: input.contactId ?? null,
      },
    });

    await createPipelineLog({
      organizationId: deal.organizationId,
      userId,
      dealId: deal.id,
      action: PipelineLogAction.DEAL_CREATED,
      description: `Criou a negociação "${deal.title}" na coluna "${column.title}".`,
      toColumnId: column.id,
      toColumnName: column.title,
      metadata: {
        dealId: deal.id,
        title: deal.title,
        position: deal.position,
        value: deal.value != null ? deal.value.toFixed(2) : null,
      },
    });

    return toPublicCard(deal);
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new AppError(400, 'INVALID_REFERENCE', 'Referenced record not found');
    }

    throw e;
  }
}

export async function listCards(userId: string, query: ListCardsQuery): Promise<PublicCard[]> {
  await assertMember(userId, query.organizationId);

  const where: Prisma.DealWhereInput = { organizationId: query.organizationId };

  if (query.pipelineColumnId) {
    where.pipelineColumnId = query.pipelineColumnId;
  }

  const deals = await prisma.deal.findMany({
    where,
    orderBy: [{ pipelineColumnId: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
  });

  return deals.map(toPublicCard);
}

export async function getCard(userId: string, cardId: string): Promise<PublicCard> {
  const deal = await prisma.deal.findFirst({
    where: {
      id: cardId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
  });

  if (!deal) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  return toPublicCard(deal);
}

export async function updateCard(
  userId: string,
  cardId: string,
  input: UpdateCardBody
): Promise<PublicCard> {
  const deal = await prisma.deal.findFirst({
    where: {
      id: cardId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
    include: {
      pipelineColumn: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!deal) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  let newColumn: { id: string; title: string } | null = null;

  if (input.pipelineColumnId !== undefined) {
    newColumn = await assertPipelineColumnForOrg(input.pipelineColumnId, deal.organizationId);
  }

  const data: Prisma.DealUpdateInput = {};
  const changedFields: string[] = [];

  if (input.title !== undefined) {
    data.title = input.title;
    changedFields.push('title');
  }

  if (input.pipelineColumnId !== undefined) {
    data.pipelineColumn = { connect: { id: input.pipelineColumnId } };
    changedFields.push('pipelineColumnId');
  }

  if (input.value !== undefined) {
    data.value = input.value === null ? null : new Prisma.Decimal(String(input.value));
    changedFields.push('value');
  }

  if (input.companyName !== undefined) {
    data.companyName = input.companyName;
    changedFields.push('companyName');
  }

  if (input.contactName !== undefined) {
    data.contactName = input.contactName;
    changedFields.push('contactName');
  }

  if (input.email !== undefined) {
    data.email = input.email;
    changedFields.push('email');
  }

  if (input.phone !== undefined) {
    data.phone = input.phone;
    changedFields.push('phone');
  }

  if (input.notes !== undefined) {
    data.notes = input.notes;
    changedFields.push('notes');
  }

  if (input.contactId !== undefined) {
    data.contact =
      input.contactId != null ? { connect: { id: input.contactId } } : { disconnect: true };
    changedFields.push('contactId');
  }

  try {
    const updated = await prisma.deal.update({
      where: { id: cardId },
      data,
    });

    await createPipelineLog({
      organizationId: updated.organizationId,
      userId,
      dealId: updated.id,
      action: PipelineLogAction.DEAL_UPDATED,
      description: `Atualizou a negociação "${updated.title}".`,
      fromColumnId: deal.pipelineColumn.id,
      fromColumnName: deal.pipelineColumn.title,
      toColumnId: newColumn?.id ?? updated.pipelineColumnId,
      toColumnName: newColumn?.title ?? deal.pipelineColumn.title,
      previousValue: deal.title,
      newValue: updated.title,
      metadata: {
        dealId: updated.id,
        previousTitle: deal.title,
        newTitle: updated.title,
        changedFields,
      },
    });

    return toPublicCard(updated);
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
    }

    throw e;
  }
}

export async function moveCard(
  userId: string,
  cardId: string,
  input: MoveCardBody
): Promise<PublicCard> {
  const deal = await prisma.deal.findFirst({
    where: {
      id: cardId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
    include: {
      pipelineColumn: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!deal) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  const targetColumn = await assertPipelineColumnForOrg(
    input.pipelineColumnId,
    deal.organizationId
  );

  const sourceColumnId = deal.pipelineColumnId;
  const targetColumnId = input.pipelineColumnId;
  const sourcePos = deal.position;
  const sameColumn = sourceColumnId === targetColumnId;

  const targetCount = await prisma.deal.count({
    where: { pipelineColumnId: targetColumnId, NOT: { id: cardId } },
  });

  const requestedPos = input.position ?? targetCount;
  const targetPos = Math.max(0, Math.min(requestedPos, targetCount));

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (sameColumn) {
        if (sourcePos === targetPos) {
          return tx.deal.findUniqueOrThrow({ where: { id: cardId } });
        }

        if (targetPos < sourcePos) {
          await tx.deal.updateMany({
            where: {
              pipelineColumnId: targetColumnId,
              position: { gte: targetPos, lt: sourcePos },
              NOT: { id: cardId },
            },
            data: { position: { increment: 1 } },
          });
        } else {
          await tx.deal.updateMany({
            where: {
              pipelineColumnId: targetColumnId,
              position: { gt: sourcePos, lte: targetPos },
              NOT: { id: cardId },
            },
            data: { position: { decrement: 1 } },
          });
        }

        return tx.deal.update({
          where: { id: cardId },
          data: { position: targetPos },
        });
      }

      await tx.deal.updateMany({
        where: {
          pipelineColumnId: sourceColumnId,
          position: { gt: sourcePos },
        },
        data: { position: { decrement: 1 } },
      });

      await tx.deal.updateMany({
        where: {
          pipelineColumnId: targetColumnId,
          position: { gte: targetPos },
        },
        data: { position: { increment: 1 } },
      });

      return tx.deal.update({
        where: { id: cardId },
        data: {
          pipelineColumn: { connect: { id: targetColumnId } },
          position: targetPos,
        },
      });
    });

    if (!(sameColumn && sourcePos === targetPos)) {
      await createPipelineLog({
        organizationId: updated.organizationId,
        userId,
        dealId: updated.id,
        action: PipelineLogAction.DEAL_MOVED,
        description: `Moveu a negociação "${updated.title}" de "${deal.pipelineColumn.title}" para "${targetColumn.title}".`,
        fromColumnId: deal.pipelineColumn.id,
        toColumnId: targetColumn.id,
        fromColumnName: deal.pipelineColumn.title,
        toColumnName: targetColumn.title,
        previousValue: String(sourcePos),
        newValue: String(targetPos),
        metadata: {
          dealId: updated.id,
          title: updated.title,
          fromPosition: sourcePos,
          toPosition: targetPos,
          sameColumn,
        },
      });
    }

    return toPublicCard(updated);
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
    }

    throw e;
  }
}

export async function deleteCard(userId: string, cardId: string): Promise<void> {
  const deal = await prisma.deal.findFirst({
    where: {
      id: cardId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
    include: {
      pipelineColumn: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!deal) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  const deleted = await prisma.deal.deleteMany({
    where: {
      id: cardId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
  });

  if (deleted.count !== 1) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  await createPipelineLog({
    organizationId: deal.organizationId,
    userId,
    dealId: null,
    action: PipelineLogAction.DEAL_DELETED,
    description: `Excluiu a negociação "${deal.title}" da coluna "${deal.pipelineColumn.title}".`,
    fromColumnId: deal.pipelineColumn.id,
    fromColumnName: deal.pipelineColumn.title,
    previousValue: deal.title,
    metadata: {
      deletedDealId: deal.id,
      title: deal.title,
      position: deal.position,
      pipelineColumnId: deal.pipelineColumnId,
      pipelineColumnTitle: deal.pipelineColumn.title,
    },
  });
}
