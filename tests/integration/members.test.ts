import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';

describe('Members HTTP validation', () => {
  it('GET /api/v1/members returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/members').query({ organizationId: randomUUID() });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Members flow with database', () => {
  async function registerAndLogin(emailPrefix: string) {
    const id = randomUUID();
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: `${emailPrefix}-${id}@example.com`,
      password: 'password123',
      name: 'Members Owner',
      organizationName: `Members Org ${id}`,
      organizationNiche: 'Servicos',
    });

    return {
      token: reg.body.data.token as string,
      userId: reg.body.data.user.id as string,
      organizationId: reg.body.data.user.memberships[0].organizationId as string,
    };
  }

  it('lets an owner list, create and remove organization members', async () => {
    const owner = await registerAndLogin('members-owner');

    const before = await request(app)
      .get('/api/v1/members')
      .query({ organizationId: owner.organizationId })
      .set('Authorization', `Bearer ${owner.token}`);

    expect(before.status).toBe(200);
    expect(before.body.data).toHaveLength(1);
    expect(before.body.data[0].user.id).toBe(owner.userId);
    expect(before.body.data[0].role).toBe('OWNER');

    const created = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        organizationId: owner.organizationId,
        name: 'Equipe Comercial',
        email: `comercial-${randomUUID()}@example.com`,
        password: 'password123',
        role: 'MEMBER',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.role).toBe('MEMBER');
    expect(created.body.data.user.email).toContain('comercial-');

    const afterCreate = await request(app)
      .get('/api/v1/members')
      .query({ organizationId: owner.organizationId })
      .set('Authorization', `Bearer ${owner.token}`);

    expect(afterCreate.status).toBe(200);
    expect(afterCreate.body.data).toHaveLength(2);

    const deleted = await request(app)
      .delete(`/api/v1/members/${created.body.data.id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(deleted.status).toBe(204);
  });

  it('does not let a member manage users in the organization', async () => {
    const owner = await registerAndLogin('members-owner-deny');

    const created = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        organizationId: owner.organizationId,
        name: 'Equipe Sem Permissao',
        email: `sem-permissao-${randomUUID()}@example.com`,
        password: 'password123',
        role: 'MEMBER',
      });

    const login = await request(app).post('/api/v1/auth/login').send({
      email: created.body.data.user.email,
      password: 'password123',
    });

    const denied = await request(app)
      .get('/api/v1/members')
      .query({ organizationId: owner.organizationId })
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });
});
