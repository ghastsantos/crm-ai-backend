import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import type {
  CreatePipelineColumnBody,
  ListPipelineColumnsQuery,
  UpdatePipelineColumnBody,
} from './pipeline-columns.schemas';
import { MAX_PIPELINE_COLUMNS, MIN_PIPELINE_COLUMNS } from './pipeline-columns.defaults';

export interface PublicPipelineColumn {
  id: string;
  organizationId: string;
  title: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

function toPublic(col: {
  id: string;
  organizationId: string;
  title: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): PublicPipelineColumn {
  return {
    id: col.id,
    organizationId: col.organizationId,
    title: col.title,
    position: col.position,
    createdAt: col.createdAt,
    updatedAt: col.updatedAt,
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

export async function listPipelineColumns(
  userId: string,
  query: ListPipelineColumnsQuery
): Promise<PublicPipelineColumn[]> {
  await assertMember(userId, query.organizationId);
  const cols = await prisma.pipelineColumn.findMany({
    where: { organizationId: query.organizationId },
    orderBy: { position: 'asc' },
  });
  return cols.map(toPublic);
}

export async function createPipelineColumn(
  userId: string,
  input: CreatePipelineColumnBody
): Promise<PublicPipelineColumn> {
  await assertMember(userId, input.organizationId);
  const columnCount = await prisma.pipelineColumn.count({
    where: { organizationId: input.organizationId },
  });

  if (columnCount >= MAX_PIPELINE_COLUMNS) {
    throw new AppError(
      400,
      'PIPELINE_COLUMN_LIMIT_REACHED',
      `Pipeline can have at most ${MAX_PIPELINE_COLUMNS} columns`
    );
  }

  const maxAgg = await prisma.pipelineColumn.aggregate({
    where: { organizationId: input.organizationId },
    _max: { position: true },
  });
  const nextPosition = (maxAgg._max.position ?? -1) + 1;
  const col = await prisma.pipelineColumn.create({
    data: {
      organizationId: input.organizationId,
      title: input.title,
      position: nextPosition,
    },
  });
  return toPublic(col);
}

export async function updatePipelineColumn(
  userId: string,
  columnId: string,
  input: UpdatePipelineColumnBody
): Promise<PublicPipelineColumn> {
  const existing = await prisma.pipelineColumn.findUnique({ where: { id: columnId } });
  if (!existing) {
    throw new AppError(404, 'COLUMN_NOT_FOUND', 'Pipeline column not found');
  }
  await assertMember(userId, existing.organizationId);

  if (input.title !== undefined && input.position === undefined) {
    const col = await prisma.pipelineColumn.update({
      where: { id: columnId },
      data: { title: input.title },
    });
    return toPublic(col);
  }

  if (input.position !== undefined) {
    const cols = await prisma.pipelineColumn.findMany({
      where: { organizationId: existing.organizationId },
      orderBy: { position: 'asc' },
    });
    const idx = cols.findIndex((c) => c.id === columnId);
    if (idx === -1) {
      throw new AppError(404, 'COLUMN_NOT_FOUND', 'Pipeline column not found');
    }
    const without = cols.filter((c) => c.id !== columnId);
    const clamped = Math.min(Math.max(0, input.position), without.length);
    const reordered = [...without];
    reordered.splice(clamped, 0, existing);
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < reordered.length; i += 1) {
        await tx.pipelineColumn.update({
          where: { id: reordered[i].id },
          data: { position: 10_000 + i },
        });
      }
      for (let i = 0; i < reordered.length; i += 1) {
        const titlePatch =
          reordered[i].id === columnId && input.title !== undefined ? { title: input.title } : {};
        await tx.pipelineColumn.update({
          where: { id: reordered[i].id },
          data: { position: i, ...titlePatch },
        });
      }
    });
    const updated = await prisma.pipelineColumn.findUniqueOrThrow({ where: { id: columnId } });
    return toPublic(updated);
  }

  throw new AppError(400, 'VALIDATION_ERROR', 'No valid fields to update');
}

export async function deletePipelineColumn(
  userId: string,
  columnId: string,
  moveToColumnId?: string
): Promise<void> {
  const existing = await prisma.pipelineColumn.findUnique({ where: { id: columnId } });
  if (!existing) {
    throw new AppError(404, 'COLUMN_NOT_FOUND', 'Pipeline column not found');
  }
  await assertMember(userId, existing.organizationId);

  const columnCount = await prisma.pipelineColumn.count({
    where: { organizationId: existing.organizationId },
  });

  if (columnCount <= MIN_PIPELINE_COLUMNS) {
    throw new AppError(
      400,
      'PIPELINE_COLUMN_MINIMUM_REACHED',
      `Pipeline must keep at least ${MIN_PIPELINE_COLUMNS} columns`
    );
  }

  const dealCount = await prisma.deal.count({
    where: { pipelineColumnId: columnId },
  });

  if (dealCount > 0 && !moveToColumnId) {
    throw new AppError(409, 'COLUMN_HAS_DEALS', 'Column has deals; provide moveToColumnId');
  }

  if (dealCount > 0 && moveToColumnId) {
    const target = await prisma.pipelineColumn.findUnique({ where: { id: moveToColumnId } });
    if (!target || target.organizationId !== existing.organizationId) {
      throw new AppError(400, 'INVALID_MOVE_TARGET', 'Invalid move target column');
    }
    if (target.id === columnId) {
      throw new AppError(400, 'INVALID_MOVE_TARGET', 'Cannot move deals to the same column');
    }
    await prisma.$transaction([
      prisma.deal.updateMany({
        where: { pipelineColumnId: columnId },
        data: { pipelineColumnId: moveToColumnId },
      }),
      prisma.pipelineColumn.delete({ where: { id: columnId } }),
    ]);
    return;
  }

  await prisma.pipelineColumn.delete({ where: { id: columnId } });
}
