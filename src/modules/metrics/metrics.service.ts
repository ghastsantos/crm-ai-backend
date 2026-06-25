import { OrganizationRole, WhatsAppConnectionStatus } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import type { MetricsOverviewQuery } from './metrics.schemas';

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

export async function getMetricsOverview(userId: string, input: MetricsOverviewQuery) {
  await assertMember(userId, input.organizationId);

  const { startsAt, endsAt } = rangeForDays(input.rangeDays);

  const [columns, integration, products, teamMembers] = await prisma.$transaction([
    prisma.pipelineColumn.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { position: 'asc' },
      select: { id: true, title: true, position: true },
    }),
    prisma.whatsAppIntegration.findUnique({
      where: { organizationId: input.organizationId },
      select: { status: true, connectedPhone: true },
    }),
    prisma.product.findMany({
      where: { organizationId: input.organizationId },
      select: { active: true },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: input.organizationId },
      select: { role: true },
    }),
  ]);

  const owners = teamMembers.filter((member) => member.role === OrganizationRole.OWNER).length;
  const activeProducts = products.filter((product) => product.active).length;

  return {
    range: {
      days: input.rangeDays,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
    pipeline: {
      totalDeals: 0,
      totalValue: '0.00',
      averageTicket: null,
      dealsWithValue: 0,
      dealsWithoutValue: 0,
      createdInRange: 0,
      updatedInRange: 0,
      byStage: columns.map((column) => ({
        columnId: column.id,
        title: column.title,
        position: column.position,
        dealCount: 0,
        value: '0.00',
      })),
    },
    activity: {
      totalLogsInRange: 0,
      created: 0,
      moved: 0,
      updated: 0,
      deleted: 0,
      daily: [],
      recent: [],
    },
    whatsapp: {
      status: integration?.status ?? WhatsAppConnectionStatus.NOT_CONFIGURED,
      connectedPhone: integration?.connectedPhone ?? null,
      conversations: 0,
      activeConversationsInRange: 0,
      inboundMessagesInRange: 0,
      outboundMessagesInRange: 0,
      failedMessagesInRange: 0,
      lastMessageAt: null,
    },
    products: {
      total: products.length,
      active: activeProducts,
      inactive: products.length - activeProducts,
      averagePrice: null,
    },
    team: {
      totalMembers: teamMembers.length,
      owners,
      members: teamMembers.length - owners,
    },
  };
}
