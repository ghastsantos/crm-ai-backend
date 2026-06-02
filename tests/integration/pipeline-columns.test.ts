import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';

describe.skipIf(!process.env.DATABASE_URL)('Pipeline columns with database', () => {
  async function registerAndLogin(): Promise<{ token: string; organizationId: string }> {
    const id = randomUUID();
    const email = `pcol-${id}@example.com`;
    const password = 'password123';

    const reg = await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'PC User',
      organizationName: 'PC Org',
      organizationNiche: 'Serviços',
    });

    const token = reg.body.data.token as string;
    const organizationId = reg.body.data.user.memberships[0].organizationId as string;
    return { token, organizationId };
  }

  it('lists default columns after register', async () => {
    const { token, organizationId } = await registerAndLogin();
    const res = await request(app)
      .get('/api/v1/pipeline-columns')
      .query({ organizationId })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cols = res.body.data as { position: number; title: string }[];
    expect(cols.length).toBe(6);
    expect(cols[0].position).toBe(0);
    expect(cols[0].title).toBe('Lead captado');
  });

  it('creates and deletes an empty column', async () => {
    const { token, organizationId } = await registerAndLogin();
    const create = await request(app)
      .post('/api/v1/pipeline-columns')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId, title: 'Follow-up' });
    expect(create.status).toBe(201);
    const id = create.body.data.id as string;

    const del = await request(app)
      .delete(`/api/v1/pipeline-columns/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });
});
