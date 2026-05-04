import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
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
): Promise<void> {
  const col = await prisma.pipelineColumn.findFirst({
    where: { id: pipelineColumnId, organizationId },
  });
  if (!col) {
    throw new AppError(400, 'INVALID_REFERENCE', 'Pipeline column not found for organization');
  }
}

export async function createCard(userId: string, input: CreateCardBody): Promise<PublicCard> {
  await assertMember(userId, input.organizationId);
  await assertPipelineColumnForOrg(input.pipelineColumnId, input.organizationId);

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
        organizationId: input.organizationId,
        contactId: input.contactId ?? null,
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

  const deals = await prisma.deal.findMany({ where, orderBy: { createdAt: 'desc' } });
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
  });
  if (!deal) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  if (input.pipelineColumnId !== undefined) {
    await assertPipelineColumnForOrg(input.pipelineColumnId, deal.organizationId);
  }

  const data: Prisma.DealUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.pipelineColumnId !== undefined) {
    data.pipelineColumn = { connect: { id: input.pipelineColumnId } };
  }
  if (input.value !== undefined) {
    data.value = input.value === null ? null : new Prisma.Decimal(String(input.value));
  }
  if (input.companyName !== undefined) data.companyName = input.companyName;
  if (input.contactName !== undefined) data.contactName = input.contactName;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.contactId !== undefined)
    data.contact =
      input.contactId != null ? { connect: { id: input.contactId } } : { disconnect: true };

  try {
    const updated = await prisma.deal.update({ where: { id: cardId }, data });
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
  });
  if (!deal) {
    throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
  }

  await assertPipelineColumnForOrg(input.pipelineColumnId, deal.organizationId);

  try {
    const updated = await prisma.deal.update({
      where: { id: cardId },
      data: { pipelineColumn: { connect: { id: input.pipelineColumnId } } },
    });
    return toPublicCard(updated);
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
    }
    throw e;
  }
}

export async function deleteCard(userId: string, cardId: string): Promise<void> {
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
}
