# Active Organization Metrics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete metrics dashboard for the active organization with backend-side aggregation and a dedicated React page.

**Architecture:** Add a new backend `metrics` module that exposes one authenticated organization-scoped overview endpoint. Add a frontend `metrics` feature slice that fetches this consolidated payload and renders compact dashboard sections with local CSS/SVG-style chart components.

**Tech Stack:** Node.js, Express, Prisma, Vitest, Supertest, React, Vite, TanStack Query, Tailwind CSS.

## Global Constraints

- Dashboard data is scoped to the active organization only.
- Backend endpoint is `GET /api/v1/metrics/overview`.
- Query parameters are `organizationId` required and `rangeDays` optional with allowed values `7`, `14`, `30`, `90`; default is `30`.
- No global cross-organization dashboard.
- No new database tables or migrations.
- No paid or heavyweight charting dependency.
- No marketing/landing page layout.
- Any authenticated member of the active organization can view metrics.
- Preserve unrelated working-tree changes already present in `crm-ai-backend` and `crm-ai-frontend`.

---

## File Structure

Backend repository: `crm-ai-backend`

- Create: `src/modules/metrics/metrics.schemas.ts` for query validation and shared query type.
- Create: `src/modules/metrics/metrics.service.ts` for membership checks and Prisma aggregation.
- Create: `src/modules/metrics/metrics.controller.ts` for request parsing and response envelope.
- Create: `src/modules/metrics/metrics.routes.ts` for authenticated route registration.
- Modify: `src/app.ts` to mount `metricsRoutes`.
- Create: `tests/integration/metrics.test.ts` for HTTP contract, auth, authorization and aggregate behavior.

Frontend repository: `../crm-ai-frontend`

- Create: `src/features/metrics/api/metrics-api.ts` for payload types and HTTP client.
- Create: `src/features/metrics/hooks/use-metrics-overview.ts` for TanStack Query integration.
- Create: `src/features/metrics/ui/metrics-kpi-grid.tsx` for top KPI cards.
- Create: `src/features/metrics/ui/pipeline-stage-chart.tsx` for count/value by stage.
- Create: `src/features/metrics/ui/activity-chart.tsx` for daily activity bars.
- Create: `src/features/metrics/ui/operational-panels.tsx` for WhatsApp, products and team panels.
- Create: `src/features/metrics/ui/recent-activity-list.tsx` for recent log events.
- Create: `src/pages/metrics-page.tsx` for page composition and range selector.
- Modify: `src/app/router.tsx` to register `/metrics`.
- Modify: `src/widgets/app-header/AppHeader.tsx` to add the Metrics nav link.
- Modify: `src/features/locale/model/messages.ts` to add Portuguese and English copy.

---

### Task 1: Backend Metrics Route Contract

**Files:**
- Create: `crm-ai-backend/tests/integration/metrics.test.ts`
- Create: `crm-ai-backend/src/modules/metrics/metrics.schemas.ts`
- Create: `crm-ai-backend/src/modules/metrics/metrics.service.ts`
- Create: `crm-ai-backend/src/modules/metrics/metrics.controller.ts`
- Create: `crm-ai-backend/src/modules/metrics/metrics.routes.ts`
- Modify: `crm-ai-backend/src/app.ts`

**Interfaces:**
- Produces: `getMetricsOverview(userId: string, input: MetricsOverviewQuery): Promise<MetricsOverview>`
- Produces: `metricsOverviewQuerySchema`
- Consumes: existing `authenticate`, `asyncHandler`, `ValidationError`, `AppError`, `prisma`

- [ ] **Step 1: Write the failing integration tests**

Create `tests/integration/metrics.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';

describe('Metrics HTTP validation', () => {
  it('GET /api/v1/metrics/overview returns 401 without token', async () => {
    const res = await request(app)
      .get('/api/v1/metrics/overview')
      .query({ organizationId: randomUUID() });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run in `crm-ai-backend`:

```bash
npm test -- tests/integration/metrics.test.ts
```

Expected: failure because `/api/v1/metrics/overview` is not registered.

- [ ] **Step 3: Add schema, controller, route and minimal service**

Create `src/modules/metrics/metrics.schemas.ts`:

```ts
import { z } from 'zod';

