import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import {
  OrganizationRole,
  PipelineLogAction,
  Prisma,
  WhatsAppConnectionStatus,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
} from '@prisma/client';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { prisma } from '../../src/infrastructure/database/prisma';
import * as metricsService from '../../src/modules/metrics/metrics.service';

function authHeader(userId = randomUUID()): { userId: string; authorization: string } {
  const email = `${userId}@example.com`;
  const token = jwt.sign({ sub: userId, email }, process.env.JWT_SECRET as string, {
    algorithm: 'HS256',
  });

  return { userId, authorization: `Bearer ${token}` };
}

describe('Metrics HTTP validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/metrics/overview returns 401 without token', async () => {
    const res = await request(app)
      .get('/api/v1/metrics/overview')
      .query({ organizationId: randomUUID() });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/metrics/overview defaults rangeDays to 30 when omitted', async () => {
    const organizationId = randomUUID();
    const { userId, authorization } = authHeader();
    const getMetricsOverview = vi.spyOn(metricsService, 'getMetricsOverview').mockResolvedValue({
      range: { days: 30, startsAt: new Date().toISOString(), endsAt: new Date().toISOString() },
    } as Awaited<ReturnType<typeof metricsService.getMetricsOverview>>);

    const res = await request(app)
      .get('/api/v1/metrics/overview')
      .query({ organizationId })
      .set('Authorization', authorization);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.range.days).toBe(30);
    expect(getMetricsOverview).toHaveBeenCalledWith(userId, { organizationId, rangeDays: 30 });
  });

  it.each(['6', '15', '91', 'abc'])(
    'GET /api/v1/metrics/overview returns 400 when rangeDays is unsupported: %s',
    async (rangeDays) => {
      const { authorization } = authHeader();
      const getMetricsOverview = vi
        .spyOn(metricsService, 'getMetricsOverview')
        .mockResolvedValue({} as Awaited<ReturnType<typeof metricsService.getMetricsOverview>>);

      const res = await request(app)
        .get('/api/v1/metrics/overview')
        .query({ organizationId: randomUUID(), rangeDays })
        .set('Authorization', authorization);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(getMetricsOverview).not.toHaveBeenCalled();
    }
  );
});

