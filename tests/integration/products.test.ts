import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';

describe('Products HTTP validation', () => {
  it('GET /api/v1/products returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/products').query({ organizationId: randomUUID() });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Products flow with database', () => {
  async function registerAndLogin(emailPrefix: string) {
    const id = randomUUID();
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: `${emailPrefix}-${id}@example.com`,
      password: 'password123',
      name: 'Product User',
      organizationName: `Product Org ${id}`,
      organizationNiche: 'Cursos',
    });

    return {
      token: reg.body.data.token as string,
      organizationId: reg.body.data.user.memberships[0].organizationId as string,
    };
  }

  it('creates, lists, updates and disables products for an organization', async () => {
    const { token, organizationId } = await registerAndLogin('products');

    const created = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organizationId,
        name: 'Mentoria WhatsApp',
        description: 'Acompanhamento individual por 30 dias',
        price: 497,
      });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data).toMatchObject({
      organizationId,
      name: 'Mentoria WhatsApp',
      description: 'Acompanhamento individual por 30 dias',
      price: '497.00',
      active: true,
    });

    const listed = await request(app)
      .get('/api/v1/products')
      .query({ organizationId })
      .set('Authorization', `Bearer ${token}`);

    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].id).toBe(created.body.data.id);

    const updated = await request(app)
      .patch(`/api/v1/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        price: 397,
        active: false,
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.price).toBe('397.00');
    expect(updated.body.data.active).toBe(false);

    const afterUpdate = await request(app)
      .get('/api/v1/products')
      .query({ organizationId, active: 'true' })
      .set('Authorization', `Bearer ${token}`);

    expect(afterUpdate.status).toBe(200);
    expect(afterUpdate.body.data).toHaveLength(0);
  });

  it('does not allow users from another organization to read products', async () => {
    const owner = await registerAndLogin('products-owner');
    const outsider = await registerAndLogin('products-outsider');

    const res = await request(app)
      .get('/api/v1/products')
      .query({ organizationId: owner.organizationId })
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