const rangeDaysSchema = z.preprocess(
  (value) => (value === undefined ? 30 : Number(value)),
  z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)])
);

export const metricsOverviewQuerySchema = z.object({
  organizationId: z.string().min(1),
  rangeDays: rangeDaysSchema,
});

export type MetricsOverviewQuery = z.infer<typeof metricsOverviewQuerySchema>;
```

Create `src/modules/metrics/metrics.controller.ts`:

```ts
import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import { metricsOverviewQuerySchema } from './metrics.schemas';
import * as metricsService from './metrics.service';

export async function getMetricsOverview(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const parsed = metricsOverviewQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const overview = await metricsService.getMetricsOverview(userId, parsed.data);
  res.status(200).json({ success: true, data: overview });
}
```

Create `src/modules/metrics/metrics.routes.ts`:

```ts
import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as metricsController from './metrics.controller';

export const metricsRoutes = Router();

metricsRoutes.get('/overview', authenticate, asyncHandler(metricsController.getMetricsOverview));
```

Create `src/modules/metrics/metrics.service.ts`:

```ts
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
```

Modify `src/app.ts`:

```ts
import { metricsRoutes } from '@/modules/metrics/metrics.routes';
```

Mount it next to the other API routes:

```ts
app.use('/api/v1/metrics', metricsRoutes);
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/integration/metrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit backend route contract**

Run:

```bash
git status --short
git add src/app.ts src/modules/metrics tests/integration/metrics.test.ts
git commit -m "feat: add metrics overview route contract"
```

Before committing, confirm `git status --short` still shows unrelated Prisma/cards/WhatsApp changes as unstaged.

---

### Task 2: Backend Metrics Aggregation

**Files:**
- Modify: `crm-ai-backend/tests/integration/metrics.test.ts`
- Modify: `crm-ai-backend/src/modules/metrics/metrics.service.ts`

**Interfaces:**
- Consumes: `getMetricsOverview(userId, input)` from Task 1.
- Produces: populated `MetricsOverview` with pipeline, activity, WhatsApp, product and team aggregates.

- [ ] **Step 1: Add the failing aggregate test**

Add these imports to `tests/integration/metrics.test.ts`:

```ts
import {
  OrganizationRole,
  PipelineLogAction,
  Prisma,
  WhatsAppConnectionStatus,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
} from '@prisma/client';
import { prisma } from '../../src/infrastructure/database/prisma';
```

Add this helper inside the database `describe` block:

```ts
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
```

Add this test inside the same database `describe` block:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/integration/metrics.test.ts
```

Expected: the aggregate test fails because the service still returns zeroed metrics.

- [ ] **Step 3: Replace `metrics.service.ts` with aggregate implementation**

Replace `src/modules/metrics/metrics.service.ts` with:

```ts
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

  const averageTicket =
    dealsWithValue > 0 ? totalValue.dividedBy(dealsWithValue).toFixed(2) : null;

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
        activeProducts.length > 0 ? activeProductTotal.dividedBy(activeProducts.length).toFixed(2) : null,
    },
    team: {
      totalMembers: teamMembers.length,
      owners,
      members: teamMembers.length - owners,
    },
  };
}
```

- [ ] **Step 4: Run backend metrics tests**

Run:

```bash
npm test -- tests/integration/metrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run backend build**

Run:

```bash
npm run build
```

Expected: TypeScript build completes.

- [ ] **Step 6: Commit backend aggregation**

Run:

```bash
git status --short
git add src/modules/metrics/metrics.service.ts tests/integration/metrics.test.ts
git commit -m "feat: aggregate active organization metrics"
```

Keep unrelated unstaged files out of the commit.

---

### Task 3: Frontend Metrics API and Hook

**Files:**
- Create: `crm-ai-frontend/src/features/metrics/api/metrics-api.ts`
- Create: `crm-ai-frontend/src/features/metrics/hooks/use-metrics-overview.ts`

**Interfaces:**
- Produces: `fetchMetricsOverview(params: MetricsOverviewParams): Promise<MetricsOverview>`
- Produces: `useMetricsOverview(organizationId: string | undefined, rangeDays: MetricsRangeDays)`
- Consumes: `apiRequest` from `@/shared/api/client`

