import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { WhatsAppConnectionStatus } from '@prisma/client';
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

  function randomPhone(prefix: string): string {
    return `${prefix}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
  }

  async function registerAndLogin(): Promise<{ token: string; organizationId: string }> {
    const id = randomUUID();
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
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

  async function createOrganization(token: string, name = 'Whats Org 2'): Promise<string> {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        niche: 'Servicos',
      });

    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function updateOrganizationPixKey(
    token: string,
    organizationId: string,
    pixKey: string,
    pixKeyType = 'CPF'
  ): Promise<void> {
    const res = await request(app)
      .patch(`/api/v1/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pixKey, pixKeyType });

    expect(res.status).toBe(200);
    expect(res.body.data.pixKey).toBe(pixKey);
    expect(res.body.data.pixKeyType).toBe(pixKeyType);
  }

  async function setupConnectedIntegration(
    token: string,
    organizationId: string,
    connectedPhone: string
  ): Promise<string> {
    const setup = await request(app)
      .post('/api/v1/whatsapp/integration/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId });

    expect(setup.status).toBe(200);

    await prisma.whatsAppIntegration.update({
      where: { id: setup.body.data.id as string },
      data: {
        status: WhatsAppConnectionStatus.CONNECTED,
        connectedPhone,
      },
    });

    return setup.body.data.instanceName as string;
  }

  it('keeps one WhatsApp integration per organization', async () => {
    const { token, organizationId: firstOrganizationId } = await registerAndLogin();
    const secondOrganizationId = await createOrganization(token, 'Whats Org 2');

    const firstSetup = await request(app)
      .post('/api/v1/whatsapp/integration/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId: firstOrganizationId });

    const secondSetup = await request(app)
      .post('/api/v1/whatsapp/integration/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId: secondOrganizationId });

    expect(firstSetup.status).toBe(200);
    expect(secondSetup.status).toBe(200);
    expect(firstSetup.body.data.organizationId).toBe(firstOrganizationId);
    expect(secondSetup.body.data.organizationId).toBe(secondOrganizationId);
    expect(firstSetup.body.data.instanceName).not.toBe(secondSetup.body.data.instanceName);

    const firstIntegration = await request(app)
      .get(`/api/v1/whatsapp/integration?organizationId=${firstOrganizationId}`)
      .set('Authorization', `Bearer ${token}`);

    const secondIntegration = await request(app)
      .get(`/api/v1/whatsapp/integration?organizationId=${secondOrganizationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(firstIntegration.status).toBe(200);
    expect(secondIntegration.status).toBe(200);
    expect(firstIntegration.body.data.organizationId).toBe(firstOrganizationId);
    expect(secondIntegration.body.data.organizationId).toBe(secondOrganizationId);
    expect(firstIntegration.body.data.instanceName).not.toBe(
      secondIntegration.body.data.instanceName
    );
  });

  it('lets the owner disconnect WhatsApp and clear pending routing sessions', async () => {
    const { token, organizationId } = await registerAndLogin();
    const connectedPhone = randomPhone('55419');
    const leadPhone = randomPhone('55418');

    const instanceName = await setupConnectedIntegration(token, organizationId, connectedPhone);
    await prisma.whatsAppRoutingSession.create({
      data: {
        connectedPhone,
        leadPhone,
        lastPromptAt: new Date(),
      },
    });

    await prisma.whatsAppIntegration.update({
      where: { organizationId },
      data: {
        qrCode: 'data:image/png;base64,abc',
        pairingCode: '123456',
      },
    });

    const res = await request(app)
      .post('/api/v1/whatsapp/integration/disconnect')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      organizationId,
      instanceName,
      status: 'DISCONNECTED',
      qrCode: null,
      pairingCode: null,
      connectedPhone: null,
    });

    await expect(
      prisma.whatsAppRoutingSession.findUnique({
        where: {
          connectedPhone_leadPhone: {
            connectedPhone,
            leadPhone,
          },
        },
      })
    ).resolves.toBeNull();
  });

  it('routes a shared WhatsApp number by asking which company the lead wants', async () => {
    const { token, organizationId: firstOrganizationId } = await registerAndLogin();
    const secondOrganizationId = await createOrganization(token, 'Empresa Y');
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');

    await prisma.organization.update({
      where: { id: firstOrganizationId },
      data: { name: 'Empresa X' },
    });

    const connectedPhone = randomPhone('55419');
    const leadPhone = randomPhone('55418');
    const firstInstanceName = await setupConnectedIntegration(
      token,
      firstOrganizationId,
      connectedPhone
    );
    await setupConnectedIntegration(token, secondOrganizationId, connectedPhone);

    await (prisma as any).product.create({
      data: {
        organizationId: firstOrganizationId,
        name: 'Mentoria',
        price: '1000.00',
        active: true,
      },
    });
    await (prisma as any).product.create({
      data: {
        organizationId: secondOrganizationId,
        name: 'Software',
        price: '500.00',
        active: true,
      },
    });
    await (prisma as any).product.create({
      data: {
        organizationId: secondOrganizationId,
        name: 'Suporte',
        price: '150.00',
        active: true,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const baseMessage = {
      instanceName: firstInstanceName,
      phone: leadPhone,
      replyJid: `${leadPhone}@s.whatsapp.net`,
      contactName: 'Jonas',
    };

    const first = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:SHARED-${randomUUID()}`,
        text: 'Oi',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(first).toEqual({
      ignored: true,
      reason: 'awaiting_organization_choice',
    });
    expect(sentReplies).toHaveLength(1);
    expect(sentReplies[0].text).toContain('1- Empresa X');
    expect(sentReplies[0].text).toContain('2- Empresa Y');
    expect(await prisma.deal.count({ where: { organizationId: firstOrganizationId } })).toBe(0);
    expect(await prisma.deal.count({ where: { organizationId: secondOrganizationId } })).toBe(0);

    const selected = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:SELECT-${randomUUID()}`,
        text: '2',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(selected.ignored).toBe(false);
    if (!selected.ignored) {
      expect(selected.card.organizationId).toBe(secondOrganizationId);
      expect(selected.card.contactName).toBe('Jonas');
      expect(selected.analysis.suggestedReply).toContain('1- Software (R$ 500,00)');
      expect(selected.analysis.suggestedReply).toContain('2- Suporte (R$ 150,00)');
      expect(selected.analysis.suggestedReply).not.toContain('Mentoria');
      expect(selected.analysis.suggestedReply).not.toContain('Excelente escolha');
    }
    expect(sentReplies[1].text).toContain('Você está falando com Empresa Y');
    expect(sentReplies[1].text).toContain('1- Software (R$ 500,00)');
    expect(sentReplies[1].text).toContain('2- Suporte (R$ 150,00)');

    const active = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:ACTIVE-${randomUUID()}`,
        text: 'Quero comprar o Software',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(active.ignored).toBe(false);
    if (!active.ignored && !selected.ignored) {
      expect(active.card.id).toBe(selected.card.id);
      expect(active.card.organizationId).toBe(secondOrganizationId);
    }
    expect(sentReplies[2].text).not.toContain('Qual empresa');

    const lostColumn = await prisma.pipelineColumn.findFirstOrThrow({
      where: { organizationId: secondOrganizationId, position: 4 },
    });
    if (!selected.ignored) {
      await prisma.deal.update({
        where: { id: selected.card.id },
        data: { pipelineColumnId: lostColumn.id },
      });
      await prisma.whatsAppConversation.updateMany({
        where: { organizationId: secondOrganizationId, phone: baseMessage.phone },
        data: { stage: 'NAO_FECHOU' },
      });
    }

    const afterLost = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:LOST-${randomUUID()}`,
        text: 'Oi, voltei',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(afterLost).toEqual({
      ignored: true,
      reason: 'awaiting_organization_choice',
    });
    expect(sentReplies[3].text).toContain('1- Empresa X');
    expect(sentReplies[3].text).toContain('2- Empresa Y');
  });

  it('does not offer disconnected or connecting integrations as company choices', async () => {
    const { token, organizationId: firstOrganizationId } = await registerAndLogin();
    const secondOrganizationId = await createOrganization(token, 'Empresa Y');
    const staleOrganizationId = await createOrganization(token, 'Whats Org');
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');

    await prisma.organization.update({
      where: { id: firstOrganizationId },
      data: { name: 'Empresa X' },
    });

    const connectedPhone = randomPhone('55419');
    const leadPhone = randomPhone('55418');
    const firstInstanceName = await setupConnectedIntegration(
      token,
      firstOrganizationId,
      connectedPhone
    );
    await setupConnectedIntegration(token, secondOrganizationId, connectedPhone);
    const staleInstanceName = await setupConnectedIntegration(
      token,
      staleOrganizationId,
      connectedPhone
    );
    await prisma.whatsAppIntegration.update({
      where: { instanceName: staleInstanceName },
      data: { status: WhatsAppConnectionStatus.CONNECTING },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const result = await processInboundWhatsAppMessage(
      {
        instanceName: firstInstanceName,
        externalMessageId: `${firstInstanceName}:CONNECTED-ONLY-${randomUUID()}`,
        phone: leadPhone,
        replyJid: `${leadPhone}@s.whatsapp.net`,
        contactName: 'Lead',
        text: 'Oi',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(result).toEqual({
      ignored: true,
      reason: 'awaiting_organization_choice',
    });
    expect(sentReplies).toHaveLength(1);
    expect(sentReplies[0].text).toContain('1- Empresa X');
    expect(sentReplies[0].text).toContain('2- Empresa Y');
    expect(sentReplies[0].text).not.toContain('3- Whats Org');
    expect(sentReplies[0].text).not.toContain('Whats Org');
  });

  it('sends only one company-choice prompt while a shared number waits for a lead choice', async () => {
    const { token, organizationId: firstOrganizationId } = await registerAndLogin();
    const secondOrganizationId = await createOrganization(token, 'Empresa Y');
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');

    await prisma.organization.update({
      where: { id: firstOrganizationId },
      data: { name: 'Empresa X' },
    });

    const connectedPhone = randomPhone('55419');
    const leadPhone = randomPhone('55418');
    const firstInstanceName = await setupConnectedIntegration(
      token,
      firstOrganizationId,
      connectedPhone
    );
    const secondInstanceName = await setupConnectedIntegration(
      token,
      secondOrganizationId,
      connectedPhone
    );

    const originalFindUnique = prisma.whatsAppRoutingSession.findUnique;
    let forcedMissingReads = 0;
    const findUniqueSpy = vi
      .spyOn(prisma.whatsAppRoutingSession, 'findUnique')
      .mockImplementation((args: any) => {
        const key = args?.where?.connectedPhone_leadPhone;
        if (key?.connectedPhone === connectedPhone && key?.leadPhone === leadPhone) {
          forcedMissingReads += 1;
          if (forcedMissingReads <= 2) {
            return Promise.resolve(null);
          }
        }

        return originalFindUnique.call(prisma.whatsAppRoutingSession, args);
      });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const baseMessage = {
      phone: leadPhone,
      replyJid: `${leadPhone}@s.whatsapp.net`,
      contactName: 'Jonas',
    };
    const rawMessageId = `PROMPT-${randomUUID()}`;

    try {
      const results = await Promise.all([
        processInboundWhatsAppMessage(
          {
            ...baseMessage,
            instanceName: firstInstanceName,
            externalMessageId: `${firstInstanceName}:${rawMessageId}`,
            text: 'Oi',
          },
          {
            sendText: async (phone, text) => {
              sentReplies.push({ phone, text });
            },
          }
        ),
        processInboundWhatsAppMessage(
          {
            ...baseMessage,
            instanceName: secondInstanceName,
            externalMessageId: `${secondInstanceName}:${rawMessageId}`,
            text: 'Oi',
          },
          {
            sendText: async (phone, text) => {
              sentReplies.push({ phone, text });
            },
          }
        ),
      ]);

      expect(results).toEqual([
        { ignored: true, reason: 'awaiting_organization_choice' },
        { ignored: true, reason: 'awaiting_organization_choice' },
      ]);
      expect(sentReplies).toHaveLength(1);
      expect(sentReplies[0].text).toContain('1- Empresa X');
      expect(sentReplies[0].text).toContain('2- Empresa Y');

      const extra = await processInboundWhatsAppMessage(
        {
          ...baseMessage,
          instanceName: firstInstanceName,
          externalMessageId: `${firstInstanceName}:PROMPT-EXTRA-${randomUUID()}`,
          text: 'Oi de novo',
        },
        {
          sendText: async (phone, text) => {
            sentReplies.push({ phone, text });
          },
        }
      );

      expect(extra).toEqual({
        ignored: true,
        reason: 'awaiting_organization_choice',
      });
      expect(sentReplies).toHaveLength(1);

      await prisma.whatsAppRoutingSession.updateMany({
        where: { connectedPhone, leadPhone },
        data: { lastPromptAt: new Date(Date.now() - 120_000) },
      });

      const staleExtra = await processInboundWhatsAppMessage(
        {
          ...baseMessage,
          instanceName: secondInstanceName,
          externalMessageId: `${secondInstanceName}:PROMPT-STALE-${randomUUID()}`,
          text: 'Oi',
        },
        {
          sendText: async (phone, text) => {
            sentReplies.push({ phone, text });
          },
        }
      );

      expect(staleExtra).toEqual({
        ignored: true,
        reason: 'awaiting_organization_choice',
      });
      expect(sentReplies).toHaveLength(2);
      expect(sentReplies[1].text).toContain('1- Empresa X');
      expect(sentReplies[1].text).toContain('2- Empresa Y');
    } finally {
      findUniqueSpy.mockRestore();
      (prisma.whatsAppRoutingSession as any).findUnique = originalFindUnique;
    }
  });

  it('asks the company again when the previous shared-number card was deleted', async () => {
    const { token, organizationId: firstOrganizationId } = await registerAndLogin();
    const secondOrganizationId = await createOrganization(token, 'Empresa Y');
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');

    await prisma.organization.update({
      where: { id: firstOrganizationId },
      data: { name: 'Empresa X' },
    });

    const connectedPhone = randomPhone('55419');
    const leadPhone = randomPhone('55418');
    const firstInstanceName = await setupConnectedIntegration(
      token,
      firstOrganizationId,
      connectedPhone
    );
    await setupConnectedIntegration(token, secondOrganizationId, connectedPhone);

    await (prisma as any).product.create({
      data: {
        organizationId: secondOrganizationId,
        name: 'Software',
        price: '500.00',
        active: true,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const baseMessage = {
      instanceName: firstInstanceName,
      phone: leadPhone,
      replyJid: `${leadPhone}@s.whatsapp.net`,
      contactName: 'Jonas',
    };

    await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:DELETE-FIRST-${randomUUID()}`,
        text: 'Oi',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    const selected = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:DELETE-SELECT-${randomUUID()}`,
        text: '2',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(selected.ignored).toBe(false);
    if (!selected.ignored) {
      await prisma.deal.delete({
        where: { id: selected.card.id },
      });
    }

    const afterDelete = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:DELETE-RESTART-${randomUUID()}`,
        text: 'Oi de novo',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(afterDelete).toEqual({
      ignored: true,
      reason: 'awaiting_organization_choice',
    });
    expect(sentReplies.at(-1)?.text).toContain('1- Empresa X');
    expect(sentReplies.at(-1)?.text).toContain('2- Empresa Y');
  });

  it('does not answer twice when the same WhatsApp message arrives through two shared instances', async () => {
    const { token, organizationId: firstOrganizationId } = await registerAndLogin();
    const secondOrganizationId = await createOrganization(token, 'Empresa Y');
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');

    await prisma.organization.update({
      where: { id: firstOrganizationId },
      data: { name: 'Empresa X' },
    });

    const connectedPhone = randomPhone('55419');
    const leadPhone = randomPhone('55418');
    const firstInstanceName = await setupConnectedIntegration(
      token,
      firstOrganizationId,
      connectedPhone
    );
    const secondInstanceName = await setupConnectedIntegration(
      token,
      secondOrganizationId,
      connectedPhone
    );

    await (prisma as any).product.create({
      data: {
        organizationId: secondOrganizationId,
        name: 'Software',
        price: '500.00',
        active: true,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const baseMessage = {
      phone: leadPhone,
      replyJid: `${leadPhone}@s.whatsapp.net`,
      contactName: 'Jonas',
    };

    await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        instanceName: firstInstanceName,
        externalMessageId: `${firstInstanceName}:DUP-CHOICE-${randomUUID()}`,
        text: 'Oi',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        instanceName: firstInstanceName,
        externalMessageId: `${firstInstanceName}:DUP-SELECT-${randomUUID()}`,
        text: '2',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    sentReplies.length = 0;
    const rawMessageId = `RAW-${randomUUID()}`;
    const [first, duplicate] = await Promise.all([
      processInboundWhatsAppMessage(
        {
          ...baseMessage,
          instanceName: firstInstanceName,
          externalMessageId: `${firstInstanceName}:${rawMessageId}`,
          text: 'Oi',
        },
        {
          sendText: async (phone, text) => {
            sentReplies.push({ phone, text });
          },
        }
      ),
      processInboundWhatsAppMessage(
        {
          ...baseMessage,
          instanceName: secondInstanceName,
          externalMessageId: `${secondInstanceName}:${rawMessageId}`,
          text: 'Oi',
        },
        {
          sendText: async (phone, text) => {
            sentReplies.push({ phone, text });
          },
        }
      ),
    ]);

    expect([first, duplicate].filter((result) => !result.ignored)).toHaveLength(1);
    expect([first, duplicate].filter((result) => result.ignored)).toEqual([
      {
        ignored: true,
        reason: 'duplicate_message',
      },
    ]);
    expect(sentReplies).toHaveLength(1);
  });

  it('creates a deal from a WhatsApp message and sends PIX before closing the sale', async () => {
    const { token, organizationId } = await registerAndLogin();
    await updateOrganizationPixKey(token, organizationId, 'pix-teste-123');

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
    expect(second.body.data.analysis.stage).toBe('EM_NEGOCIACAO');
    expect(second.body.data.analysis.suggestedReply).toContain('pix-teste-123');
    expect(second.body.data.analysis.suggestedReply).toContain('chave PIX CPF');
    expect(second.body.data.analysis.suggestedReply.toLowerCase()).toContain('comprovante');
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
    const instanceName = setup.body.data.instanceName as string;

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const message = {
      instanceName,
      externalMessageId: `${instanceName}:MSG-${randomUUID()}`,
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

    const cardDetails = await request(app)
      .get(`/api/v1/cards/${first.ignored ? '' : first.card.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(cardDetails.status).toBe(200);
    expect(cardDetails.body.data.whatsappConversation.messages).toHaveLength(2);
    expect(cardDetails.body.data.whatsappConversation.messages[0]).toMatchObject({
      direction: 'INBOUND',
      text: 'Tenho interesse e queria saber o valor.',
    });

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

    const setup = await request(app)
      .post('/api/v1/whatsapp/integration/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId });
    const instanceName = setup.body.data.instanceName as string;

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
        instanceName,
        externalMessageId: `${instanceName}:GENERIC-${randomUUID()}`,
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

  it('sends the PIX key as soon as the lead confirms purchase intent', async () => {
    const { token, organizationId } = await registerAndLogin();
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
    await updateOrganizationPixKey(token, organizationId, 'pix-teste-123');

    const instanceName = await setupConnectedIntegration(token, organizationId, randomPhone('55419'));

    await (prisma as any).product.create({
      data: {
        organizationId,
        name: 'Beterraba',
        price: '500.00',
        active: true,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const baseMessage = {
      instanceName,
      phone: '5541888777666',
      replyJid: '5541888777666@s.whatsapp.net',
      contactName: 'Thais',
    };

    const productChoice = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:PIX-PRODUCT-${randomUUID()}`,
        text: 'Beterraba',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    const purchaseIntent = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:PIX-CLOSE-${randomUUID()}`,
        text: 'Vamos finalizar a compra',
      },
      {
        sendText: async (phone, text) => {
          sentReplies.push({ phone, text });
        },
      }
    );

    expect(productChoice.ignored).toBe(false);
    expect(purchaseIntent.ignored).toBe(false);
    if (!productChoice.ignored && !purchaseIntent.ignored) {
      expect(purchaseIntent.card.id).toBe(productChoice.card.id);
      expect(purchaseIntent.card.value).toBe('500.00');
      expect(purchaseIntent.analysis.stage).toBe('EM_NEGOCIACAO');
    }
    expect(sentReplies.at(-1)?.text).toContain('pix-teste-123');
    expect(sentReplies.at(-1)?.text).toContain('chave PIX CPF');
    expect(sentReplies.at(-1)?.text).toContain('comprovante');
  });

  it('keeps the happy path after a numbered product choice instead of asking qualification questions', async () => {
    const { token, organizationId } = await registerAndLogin();
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');

    const instanceName = await setupConnectedIntegration(token, organizationId, randomPhone('55419'));

    await (prisma as any).product.create({
      data: {
        organizationId,
        name: 'Beterraba',
        price: '500.00',
        active: true,
      },
    });

    await (prisma as any).product.create({
      data: {
        organizationId,
        name: 'Cebola',
        price: '100.00',
        active: true,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const sendText = async (phone: string, text: string) => {
      sentReplies.push({ phone, text });
    };
    const baseMessage = {
      instanceName,
      phone: randomPhone('55418'),
      replyJid: '5541888777666@s.whatsapp.net',
      contactName: 'Thais',
    };

    const intro = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:HAPPY-INTRO-${randomUUID()}`,
        text: 'Oi',
      },
      { sendText }
    );

    const productChoice = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:HAPPY-PRODUCT-${randomUUID()}`,
        text: '1',
      },
      { sendText }
    );

    const existingCustomer = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:HAPPY-EXISTING-${randomUUID()}`,
        text: 'Ja utilizo',
      },
      { sendText }
    );

    expect(intro.ignored).toBe(false);
    expect(productChoice.ignored).toBe(false);
    expect(existingCustomer.ignored).toBe(false);
    if (!productChoice.ignored && !existingCustomer.ignored) {
      expect(existingCustomer.card.id).toBe(productChoice.card.id);
      expect(existingCustomer.card.value).toBe('500.00');
      expect(existingCustomer.analysis.stage).toBe('EM_NEGOCIACAO');
    }

    const choiceReply = sentReplies.at(-2)?.text ?? '';
    const continuationReply = sentReplies.at(-1)?.text ?? '';
    const combinedReplies = `${choiceReply}\n${continuationReply}`.toLowerCase();

    expect(choiceReply).toContain('Beterraba');
    expect(choiceReply).toContain('R$ 500,00');
    expect(combinedReplies).toContain('quero comprar');
    expect(combinedReplies).toContain('pix');
    expect(combinedReplies).not.toContain('serviço similar');
    expect(combinedReplies).not.toContain('servico similar');
    expect(combinedReplies).not.toContain('primeira vez');
    expect(combinedReplies).not.toContain('suporte');
    expect(combinedReplies).not.toContain('me conta');
  });

  it('uses the configured PIX key when the lead answers yes and does not ask for personal documents', async () => {
    const { token, organizationId } = await registerAndLogin();
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
    await updateOrganizationPixKey(token, organizationId, '10008881936', 'CPF');

    const instanceName = await setupConnectedIntegration(token, organizationId, randomPhone('55419'));

    await (prisma as any).product.create({
      data: {
        organizationId,
        name: 'Software',
        price: '500.00',
        active: true,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const baseMessage = {
      instanceName,
      phone: randomPhone('55418'),
      replyJid: '5541888777666@s.whatsapp.net',
      contactName: 'Thais',
    };
    const sendText = async (phone: string, text: string) => {
      sentReplies.push({ phone, text });
    };

    const productChoice = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:PIX-YES-PRODUCT-${randomUUID()}`,
        text: 'Software',
      },
      { sendText }
    );
    const yes = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:PIX-YES-${randomUUID()}`,
        text: 'Sim',
      },
      { sendText }
    );

    expect(productChoice.ignored).toBe(false);
    expect(yes.ignored).toBe(false);
    if (!productChoice.ignored && !yes.ignored) {
      expect(yes.card.id).toBe(productChoice.card.id);
      expect(yes.card.value).toBe('500.00');
      expect(yes.analysis.stage).toBe('EM_NEGOCIACAO');
    }

    const reply = sentReplies.at(-1)?.text ?? '';
    const normalizedReply = reply.toLowerCase();
    expect(reply).toContain('chave PIX CPF');
    expect(reply).toContain('10008881936');
    expect(normalizedReply).not.toContain('cpf ou cnpj');
    expect(normalizedReply).not.toContain('nome completo');
    expect(normalizedReply).not.toContain('confirmar seu cpf');
    expect(normalizedReply).not.toContain('confirme seu cpf');
  });

  it('keeps payment pending when the lead asks if an attachment was approved before closing', async () => {
    const { token, organizationId } = await registerAndLogin();
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
    await updateOrganizationPixKey(token, organizationId, 'pix-teste-123');

    const instanceName = await setupConnectedIntegration(token, organizationId, randomPhone('55419'));

    await (prisma as any).product.create({
      data: {
        organizationId,
        name: 'Beterraba',
        price: '500.00',
        active: true,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const baseMessage = {
      instanceName,
      phone: randomPhone('55418'),
      replyJid: '5541888777666@s.whatsapp.net',
      contactName: 'Thais',
    };
    const sendText = async (phone: string, text: string) => {
      sentReplies.push({ phone, text });
    };

    const product = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:PENDING-PRODUCT-${randomUUID()}`,
        text: 'Beterraba',
      },
      { sendText }
    );
    const purchaseIntent = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:PENDING-PIX-${randomUUID()}`,
        text: 'Vamos finalizar a compra',
      },
      { sendText }
    );
    const proof = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:PENDING-PROOF-${randomUUID()}`,
        text: '[imagem recebida]',
      },
      { sendText }
    );
    const question = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${instanceName}:PENDING-QUESTION-${randomUUID()}`,
        text: 'Deu certo?',
      },
      { sendText }
    );

    expect(product.ignored).toBe(false);
    expect(purchaseIntent.ignored).toBe(false);
    expect(proof.ignored).toBe(false);
    expect(question.ignored).toBe(false);
    if (!product.ignored && !question.ignored) {
      expect(question.card.id).toBe(product.card.id);
      expect(question.analysis.stage).toBe('EM_NEGOCIACAO');
    }
    const lastReply = sentReplies.at(-1)?.text.toLowerCase() ?? '';
    expect(lastReply).toContain('pagamento');
    expect(lastReply).toContain('ainda');
    expect(lastReply).toContain('aprovado');
  });

  it('confirms manually approved payment once and restarts the next shared-number contact', async () => {
    const { token, organizationId: firstOrganizationId } = await registerAndLogin();
    const secondOrganizationId = await createOrganization(token, 'teste 2');
    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '');
    await updateOrganizationPixKey(token, secondOrganizationId, 'pix-teste-123');

    await prisma.organization.update({
      where: { id: firstOrganizationId },
      data: { name: 'Empresa Teste' },
    });

    const connectedPhone = randomPhone('55419');
    const leadPhone = randomPhone('55418');
    const firstInstanceName = await setupConnectedIntegration(
      token,
      firstOrganizationId,
      connectedPhone
    );
    await setupConnectedIntegration(token, secondOrganizationId, connectedPhone);

    await (prisma as any).product.create({
      data: {
        organizationId: secondOrganizationId,
        name: 'Beterraba',
        price: '500.00',
        active: true,
      },
    });

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const baseMessage = {
      instanceName: firstInstanceName,
      phone: leadPhone,
      replyJid: `${leadPhone}@s.whatsapp.net`,
      contactName: 'Thais',
    };
    const sendText = async (phone: string, text: string) => {
      sentReplies.push({ phone, text });
    };

    await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:APPROVED-START-${randomUUID()}`,
        text: 'Oi',
      },
      { sendText }
    );
    const selected = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:APPROVED-SELECT-${randomUUID()}`,
        text: '2',
      },
      { sendText }
    );
    const product = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:APPROVED-PRODUCT-${randomUUID()}`,
        text: 'Beterraba',
      },
      { sendText }
    );

    expect(selected.ignored).toBe(false);
    expect(product.ignored).toBe(false);
    if (product.ignored) return;

    const closingColumn = await prisma.pipelineColumn.findFirstOrThrow({
      where: { organizationId: secondOrganizationId, position: 3 },
    });
    await prisma.deal.update({
      where: { id: product.card.id },
      data: { pipelineColumnId: closingColumn.id },
    });

    const approved = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:APPROVED-QUESTION-${randomUUID()}`,
        text: 'Deu certo?',
      },
      { sendText }
    );

    expect(approved.ignored).toBe(false);
    if (!approved.ignored) {
      expect(approved.card.id).toBe(product.card.id);
      expect(approved.analysis.stage).toBe('FECHAMENTO');
    }
    expect(sentReplies.at(-1)?.text.toLowerCase()).toContain('pagamento');
    expect(sentReplies.at(-1)?.text.toLowerCase()).toContain('confirmado');

    const restart = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:APPROVED-RESTART-${randomUUID()}`,
        text: 'Oi, quero comprar de novo',
      },
      { sendText }
    );

    expect(restart).toEqual({
      ignored: true,
      reason: 'awaiting_organization_choice',
    });
    expect(sentReplies.at(-1)?.text).toContain('1- Empresa Teste');
    expect(sentReplies.at(-1)?.text).toContain('2- teste 2');

    const newSelected = await processInboundWhatsAppMessage(
      {
        ...baseMessage,
        externalMessageId: `${firstInstanceName}:APPROVED-NEW-SELECT-${randomUUID()}`,
        text: '2',
      },
      { sendText }
    );

    expect(newSelected.ignored).toBe(false);
    if (!newSelected.ignored) {
      expect(newSelected.card.id).not.toBe(product.card.id);
      expect(newSelected.card.organizationId).toBe(secondOrganizationId);
    }
  });

  it('ignores inbound WhatsApp messages from numbers outside the env whitelist', async () => {
    const { token, organizationId } = await registerAndLogin();

    const setup = await request(app)
      .post('/api/v1/whatsapp/integration/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId });
    const instanceName = setup.body.data.instanceName as string;

    vi.stubEnv('WHATSAPP_ALLOWED_NUMBERS', '5541999900000,5541888877777');

    const sentReplies: Array<{ phone: string; text: string }> = [];
    const result = await processInboundWhatsAppMessage(
      {
        instanceName,
        externalMessageId: `${instanceName}:BLOCKED-${randomUUID()}`,
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
