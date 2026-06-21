import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { WhatsAppConnectionStatus, WhatsAppMessageDirection } from '@prisma/client';
import { app } from '../../src/app';
import { prisma } from '../../src/infrastructure/database/prisma';

describe('Cards HTTP validation', () => {
  it('POST /api/v1/cards returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/cards').send({
      title: 'Test Card',
      organizationId: randomUUID(),
      pipelineColumnId: randomUUID(),
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
      .send({ pipelineColumnId: randomUUID() });
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
      organizationNiche: 'Serviços',
    });

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
    const col = cols.find((c) => c.position === position);
    if (!col) throw new Error(`No column at position ${position}`);
    return col.id;
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
    const colProposta = await columnIdByPosition(token, organizationId, 3);
    const colNegociacao = await columnIdByPosition(token, organizationId, 4);

    const create = await request(app)
      .post('/api/v1/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Deal A',
        organizationId,
        value: 1500.5,
        pipelineColumnId: colProposta,
      });
    expect(create.status).toBe(201);
    expect(create.body.success).toBe(true);
    const card = create.body.data;
    expect(card.title).toBe('Deal A');
    expect(card.value).toBe('1500.50');
    expect(card.pipelineColumnId).toBe(colProposta);

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
      .send({ pipelineColumnId: colNegociacao });
    expect(move.status).toBe(200);
    expect(move.body.data.pipelineColumnId).toBe(colNegociacao);

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

    const colId = await columnIdByPosition(token1, organizationId, 0);

    const create = await request(app)
      .post('/api/v1/cards')
      .set('Authorization', `Bearer ${token1}`)
      .send({ title: 'Private Card', organizationId, pipelineColumnId: colId });
    expect(create.status).toBe(201);
    const cardId = create.body.data.id as string;

    const res = await request(app)
      .get(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CARD_NOT_FOUND');
  });

  it('sends a WhatsApp payment confirmation when a deal is moved to Fechamento', async () => {
    const { token, organizationId } = await registerAndLogin();
    const negotiationColumnId = await columnIdByPosition(token, organizationId, 2);
    const closingColumnId = await columnIdByPosition(token, organizationId, 3);
    const phone = '5541999988888';

    const create = await request(app)
      .post('/api/v1/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'WhatsApp - Ana',
        organizationId,
        value: 500,
        pipelineColumnId: negotiationColumnId,
        contactName: 'Ana',
        phone,
      });

    expect(create.status).toBe(201);
    const cardId = create.body.data.id as string;

    await prisma.whatsAppIntegration.create({
      data: {
        organizationId,
        instanceName: `cards-confirm-${randomUUID()}`,
        status: WhatsAppConnectionStatus.CONNECTED,
        connectedPhone: '554189025192',
        lastConnectedAt: new Date(),
      },
    });

    const conversation = await prisma.whatsAppConversation.create({
      data: {
        organizationId,
        phone,
        contactName: 'Ana',
        dealId: cardId,
        stage: 'EM_NEGOCIACAO',
        summary: 'Cliente enviou comprovante.',
        nextStep: 'Aguardar aprovacao no pipeline.',
        lastMessageAt: new Date(),
      },
    });

    const move = await request(app)
      .patch(`/api/v1/cards/${cardId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pipelineColumnId: closingColumnId });

    expect(move.status).toBe(200);
    expect(move.body.data.pipelineColumnId).toBe(closingColumnId);

    const outbound = await prisma.whatsAppMessage.findFirst({
      where: {
        organizationId,
        conversationId: conversation.id,
        direction: WhatsAppMessageDirection.OUTBOUND,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(outbound?.text.toLowerCase()).toContain('pagamento confirmado');

    const updatedConversation = await prisma.whatsAppConversation.findUniqueOrThrow({
      where: { id: conversation.id },
    });
    expect(updatedConversation.stage).toBe('FECHAMENTO');
    expect(updatedConversation.lastReply?.toLowerCase()).toContain('pagamento confirmado');
  });
});
