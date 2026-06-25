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
