import {
  OrganizationRole,
  PipelineLogAction,
  Prisma,
  WhatsAppConnectionStatus,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
} from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import type { MetricsOverviewQuery } from './metrics.schemas';

type DailyBucket = {
  date: string;
  dealsCreated: number;
  movements: number;
  updates: number;
  deletions: number;
  whatsappMessages: number;
};

export type MetricsOverview = Awaited<ReturnType<typeof getMetricsOverview>>;

async function assertMember(userId: string, organizationId: string): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
}

function rangeForDays(days: number) {
  const endsAt = new Date();
  const startsAt = new Date(
    Date.UTC(endsAt.getUTCFullYear(), endsAt.getUTCMonth(), endsAt.getUTCDate() - (days - 1))
  );

  return { startsAt, endsAt };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createDailyBuckets(startsAt: Date, endsAt: Date): Map<string, DailyBucket> {
  const buckets = new Map<string, DailyBucket>();
  const cursor = new Date(
    Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate())
  );
  const last = new Date(
    Date.UTC(endsAt.getUTCFullYear(), endsAt.getUTCMonth(), endsAt.getUTCDate())
  );

  while (cursor <= last) {
    const key = dayKey(cursor);
    buckets.set(key, {
      date: key,
      dealsCreated: 0,
      movements: 0,
      updates: 0,
      deletions: 0,
      whatsappMessages: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
}

function toMoney(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function incrementBucket(
  buckets: Map<string, DailyBucket>,
  date: Date,
  field: keyof Omit<DailyBucket, 'date'>
): void {
  const bucket = buckets.get(dayKey(date));
  if (bucket) {
    bucket[field] += 1;
  }
}

export async function getMetricsOverview(userId: string, input: MetricsOverviewQuery) {
  await assertMember(userId, input.organizationId);

  const { startsAt, endsAt } = rangeForDays(input.rangeDays);

  const [
    columns,
    deals,
    logsInRange,
    recentLogs,
    integration,
    conversations,
    activeConversations,
    messagesInRange,
    products,
    teamMembers,
  ] = await prisma.$transaction([
    prisma.pipelineColumn.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { position: 'asc' },
      select: { id: true, title: true, position: true },
    }),
    prisma.deal.findMany({
      where: { organizationId: input.organizationId },
      select: {
        id: true,
        pipelineColumnId: true,
        value: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.pipelineLog.findMany({
      where: {
        organizationId: input.organizationId,
        createdAt: { gte: startsAt, lte: endsAt },
      },
      select: { action: true, createdAt: true },
    }),
    prisma.pipelineLog.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
        deal: { select: { title: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.whatsAppIntegration.findUnique({
      where: { organizationId: input.organizationId },
      select: { status: true, connectedPhone: true },
    }),
    prisma.whatsAppConversation.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true },
    }),
    prisma.whatsAppConversation.findMany({
      where: {
        organizationId: input.organizationId,
        lastMessageAt: { gte: startsAt, lte: endsAt },
      },
      select: { id: true },
    }),
    prisma.whatsAppMessage.findMany({
      where: {
        organizationId: input.organizationId,
        createdAt: { gte: startsAt, lte: endsAt },
      },
      orderBy: { createdAt: 'asc' },
      select: { direction: true, status: true, createdAt: true },
    }),
    prisma.product.findMany({
      where: { organizationId: input.organizationId },
      select: { active: true, price: true },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: input.organizationId },
      select: { role: true },
    }),
  ]);

  const stageIndex = new Map(
    columns.map((column) => [
      column.id,
      {
        columnId: column.id,
        title: column.title,
        position: column.position,
        dealCount: 0,
        value: new Prisma.Decimal(0),
      },
    ])
  );

  let totalValue = new Prisma.Decimal(0);
  let dealsWithValue = 0;
  let dealsWithoutValue = 0;
  let createdInRange = 0;
  let updatedInRange = 0;

  for (const deal of deals) {
    const stage = stageIndex.get(deal.pipelineColumnId);
    if (stage) {
      stage.dealCount += 1;
    }

    if (deal.value) {
      dealsWithValue += 1;
      totalValue = totalValue.plus(deal.value);
      if (stage) {
        stage.value = stage.value.plus(deal.value);
      }
    } else {
      dealsWithoutValue += 1;
    }

    if (deal.createdAt >= startsAt && deal.createdAt <= endsAt) {
      createdInRange += 1;
    }

    if (deal.updatedAt >= startsAt && deal.updatedAt <= endsAt) {
      updatedInRange += 1;
    }
  }

  const averageTicket = dealsWithValue > 0 ? totalValue.dividedBy(dealsWithValue).toFixed(2) : null;

  const created = logsInRange.filter((log) => log.action === PipelineLogAction.DEAL_CREATED).length;
  const moved = logsInRange.filter((log) => log.action === PipelineLogAction.DEAL_MOVED).length;
  const updated = logsInRange.filter((log) => log.action === PipelineLogAction.DEAL_UPDATED).length;
  const deleted = logsInRange.filter((log) => log.action === PipelineLogAction.DEAL_DELETED).length;

  const dailyBuckets = createDailyBuckets(startsAt, endsAt);
  for (const log of logsInRange) {
    if (log.action === PipelineLogAction.DEAL_CREATED) {
      incrementBucket(dailyBuckets, log.createdAt, 'dealsCreated');
    }
    if (log.action === PipelineLogAction.DEAL_MOVED) {
      incrementBucket(dailyBuckets, log.createdAt, 'movements');
    }
    if (log.action === PipelineLogAction.DEAL_UPDATED) {
      incrementBucket(dailyBuckets, log.createdAt, 'updates');
    }
    if (log.action === PipelineLogAction.DEAL_DELETED) {
      incrementBucket(dailyBuckets, log.createdAt, 'deletions');
    }
  }

  for (const message of messagesInRange) {
    incrementBucket(dailyBuckets, message.createdAt, 'whatsappMessages');
  }

  const inboundMessagesInRange = messagesInRange.filter(
    (message) => message.direction === WhatsAppMessageDirection.INBOUND
  ).length;
  const outboundMessagesInRange = messagesInRange.filter(
    (message) => message.direction === WhatsAppMessageDirection.OUTBOUND
  ).length;
  const failedMessagesInRange = messagesInRange.filter(
    (message) => message.status === WhatsAppMessageStatus.FAILED
  ).length;
  const lastMessageAt = messagesInRange.at(-1)?.createdAt ?? null;

  const activeProducts = products.filter((product) => product.active);
  const activeProductTotal = activeProducts.reduce(
    (sum, product) => sum.plus(product.price),
    new Prisma.Decimal(0)
  );
  const owners = teamMembers.filter((member) => member.role === OrganizationRole.OWNER).length;

  return {
    range: {
      days: input.rangeDays,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
    pipeline: {
      totalDeals: deals.length,
      totalValue: toMoney(totalValue),
      averageTicket,
      dealsWithValue,
      dealsWithoutValue,
      createdInRange,
      updatedInRange,
      byStage: [...stageIndex.values()].map((stage) => ({
        ...stage,
        value: toMoney(stage.value),
      })),
    },
    activity: {
      totalLogsInRange: logsInRange.length,
      created,
      moved,
      updated,
      deleted,
      daily: [...dailyBuckets.values()],
      recent: recentLogs.map((log) => ({
        id: log.id,
        action: log.action,
        description: log.description,
        createdAt: log.createdAt.toISOString(),
        dealTitle: log.deal?.title ?? null,
        userName: log.user?.name ?? null,
      })),
    },
    whatsapp: {
      status: integration?.status ?? WhatsAppConnectionStatus.NOT_CONFIGURED,
      connectedPhone: integration?.connectedPhone ?? null,
      conversations: conversations.length,
      activeConversationsInRange: activeConversations.length,
      inboundMessagesInRange,
      outboundMessagesInRange,
      failedMessagesInRange,
      lastMessageAt: lastMessageAt?.toISOString() ?? null,
    },
    products: {
      total: products.length,
      active: activeProducts.length,
      inactive: products.length - activeProducts.length,
      averagePrice:
        activeProducts.length > 0
          ? activeProductTotal.dividedBy(activeProducts.length).toFixed(2)
          : null,
    },
    team: {
      totalMembers: teamMembers.length,
      owners,
      members: teamMembers.length - owners,
    },
  };
}