describe.skipIf(!process.env.DATABASE_URL)('Metrics overview flow with database', () => {
  async function registerAndLogin(): Promise<{ token: string; organizationId: string }> {
    const id = randomUUID();
    const email = `metrics-${id}@example.com`;
    const password = 'password123';

    const reg = await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'Metrics User',
      organizationName: 'Metrics Org',
      organizationNiche: 'Servicos',
    });

    expect(reg.status).toBe(201);
    const token = reg.body.data.token as string;
    const organizationId = reg.body.data.user.memberships[0].organizationId as string;
    return { token, organizationId };
  }

  async function columnIdByPosition(
    token: string,
    organizationId: string,
    position: number
  ): Promise<string> {
    const res = await request(app)
      .get('/api/v1/pipeline-columns')
      .query({ organizationId })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const cols = res.body.data as { id: string; position: number }[];
    const col = cols.find((candidate) => candidate.position === position);

    if (!col) {
      throw new Error(`No column at position ${position}`);
    }

    return col.id;
  }

  it('returns 400 when organizationId is missing', async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get('/api/v1/metrics/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when user is not a member of the organization', async () => {
    const { organizationId } = await registerAndLogin();
    const { token: otherToken } = await registerAndLogin();

    const res = await request(app)
      .get('/api/v1/metrics/overview')
      .query({ organizationId })
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns the empty overview shape for a new organization', async () => {
    const { token, organizationId } = await registerAndLogin();

    const res = await request(app)
      .get('/api/v1/metrics/overview')
      .query({ organizationId, rangeDays: 7 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.range.days).toBe(7);
    expect(res.body.data.pipeline.totalDeals).toBe(0);
    expect(res.body.data.pipeline.totalValue).toBe('0.00');
    expect(res.body.data.pipeline.averageTicket).toBeNull();
    expect(res.body.data.pipeline.byStage.length).toBeGreaterThan(0);
    expect(res.body.data.activity.totalLogsInRange).toBe(0);
    expect(res.body.data.whatsapp.status).toBe('NOT_CONFIGURED');
    expect(res.body.data.products.total).toBe(0);
    expect(res.body.data.team.totalMembers).toBe(1);
    expect(res.body.data.team.owners).toBe(1);
    expect(res.body.data.team.members).toBe(0);
  });

  it('returns aggregated CRM metrics for the active organization', async () => {
    const { token, organizationId } = await registerAndLogin();
    const leadColumnId = await columnIdByPosition(token, organizationId, 0);
    const negotiationColumnId = await columnIdByPosition(token, organizationId, 1);
    const now = new Date();
    const oldDate = new Date(now);
    oldDate.setDate(oldDate.getDate() - 45);

    const memberUser = await prisma.user.create({
      data: {
        email: `metrics-member-${randomUUID()}@example.com`,
        name: 'Metrics Member',
        passwordHash: 'test-password-hash',
      },
    });

    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: memberUser.id,
        role: OrganizationRole.MEMBER,
      },
    });

    const dealA = await prisma.deal.create({
      data: {
        title: 'High Value Deal',
        organizationId,
        pipelineColumnId: leadColumnId,
        value: new Prisma.Decimal('1000.00'),
        position: 0,
        createdAt: now,
        updatedAt: now,
      },
    });

    await prisma.deal.create({
      data: {
        title: 'Older Deal',
        organizationId,
        pipelineColumnId: negotiationColumnId,
        value: new Prisma.Decimal('500.00'),
        position: 0,
        createdAt: oldDate,
        updatedAt: now,
      },
    });

    await prisma.deal.create({
      data: {
        title: 'Deal Without Value',
        organizationId,
        pipelineColumnId: negotiationColumnId,
        value: null,
        position: 1,
        createdAt: now,
        updatedAt: now,
      },
    });

    await prisma.pipelineLog.createMany({
      data: [
        {
          organizationId,
          dealId: dealA.id,
          action: PipelineLogAction.DEAL_CREATED,
          description: 'Created deal',
          toColumnId: leadColumnId,
          toColumnName: 'Lead',
          createdAt: now,
        },
        {
          organizationId,
          dealId: dealA.id,
          action: PipelineLogAction.DEAL_MOVED,
          description: 'Moved deal',
          fromColumnId: leadColumnId,
          toColumnId: negotiationColumnId,
          fromColumnName: 'Lead',
          toColumnName: 'Negociacao',
          createdAt: now,
        },
        {
          organizationId,
          dealId: dealA.id,
          action: PipelineLogAction.DEAL_UPDATED,
          description: 'Updated deal',
          createdAt: now,
        },
        {
          organizationId,
          dealId: dealA.id,
          action: PipelineLogAction.DEAL_DELETED,
          description: 'Deleted deal',
          createdAt: now,
        },
        {
          organizationId,
          dealId: dealA.id,
          action: PipelineLogAction.DEAL_CREATED,
          description: 'Old created deal',
          createdAt: oldDate,
        },
      ],
    });

    await prisma.product.createMany({
      data: [
        { organizationId, name: `Active A ${randomUUID()}`, price: new Prisma.Decimal('100.00') },
        { organizationId, name: `Active B ${randomUUID()}`, price: new Prisma.Decimal('300.00') },
        {
          organizationId,
          name: `Inactive ${randomUUID()}`,
          price: new Prisma.Decimal('900.00'),
          active: false,
        },
      ],
    });

    await prisma.whatsAppIntegration.create({
      data: {
        organizationId,
        instanceName: `metrics-${randomUUID()}`,
        status: WhatsAppConnectionStatus.CONNECTED,
        connectedPhone: '5541999999999',
        lastConnectedAt: now,
      },
    });

    const conversation = await prisma.whatsAppConversation.create({
      data: {
        organizationId,
        phone: '5541888888888',
        contactName: 'Lead WhatsApp',
        dealId: dealA.id,
        lastMessageAt: now,
      },
    });

    await prisma.whatsAppMessage.createMany({
      data: [
        {
          organizationId,
          conversationId: conversation.id,
          externalMessageId: `in-${randomUUID()}`,
          direction: WhatsAppMessageDirection.INBOUND,
          status: WhatsAppMessageStatus.RECEIVED,
          phone: conversation.phone,
          text: 'Oi',
          createdAt: now,
        },
        {
          organizationId,
          conversationId: conversation.id,
          externalMessageId: `out-${randomUUID()}`,
          direction: WhatsAppMessageDirection.OUTBOUND,
          status: WhatsAppMessageStatus.SENT,
          phone: conversation.phone,
          text: 'Ola',
          createdAt: now,
        },
        {
          organizationId,
          conversationId: conversation.id,
          externalMessageId: `fail-${randomUUID()}`,
          direction: WhatsAppMessageDirection.OUTBOUND,
          status: WhatsAppMessageStatus.FAILED,
          phone: conversation.phone,
          text: 'Falhou',
          createdAt: now,
        },
      ],
    });

    const res = await request(app)
      .get('/api/v1/metrics/overview')
      .query({ organizationId, rangeDays: 30 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.pipeline.totalDeals).toBe(3);
    expect(data.pipeline.totalValue).toBe('1500.00');
    expect(data.pipeline.averageTicket).toBe('750.00');
    expect(data.pipeline.dealsWithValue).toBe(2);
    expect(data.pipeline.dealsWithoutValue).toBe(1);
    expect(data.pipeline.createdInRange).toBe(2);
    expect(data.pipeline.updatedInRange).toBe(3);
    expect(data.pipeline.byStage.find((stage: { columnId: string }) => stage.columnId === leadColumnId))
      .toMatchObject({ dealCount: 1, value: '1000.00' });
    expect(
      data.pipeline.byStage.find((stage: { columnId: string }) => stage.columnId === negotiationColumnId)
    ).toMatchObject({ dealCount: 2, value: '500.00' });

    expect(data.activity.totalLogsInRange).toBe(4);
    expect(data.activity.created).toBe(1);
    expect(data.activity.moved).toBe(1);
    expect(data.activity.updated).toBe(1);
    expect(data.activity.deleted).toBe(1);
    expect(data.activity.daily.some((day: { whatsappMessages: number }) => day.whatsappMessages === 3))
      .toBe(true);
    expect(data.activity.recent.length).toBeGreaterThan(0);

    expect(data.whatsapp.status).toBe('CONNECTED');
    expect(data.whatsapp.connectedPhone).toBe('5541999999999');
    expect(data.whatsapp.conversations).toBe(1);
    expect(data.whatsapp.activeConversationsInRange).toBe(1);
    expect(data.whatsapp.inboundMessagesInRange).toBe(1);
    expect(data.whatsapp.outboundMessagesInRange).toBe(2);
    expect(data.whatsapp.failedMessagesInRange).toBe(1);
    expect(data.whatsapp.lastMessageAt).not.toBeNull();

    expect(data.products.total).toBe(3);
    expect(data.products.active).toBe(2);
    expect(data.products.inactive).toBe(1);
    expect(data.products.averagePrice).toBe('200.00');

    expect(data.team.totalMembers).toBe(2);
    expect(data.team.owners).toBe(1);
    expect(data.team.members).toBe(1);
  });
});