- [ ] **Step 1: Create the API client file**

Create `src/features/metrics/api/metrics-api.ts` in `crm-ai-frontend`:

```ts
import { apiRequest } from '@/shared/api/client';

export type MetricsRangeDays = 7 | 14 | 30 | 90;

export type MetricsOverview = {
  range: {
    days: MetricsRangeDays;
    startsAt: string;
    endsAt: string;
  };
  pipeline: {
    totalDeals: number;
    totalValue: string;
    averageTicket: string | null;
    dealsWithValue: number;
    dealsWithoutValue: number;
    createdInRange: number;
    updatedInRange: number;
    byStage: Array<{
      columnId: string;
      title: string;
      position: number;
      dealCount: number;
      value: string;
    }>;
  };
  activity: {
    totalLogsInRange: number;
    created: number;
    moved: number;
    updated: number;
    deleted: number;
    daily: Array<{
      date: string;
      dealsCreated: number;
      movements: number;
      updates: number;
      deletions: number;
      whatsappMessages: number;
    }>;
    recent: Array<{
      id: string;
      action: string;
      description: string;
      createdAt: string;
      dealTitle: string | null;
      userName: string | null;
    }>;
  };
  whatsapp: {
    status: string;
    connectedPhone: string | null;
    conversations: number;
    activeConversationsInRange: number;
    inboundMessagesInRange: number;
    outboundMessagesInRange: number;
    failedMessagesInRange: number;
    lastMessageAt: string | null;
  };
  products: {
    total: number;
    active: number;
    inactive: number;
    averagePrice: string | null;
  };
  team: {
    totalMembers: number;
    owners: number;
    members: number;
  };
};

export type MetricsOverviewParams = {
  organizationId: string;
  rangeDays: MetricsRangeDays;
};

export async function fetchMetricsOverview(
  params: MetricsOverviewParams
): Promise<MetricsOverview> {
  const search = new URLSearchParams();
  search.set('organizationId', params.organizationId);
  search.set('rangeDays', String(params.rangeDays));

  return apiRequest<MetricsOverview>(`/api/v1/metrics/overview?${search.toString()}`, {
    method: 'GET',
  });
}
```

- [ ] **Step 2: Create the hook**

Create `src/features/metrics/hooks/use-metrics-overview.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchMetricsOverview } from '../api/metrics-api';
import type { MetricsRangeDays } from '../api/metrics-api';

export function useMetricsOverview(
  organizationId: string | undefined,
  rangeDays: MetricsRangeDays
) {
  return useQuery({
    queryKey: ['metrics-overview', organizationId, rangeDays],
    queryFn: () =>
      fetchMetricsOverview({
        organizationId: organizationId as string,
        rangeDays,
      }),
    enabled: Boolean(organizationId),
  });
}
```

- [ ] **Step 3: Run frontend typecheck**

Run in `crm-ai-frontend`:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit frontend API/hook**

Run:

```bash
git status --short
git add src/features/metrics
git commit -m "feat: add metrics overview client"
```

Do not stage existing unrelated frontend changes.

---

### Task 4: Frontend Dashboard UI Components

**Files:**
- Create: `crm-ai-frontend/src/features/metrics/ui/metrics-kpi-grid.tsx`
- Create: `crm-ai-frontend/src/features/metrics/ui/pipeline-stage-chart.tsx`
- Create: `crm-ai-frontend/src/features/metrics/ui/activity-chart.tsx`
- Create: `crm-ai-frontend/src/features/metrics/ui/operational-panels.tsx`
- Create: `crm-ai-frontend/src/features/metrics/ui/recent-activity-list.tsx`

**Interfaces:**
- Consumes: `MetricsOverview` from `../api/metrics-api`
- Produces: presentational React components used by `MetricsPage`

- [ ] **Step 1: Create KPI grid component**

Create `src/features/metrics/ui/metrics-kpi-grid.tsx`:

