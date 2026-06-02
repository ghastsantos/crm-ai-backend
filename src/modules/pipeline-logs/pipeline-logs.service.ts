import { type PipelineLogAction, Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';

type CreatePipelineLogInput = {
  organizationId: string;
  userId?: string | null;
  dealId?: string | null;
  action: PipelineLogAction;
  description: string;
  fromColumnId?: string | null;
  toColumnId?: string | null;
  fromColumnName?: string | null;
  toColumnName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type ListPipelineLogsInput = {
  organizationId: string;
  action?: PipelineLogAction;
  search?: string;
  limit?: number;
};

export async function createPipelineLog(input: CreatePipelineLogInput) {
  return prisma.pipelineLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      dealId: input.dealId ?? null,
      action: input.action,
      description: input.description,
      fromColumnId: input.fromColumnId ?? null,
      toColumnId: input.toColumnId ?? null,
      fromColumnName: input.fromColumnName ?? null,
      toColumnName: input.toColumnName ?? null,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function listPipelineLogs(input: ListPipelineLogsInput) {
  const limit = input.limit && input.limit > 0 && input.limit <= 200 ? input.limit : 100;

  return prisma.pipelineLog.findMany({
    where: {
      organizationId: input.organizationId,
      action: input.action,
      OR: input.search
        ? [
            {
              description: {
                contains: input.search,
                mode: 'insensitive',
              },
            },
            {
              fromColumnName: {
                contains: input.search,
                mode: 'insensitive',
              },
            },
            {
              toColumnName: {
                contains: input.search,
                mode: 'insensitive',
              },
            },
            {
              deal: {
                title: {
                  contains: input.search,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                name: {
                  contains: input.search,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                email: {
                  contains: input.search,
                  mode: 'insensitive',
                },
              },
            },
          ]
        : undefined,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      deal: {
        select: {
          id: true,
          title: true,
        },
      },
      fromColumn: {
        select: {
          id: true,
          title: true,
        },
      },
      toColumn: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}