import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import type {
  ListPipelineColumnsQuery,
  UpdatePipelineColumnBody,
} from './pipeline-columns.schemas';
import { MIN_PIPELINE_COLUMNS } from './pipeline-columns.defaults';

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

export async function updatePipelineColumn(
  userId: string,
  columnId: string,
  _input: UpdatePipelineColumnBody
): Promise<PublicPipelineColumn> {
  const existing = await prisma.pipelineColumn.findUnique({ where: { id: columnId } });
  if (!existing) {
    throw new AppError(404, 'COLUMN_NOT_FOUND', 'Pipeline column not found');
  }
  await assertMember(userId, existing.organizationId);

  throw new AppError(
    400,
    'PIPELINE_COLUMNS_FIXED',
    'Pipeline stages are fixed and cannot be customized'
  );
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