```tsx
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { useLocale } from '@/features/locale/hooks/use-locale';
import { formatCurrency } from '@/features/cards/lib/format-currency';
import type { MetricsOverview } from '../api/metrics-api';

type Props = {
  overview: MetricsOverview;
};

export function MetricsKpiGrid({ overview }: Props) {
  const { t } = useLocale();

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label={t('metrics.kpi.deals')}
        value={String(overview.pipeline.totalDeals)}
        detail={t('metrics.kpi.created_in_range', { count: overview.pipeline.createdInRange })}
      />
      <MetricCard
        label={t('metrics.kpi.pipeline_value')}
        value={formatCurrency(Number(overview.pipeline.totalValue))}
        detail={t('metrics.kpi.with_value', { count: overview.pipeline.dealsWithValue })}
      />
      <MetricCard
        label={t('metrics.kpi.average_ticket')}
        value={
          overview.pipeline.averageTicket
            ? formatCurrency(Number(overview.pipeline.averageTicket))
            : '-'
        }
        detail={t('metrics.kpi.without_value', { count: overview.pipeline.dealsWithoutValue })}
      />
      <MetricCard
        label={t('metrics.kpi.activity')}
        value={String(overview.activity.totalLogsInRange)}
        detail={t('metrics.kpi.movements', { count: overview.activity.moved })}
      />
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="min-h-[124px]">
      <CardDescription className="mt-0 uppercase tracking-widest">{label}</CardDescription>
      <CardTitle className="mt-3 text-2xl">{value}</CardTitle>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
    </Card>
  );
}
```

- [ ] **Step 2: Create pipeline chart component**

Create `src/features/metrics/ui/pipeline-stage-chart.tsx`:

```tsx
import { getPipelineColumnNameLabel } from '@/entities/pipeline-column/labels';
import { useLocale } from '@/features/locale/hooks/use-locale';
import { formatCurrency } from '@/features/cards/lib/format-currency';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import type { MetricsOverview } from '../api/metrics-api';

type Props = {
  stages: MetricsOverview['pipeline']['byStage'];
};

export function PipelineStageChart({ stages }: Props) {
  const { t } = useLocale();
  const maxDeals = Math.max(...stages.map((stage) => stage.dealCount), 1);
  const maxValue = Math.max(...stages.map((stage) => Number(stage.value)), 1);

  return (
    <Card className="space-y-5">
      <div>
        <CardTitle>{t('metrics.pipeline.title')}</CardTitle>
        <CardDescription>{t('metrics.pipeline.description')}</CardDescription>
      </div>

      <div className="space-y-4">
        {stages.map((stage) => {
          const label = getPipelineColumnNameLabel(stage.title, t);
          const dealWidth = `${Math.max(4, (stage.dealCount / maxDeals) * 100)}%`;
          const value = Number(stage.value);
          const valueWidth = `${Math.max(4, (value / maxValue) * 100)}%`;

          return (
            <div key={stage.columnId} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {label}
                </span>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {stage.dealCount} / {formatCurrency(value)}
                </span>
              </div>

              <div className="grid gap-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100" style={{ width: dealWidth }} />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400" style={{ width: valueWidth }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Create daily activity chart**

Create `src/features/metrics/ui/activity-chart.tsx`:

```tsx
import { useLocale } from '@/features/locale/hooks/use-locale';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import type { MetricsOverview } from '../api/metrics-api';

type Props = {
  daily: MetricsOverview['activity']['daily'];
};

