import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';

describe('Organization users HTTP validation', () => {
  it('POST /api/v1/organizations/:id/users returns 401 without token', async () => {
    const res = await request(app).post(`/api/v1/organizations/${randomUUID()}/users`).send({
      email: 'member@example.com',
      password: 'password123',
      name: 'Member User',
      role: 'MEMBER',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Organization users flow with database', () => {
  async function registerOwner(): Promise<{ token: string; organizationId: string }> {
    const id = randomUUID();
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: `owner-${id}@example.com`,
      password: 'password123',
      name: 'Owner User',
      organizationName: 'Owner Org',
      organizationNiche: 'Serviços',
    });

    return {
      token: reg.body.data.token as string,
      organizationId: reg.body.data.user.memberships[0].organizationId as string,
    };
  }

  it('lets the organization owner create a member linked to the same organization', async () => {
    const { token, organizationId } = await registerOwner();
    const email = `member-${randomUUID()}@example.com`;

    const res = await request(app)
      .post(`/api/v1/organizations/${organizationId}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        email,
        password: 'password123',
        name: 'Member User',
        role: 'MEMBER',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.membership.organizationId).toBe(organizationId);
    expect(res.body.data.membership.role).toBe('MEMBER');
  });

  it('lets the organization owner save one PIX key with its type for WhatsApp payments', async () => {
    const { token, organizationId } = await registerOwner();

    const update = await request(app)
      .patch(`/api/v1/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pixKey: '123.456.789-00', pixKeyType: 'CPF' });

    expect(update.status).toBe(200);
    expect(update.body.data.pixKey).toBe('123.456.789-00');
    expect(update.body.data.pixKeyType).toBe('CPF');

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.memberships[0].organizationPixKey).toBe('123.456.789-00');
    expect(me.body.data.memberships[0].organizationPixKeyType).toBe('CPF');
  });
});
