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
});