export function ActivityChart({ daily }: Props) {
  const { t, locale } = useLocale();
  const maxTotal = Math.max(
    ...daily.map(
      (day) =>
        day.dealsCreated + day.movements + day.updates + day.deletions + day.whatsappMessages
    ),
    1
  );

  return (
    <Card className="space-y-5">
      <div>
        <CardTitle>{t('metrics.activity.title')}</CardTitle>
        <CardDescription>{t('metrics.activity.description')}</CardDescription>
      </div>

      <div className="flex h-48 items-end gap-1.5 overflow-x-auto pb-2">
        {daily.map((day) => {
          const total =
            day.dealsCreated + day.movements + day.updates + day.deletions + day.whatsappMessages;
          const height = `${Math.max(8, (total / maxTotal) * 100)}%`;
          const label = new Intl.DateTimeFormat(locale, {
            day: '2-digit',
            month: '2-digit',
          }).format(new Date(`${day.date}T00:00:00`));

          return (
            <div key={day.date} className="flex min-w-8 flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end">
                <div
                  className="w-full rounded-t-md bg-zinc-900 transition-all dark:bg-zinc-100"
                  style={{ height }}
                  title={`${label}: ${total}`}
                />
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Create operational panels**

Create `src/features/metrics/ui/operational-panels.tsx`:

```tsx
import { useLocale } from '@/features/locale/hooks/use-locale';
import { formatCurrency } from '@/features/cards/lib/format-currency';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import type { MetricsOverview } from '../api/metrics-api';

type Props = {
  overview: MetricsOverview;
};

export function OperationalPanels({ overview }: Props) {
  const { t } = useLocale();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel
        title={t('metrics.whatsapp.title')}
        description={overview.whatsapp.status}
        rows={[
          [t('metrics.whatsapp.connected_phone'), overview.whatsapp.connectedPhone ?? '-'],
          [t('metrics.whatsapp.conversations'), String(overview.whatsapp.conversations)],
          [t('metrics.whatsapp.inbound'), String(overview.whatsapp.inboundMessagesInRange)],
          [t('metrics.whatsapp.outbound'), String(overview.whatsapp.outboundMessagesInRange)],
          [t('metrics.whatsapp.failed'), String(overview.whatsapp.failedMessagesInRange)],
        ]}
      />
      <Panel
        title={t('metrics.products.title')}
        description={t('metrics.products.description')}
        rows={[
          [t('metrics.products.total'), String(overview.products.total)],
          [t('metrics.products.active'), String(overview.products.active)],
          [t('metrics.products.inactive'), String(overview.products.inactive)],
          [
            t('metrics.products.average_price'),
            overview.products.averagePrice ? formatCurrency(Number(overview.products.averagePrice)) : '-',
          ],
        ]}
      />
      <Panel
        title={t('metrics.team.title')}
        description={t('metrics.team.description')}
        rows={[
          [t('metrics.team.total'), String(overview.team.totalMembers)],
          [t('metrics.team.owners'), String(overview.team.owners)],
          [t('metrics.team.members'), String(overview.team.members)],
        ]}
      />
    </div>
  );
}

function Panel({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<[string, string]>;
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <dl className="mt-5 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
```

- [ ] **Step 5: Create recent activity list**

Create `src/features/metrics/ui/recent-activity-list.tsx`:

```tsx
import { useLocale } from '@/features/locale/hooks/use-locale';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import type { MetricsOverview } from '../api/metrics-api';

type Props = {
  recent: MetricsOverview['activity']['recent'];
};

const actionKeys: Record<string, string> = {
  DEAL_CREATED: 'logs.actions.card_created',
  DEAL_MOVED: 'logs.actions.card_moved',
  DEAL_UPDATED: 'logs.actions.card_updated',
  DEAL_ARCHIVED: 'logs.actions.card_archived',
  DEAL_DELETED: 'logs.actions.card_deleted',
  OWNER_CHANGED: 'logs.actions.owner_changed',
  COLUMN_CREATED: 'logs.actions.column_created',
  COLUMN_UPDATED: 'logs.actions.column_updated',
  COLUMN_DELETED: 'logs.actions.column_deleted',
};

export function RecentActivityList({ recent }: Props) {
  const { t, locale } = useLocale();

  return (
    <Card className="space-y-5">
      <div>
        <CardTitle>{t('metrics.recent.title')}</CardTitle>
        <CardDescription>{t('metrics.recent.description')}</CardDescription>
      </div>

      {recent.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('metrics.recent.empty')}</p>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {recent.map((item) => (
            <div key={item.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.dealTitle ?? t('logs.unknown.deal')}
                </p>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(item.createdAt))}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t(actionKeys[item.action] ?? 'logs.actions.all')} · {item.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 6: Run frontend typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit dashboard UI components**

Run:

```bash
git status --short
git add src/features/metrics
git commit -m "feat: add metrics dashboard components"
```

Keep unrelated frontend edits out of the commit.

---

### Task 5: Frontend Page, Routing, Navigation and Copy

**Files:**
- Create: `crm-ai-frontend/src/pages/metrics-page.tsx`
- Modify: `crm-ai-frontend/src/app/router.tsx`
- Modify: `crm-ai-frontend/src/widgets/app-header/AppHeader.tsx`
- Modify: `crm-ai-frontend/src/features/locale/model/messages.ts`

**Interfaces:**
- Consumes: `useMetricsOverview`, `MetricsRangeDays`, metrics UI components.
- Produces: `/metrics` route and header navigation.

- [ ] **Step 1: Create metrics page**

Create `src/pages/metrics-page.tsx`:

```tsx
import { useState } from 'react';
import { ActivityChart } from '@/features/metrics/ui/activity-chart';
import { MetricsKpiGrid } from '@/features/metrics/ui/metrics-kpi-grid';
import { OperationalPanels } from '@/features/metrics/ui/operational-panels';
import { PipelineStageChart } from '@/features/metrics/ui/pipeline-stage-chart';
import { RecentActivityList } from '@/features/metrics/ui/recent-activity-list';
import { useMetricsOverview } from '@/features/metrics/hooks/use-metrics-overview';
import type { MetricsRangeDays } from '@/features/metrics/api/metrics-api';
import { useLocale } from '@/features/locale/hooks/use-locale';
import { useActiveOrganization } from '@/features/organizations/hooks/use-active-organization';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';

const rangeOptions: MetricsRangeDays[] = [7, 14, 30, 90];

export function MetricsPage() {
  const { t, locale } = useLocale();
  const { active } = useActiveOrganization();
  const organizationId = active?.organizationId;
  const [rangeDays, setRangeDays] = useState<MetricsRangeDays>(30);
  const metricsQuery = useMetricsOverview(organizationId, rangeDays);

  if (!organizationId || !active) {
    return (
      <div className="space-y-6">
        <PageTitle title={t('metrics.title')} description={t('metrics.empty_org')} />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageTitle
          title={t('metrics.title')}
          description={t('metrics.description', { organization: active.organizationName })}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={rangeDays}
            onChange={(event) => setRangeDays(Number(event.target.value) as MetricsRangeDays)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:border-zinc-600 dark:focus-visible:ring-zinc-700"
            aria-label={t('metrics.range.label')}
          >
            {rangeOptions.map((option) => (
              <option key={option} value={option}>
                {t('metrics.range.option', { days: option })}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            onClick={() => void metricsQuery.refetch()}
            disabled={metricsQuery.isFetching}
          >
            {metricsQuery.isFetching ? t('metrics.refreshing') : t('metrics.refresh')}
          </Button>
        </div>
      </div>

      {metricsQuery.isError ? (
        <p className="text-sm text-red-500 dark:text-red-300">{t('metrics.fetch_error')}</p>
      ) : null}

      {metricsQuery.isLoading ? (
        <LoadingState />
      ) : metricsQuery.data ? (
        <>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">
            {t('metrics.last_update')}{' '}
            {metricsQuery.dataUpdatedAt
              ? new Intl.DateTimeFormat(locale, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(metricsQuery.dataUpdatedAt))
              : t('logs.not_updated')}
          </div>

          <MetricsKpiGrid overview={metricsQuery.data} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <PipelineStageChart stages={metricsQuery.data.pipeline.byStage} />
            <RecentActivityList recent={metricsQuery.data.activity.recent} />
          </div>

          <ActivityChart daily={metricsQuery.data.activity.daily} />
          <OperationalPanels overview={metricsQuery.data} />
        </>
      ) : null}
    </div>
  );
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-emerald-500 dark:text-emerald-400">
        {title}
      </p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {title}
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="min-h-[124px] animate-pulse">
          <CardDescription className="mt-0 h-3 w-24 rounded bg-zinc-100 text-transparent dark:bg-zinc-800">
            loading
          </CardDescription>
          <CardTitle className="mt-4 h-7 w-20 rounded bg-zinc-100 text-transparent dark:bg-zinc-800">
            loading
          </CardTitle>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Register the route**

Modify `src/app/router.tsx`:

```tsx
import { MetricsPage } from '@/pages/metrics-page';
```

Add inside the authenticated `AppShell` routes:

```tsx
<Route path="/metrics" element={<MetricsPage />} />
```

- [ ] **Step 3: Add header navigation link**

Modify `src/widgets/app-header/AppHeader.tsx` and add this `NavLink` before the admin-only links:

```tsx
<NavLink
  to="/metrics"
  className={({ isActive }) =>
    cn(
      'inline-flex h-9 items-center rounded-xl border border-transparent px-3 text-xs font-medium text-zinc-500 transition-all duration-200',
      'hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950 hover:shadow-sm',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300',
      'dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-700',
      isActive &&
        'border-zinc-200 bg-zinc-50 text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
    )
  }
  aria-label={t('nav.metrics_aria')}
  title={t('nav.metrics_aria')}
>
  {t('nav.metrics')}
</NavLink>
```

- [ ] **Step 4: Add locale strings**

Modify `src/features/locale/model/messages.ts`.

Add to `ptBR`:

```ts
'nav.metrics': 'Metricas',
'nav.metrics_aria': 'Acessar metricas da organizacao',
'metrics.title': 'Metricas',
'metrics.description': 'Painel da organizacao {organization}.',
'metrics.empty_org': 'Selecione uma organizacao para visualizar metricas.',
'metrics.refresh': 'Atualizar',
'metrics.refreshing': 'Atualizando...',
'metrics.fetch_error': 'Nao foi possivel carregar as metricas.',
'metrics.last_update': 'Ultima atualizacao:',
'metrics.range.label': 'Periodo das metricas',
'metrics.range.option': '{days} dias',
'metrics.kpi.deals': 'Negocios',
'metrics.kpi.created_in_range': '{count} criados no periodo',
'metrics.kpi.pipeline_value': 'Valor em pipeline',
'metrics.kpi.with_value': '{count} com valor',
'metrics.kpi.average_ticket': 'Ticket medio',
'metrics.kpi.without_value': '{count} sem valor',
'metrics.kpi.activity': 'Atividade',
'metrics.kpi.movements': '{count} movimentacoes',
'metrics.pipeline.title': 'Funil por etapa',
'metrics.pipeline.description': 'Quantidade e valor distribuido no pipeline.',
'metrics.activity.title': 'Atividade diaria',
'metrics.activity.description': 'Eventos do CRM e mensagens do WhatsApp no periodo.',
'metrics.recent.title': 'Atividade recente',
'metrics.recent.description': 'Ultimas mudancas registradas na organizacao.',
'metrics.recent.empty': 'Nenhuma atividade registrada ainda.',
'metrics.whatsapp.title': 'WhatsApp',
'metrics.whatsapp.connected_phone': 'Telefone conectado',
'metrics.whatsapp.conversations': 'Conversas',
'metrics.whatsapp.inbound': 'Recebidas',
'metrics.whatsapp.outbound': 'Enviadas',
'metrics.whatsapp.failed': 'Falhas',
'metrics.products.title': 'Produtos',
'metrics.products.description': 'Saude do catalogo da organizacao.',
'metrics.products.total': 'Total',
'metrics.products.active': 'Ativos',
'metrics.products.inactive': 'Inativos',
'metrics.products.average_price': 'Preco medio ativo',
'metrics.team.title': 'Equipe',
'metrics.team.description': 'Composicao de acesso ao CRM.',
'metrics.team.total': 'Total',
'metrics.team.owners': 'Admins',
'metrics.team.members': 'Membros',
```

Add to `en`:

```ts
'nav.metrics': 'Metrics',
'nav.metrics_aria': 'Open organization metrics',
'metrics.title': 'Metrics',
'metrics.description': 'Dashboard for {organization}.',
'metrics.empty_org': 'Select an organization to view metrics.',
'metrics.refresh': 'Refresh',
'metrics.refreshing': 'Refreshing...',
'metrics.fetch_error': 'Could not load metrics.',
'metrics.last_update': 'Last update:',
'metrics.range.label': 'Metrics period',
'metrics.range.option': '{days} days',
'metrics.kpi.deals': 'Deals',
'metrics.kpi.created_in_range': '{count} created in range',
'metrics.kpi.pipeline_value': 'Pipeline value',
'metrics.kpi.with_value': '{count} with value',
'metrics.kpi.average_ticket': 'Average ticket',
'metrics.kpi.without_value': '{count} without value',
'metrics.kpi.activity': 'Activity',
'metrics.kpi.movements': '{count} movements',
'metrics.pipeline.title': 'Pipeline by stage',
'metrics.pipeline.description': 'Deal count and value distributed across the pipeline.',
'metrics.activity.title': 'Daily activity',
'metrics.activity.description': 'CRM events and WhatsApp messages in range.',
'metrics.recent.title': 'Recent activity',
'metrics.recent.description': 'Latest changes registered in the organization.',
'metrics.recent.empty': 'No activity registered yet.',
'metrics.whatsapp.title': 'WhatsApp',
'metrics.whatsapp.connected_phone': 'Connected phone',
'metrics.whatsapp.conversations': 'Conversations',
'metrics.whatsapp.inbound': 'Inbound',
'metrics.whatsapp.outbound': 'Outbound',
'metrics.whatsapp.failed': 'Failed',
'metrics.products.title': 'Products',
'metrics.products.description': 'Organization catalog health.',
'metrics.products.total': 'Total',
'metrics.products.active': 'Active',
'metrics.products.inactive': 'Inactive',
'metrics.products.average_price': 'Average active price',
'metrics.team.title': 'Team',
'metrics.team.description': 'CRM access composition.',
'metrics.team.total': 'Total',
'metrics.team.owners': 'Admins',
'metrics.team.members': 'Members',
```

- [ ] **Step 5: Run frontend checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit page wiring**

Run:

```bash
git status --short
git add src/pages/metrics-page.tsx src/app/router.tsx src/widgets/app-header/AppHeader.tsx src/features/locale/model/messages.ts
git commit -m "feat: add metrics dashboard page"
```

Keep unrelated frontend edits out of the commit.

---

### Task 6: End-to-End Verification and Cleanup

**Files:**
- Verify only; no planned code changes.

**Interfaces:**
- Consumes: all backend and frontend work from Tasks 1 through 5.
- Produces: verified implementation ready for final review.

- [ ] **Step 1: Run backend verification**

Run in `crm-ai-backend`:

```bash
npm test -- tests/integration/metrics.test.ts
npm run build
```

Expected: both commands pass.

- [ ] **Step 2: Run frontend verification**

Run in `crm-ai-frontend`:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Inspect Git status in both repositories**

Run:

```bash
git status --short
```

Expected in `crm-ai-backend`: only known pre-existing unrelated files remain unstaged, or a clean tree if the user has handled them.

Expected in `crm-ai-frontend`: only known pre-existing unrelated files remain unstaged, or a clean tree if the user has handled them.

- [ ] **Step 4: Manual browser smoke test**

Start the backend:

```bash
npm run dev
```

Start the frontend in `crm-ai-frontend`:

```bash
npm run dev
```

Open the frontend URL printed by Vite, log in, switch to an organization, open `/metrics`, and verify:

- Metrics nav link is visible.
- Range selector changes the query.
- Refresh button refetches without layout shift.
- KPI cards, pipeline chart, activity chart, recent activity and operational panels render in light and dark mode.
- No text overlaps at mobile and desktop widths.

- [ ] **Step 5: Repeat the owning task when verification finds a defect**

If verification finds a defect, return to the task that owns the changed file, make the smallest
fix there, run that task's verification command again, and use that task's commit step. Do not make
a broad cleanup commit from this final task.

---

## Self-Review Results

- Spec coverage: backend endpoint, active organization scope, membership authorization, range days, consolidated payload, frontend route, header nav, charts, empty/loading/error states and verification commands are covered by Tasks 1 through 6.
- Red-flag scan: the plan contains no deferred implementation markers and each task names exact files, commands and expected outcomes.
- Type consistency: `MetricsRangeDays`, `MetricsOverview`, `getMetricsOverview`, `fetchMetricsOverview` and `useMetricsOverview` names match across backend and frontend tasks.
