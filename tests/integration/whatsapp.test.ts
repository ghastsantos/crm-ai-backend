import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { processInboundWhatsAppMessage } from '../../src/modules/whatsapp/whatsapp.service';
import { prisma } from '../../src/infrastructure/database/prisma';

describe('WhatsApp HTTP validation', () => {
  it('POST /api/v1/whatsapp/messages returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/whatsapp/messages').send({
      organizationId: randomUUID(),
      phone: '41999998888',
      message: 'Tenho interesse no serviço.',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('WhatsApp message flow with database', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function registerAndLogin(): Promise<{ token: string; organizationId: string }> {
    const id = randomUUID();
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: `whats-${id}@example.com`,
      password: 'password123',
      name: 'Whats User',
      organizationName: 'Whats Org',
      organizationNiche: 'Serviços',
    });

    return {
      token: reg.body.data.token as string,
      organizationId: reg.body.data.user.memberships[0].organizationId as string,
    };
  }

  it('creates a deal from a WhatsApp message and moves it based on the conversation', async () => {
    const { token, organizationId } = await registerAndLogin();

    const first = await request(app)
      .post('/api/v1/whatsapp/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organizationId,
        phone: '(41) 99999-8888',
        contactName: 'Ana Cliente',
        message: 'Tenho interesse e queria saber o valor.',
      });

    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    expect(first.body.data.created).toBe(true);
    expect(first.body.data.card.contactName).toBe('Ana Cliente');
    expect(first.body.data.analysis.stage).toBe('EM_NEGOCIACAO');

    const second = await request(app)
      .post('/api/v1/whatsapp/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organizationId,
        phone: '41999998888',
        contactName: 'Ana Cliente',
        message: 'Pode fechar, aceito a proposta.',
      });

    expect(second.status).toBe(200);
    expect(second.body.data.created).toBe(false);
    expect(second.body.data.card.id).toBe(first.body.data.card.id);
    expect(second.body.data.analysis.stage).toBe('FECHAMENTO');
    expect(second.body.data.card.notes).toContain('Pode fechar');
  });

  it('processes an inbound Baileys message and ignores duplicate message ids', async () => {
    const { token, organizationId } = await registerAndLogin();
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');

    const setup = await request(app)
      .post('/api/v1/whatsapp/integration/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId });

    expect(setup.status).toBe(200);
    expect(setup.body.data.organizationId).toBe(organizationId);

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const message = {
      instanceName: 'crm-global',
      externalMessageId: `crm-global:MSG-${randomUUID()}`,
      phone: '5541999977777',
      replyJid: '85130630709368@lid',
      contactName: 'Bianca Cliente',
      text: 'Tenho interesse e queria saber o valor.',
    };

    const first = await processInboundWhatsAppMessage(message, {
      sendText: async (phone, text) => {
        sentReplies.push({ phone, text });
      },
    });

    expect(first.ignored).toBe(false);
    if (!first.ignored) {
      expect(first.card.contactName).toBe('Bianca Cliente');
      expect(first.analysis.stage).toBe('EM_NEGOCIACAO');
    }
    expect(sentReplies).toHaveLength(1);
    expect(sentReplies[0].phone).toBe('85130630709368@lid');

    const conversations = await request(app)
      .get(`/api/v1/whatsapp/conversations?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(conversations.status).toBe(200);
    expect(conversations.body.data).toHaveLength(1);
    expect(conversations.body.data[0].phone).toBe('5541999977777');
    expect(conversations.body.data[0].messages).toHaveLength(2);

    const duplicate = await processInboundWhatsAppMessage(message, {
      sendText: async (phone, text) => {
        sentReplies.push({ phone, text });
      },
    });

    expect(duplicate).toEqual({
      ignored: true,
      reason: 'duplicate_message',
    });
    expect(sentReplies).toHaveLength(1);
  });

  it('starts a generic WhatsApp conversation by offering active products', async () => {
    const { token, organizationId } = await registerAndLogin();
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');

    await request(app)
      .post('/api/v1/whatsapp/integration/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId });

    await (prisma as any).product.create({
      data: {
        organizationId,
        name: 'Mentoria WhatsApp',
        description: 'Acompanhamento individual por 30 dias',
        price: '497.00',
        active: true,
      },
    });

    await (prisma as any).product.create({
      data: {
        organizationId,
        name: 'Produto pausado',
        price: '99.00',
        active: false,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];

    const result = await processInboundWhatsAppMessage(
      {
        instanceName: 'crm-global',
        externalMessageId: `crm-global:GENERIC-${randomUUID()}`,
        phone: '5541999911111',
        replyJid: '5541999911111@s.whatsapp.net',
        contactName: 'Jonas',
        text: 'Saroba',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(result.ignored).toBe(false);
    if (!result.ignored) {
      expect(result.card.contactName).toBe('Jonas');
      expect(result.analysis.suggestedReply).toContain('Mentoria WhatsApp');
      expect(result.analysis.suggestedReply).toContain('497');
      expect(result.analysis.suggestedReply).not.toContain('Produto pausado');
    }
    expect(sentReplies[0].text).toContain('Mentoria WhatsApp');
  });

  it('ignores inbound WhatsApp messages from numbers outside the env whitelist', async () => {
    const { token, organizationId } = await registerAndLogin();

    await request(app)
      .post('/api/v1/whatsapp/integration/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId });

    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '5541999900000,5541888877777');

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const result = await processInboundWhatsAppMessage(
      {
        instanceName: 'crm-global',
        externalMessageId: `crm-global:BLOCKED-${randomUUID()}`,
        phone: '5541999911111',
        replyJid: '5541999911111@s.whatsapp.net',
        contactName: 'Contato pessoal',
        text: 'Oi, tudo bem?',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(result).toEqual({
      ignored: true,
      reason: 'phone_not_allowed',
    });
    expect(sentReplies).toHaveLength(0);

    const conversations = await request(app)
      .get(`/api/v1/whatsapp/conversations?organizationId=${organizationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(conversations.status).toBe(200);
    expect(conversations.body.data).toHaveLength(0);
  });
});
