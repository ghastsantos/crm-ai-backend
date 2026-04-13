import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';

describe('Cards HTTP validation', () => {
  it('POST /api/v1/cards returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/cards').send({
      title: 'Test Card',
      organizationId: randomUUID(),
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/cards returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/cards').query({ organizationId: randomUUID() });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/cards/:id returns 401 without token', async () => {
    const res = await request(app).get(`/api/v1/cards/${randomUUID()}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /api/v1/cards/:id returns 401 without token', async () => {
    const res = await request(app)
      .patch(`/api/v1/cards/${randomUUID()}`)
      .send({ title: 'Updated' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /api/v1/cards/:id/move returns 401 without token', async () => {
    const res = await request(app)
      .patch(`/api/v1/cards/${randomUUID()}/move`)
      .send({ stage: 'PROPOSTA' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('DELETE /api/v1/cards/:id returns 401 without token', async () => {
    const res = await request(app).delete(`/api/v1/cards/${randomUUID()}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Cards flow with database', () => {
  async function registerAndLogin(): Promise<{ token: string; organizationId: string }> {
    const id = randomUUID();
    const email = `cards-${id}@example.com`;
    const password = 'password123';

    const reg = await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'Cards User',
      organizationName: 'Cards Org',
    });

    const token = reg.body.data.token as string;
    const organizationId = reg.body.data.user.memberships[0].organizationId as string;
    return { token, organizationId };
  }

  it('POST /api/v1/cards returns 400 when body invalid', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/api/v1/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/v1/cards/:id returns 400 when body is empty', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .patch(`/api/v1/cards/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates, retrieves, updates, moves and deletes a card', async () => {
    const { token, organizationId } = await registerAndLogin();

    const create = await request(app)
      .post('/api/v1/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Deal A', organizationId, value: 1500.5, stage: 'PROPOSTA' });
    expect(create.status).toBe(201);
    expect(create.body.success).toBe(true);
    const card = create.body.data;
    expect(card.title).toBe('Deal A');
    expect(card.value).toBe('1500.50');
    expect(card.stage).toBe('PROPOSTA');

    const get = await request(app)
      .get(`/api/v1/cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.data.id).toBe(card.id);

    const list = await request(app)
      .get('/api/v1/cards')
      .set('Authorization', `Bearer ${token}`)
      .query({ organizationId });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.some((c: { id: string }) => c.id === card.id)).toBe(true);

    const patch = await request(app)
      .patch(`/api/v1/cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Deal A Updated' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.title).toBe('Deal A Updated');

    const move = await request(app)
      .patch(`/api/v1/cards/${card.id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'NEGOCIACAO' });
    expect(move.status).toBe(200);
    expect(move.body.data.stage).toBe('NEGOCIACAO');

    const del = await request(app)
      .delete(`/api/v1/cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const getAfterDelete = await request(app)
      .get(`/api/v1/cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getAfterDelete.status).toBe(404);
    expect(getAfterDelete.body.error.code).toBe('CARD_NOT_FOUND');
  });

  it('returns 404 when accessing a card from a different organization', async () => {
    const { token: token1, organizationId } = await registerAndLogin();
    const { token: token2 } = await registerAndLogin();

    const create = await request(app)
      .post('/api/v1/cards')
      .set('Authorization', `Bearer ${token1}`)
      .send({ title: 'Private Card', organizationId });
    expect(create.status).toBe(201);
    const cardId = create.body.data.id as string;

    const res = await request(app)
      .get(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CARD_NOT_FOUND');
  });
});
