import {
  PipelineLogAction,
  Prisma,
  WhatsAppConnectionStatus,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
} from '@prisma/client';
import { env, getWhatsappAllowedNumbers } from '@/config/env';
import { prisma } from '@/infrastructure/database/prisma';
import { createPipelineLog } from '@/modules/pipeline-logs/pipeline-logs.service';
import {
  listActiveProductsForOrganization,
  type PublicProduct,
} from '@/modules/products/products.service';
import { AppError } from '@/shared/errors';
import {
  analyzeWhatsAppMessage,
  type WhatsAppMessageAnalysis,
  type WhatsAppPipelineStage,
} from './whatsapp-assistant';
import {
  connectBaileysProvider,
  getBaileysProviderInfo,
  resetBaileysProvider,
  sendBaileysText,
  startBaileysProvider,
  type WhatsAppProviderConnectionInfo,
} from './baileys-provider';
import type { ParsedBaileysMessage } from './baileys-message';
import { analyzeConversationWithAi, type GeminiCrmAnalysis } from './gemini-assistant';
import type { ReceiveWhatsAppMessageBody } from './whatsapp.schemas';

type PipelineColumnSummary = {
  id: string;
  title: string;
  position: number;
};

type DealSummary = {
  id: string;
  title: string;
  pipelineColumnId: string;
  value: Prisma.Decimal | null;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  position: number;
  organizationId: string;
  contactId: string | null;
  createdAt: Date;
  updatedAt: Date;
  pipelineColumn?: {
    id: string;
    title: string;
  };
};

export type PublicWhatsAppCard = {
  id: string;
  title: string;
  pipelineColumnId: string;
  value: string | null;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  position: number;
  organizationId: string;
  contactId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProcessWhatsAppMessageResult = {
  card: PublicWhatsAppCard;
  analysis: WhatsAppMessageAnalysis;
  created: boolean;
};

const MAX_NOTES_LENGTH = 2000;

const STAGE_FALLBACK_POSITION: Record<WhatsAppPipelineStage, number> = {
  LEAD: 0,
  QUALIFICACAO: 1,
  EM_NEGOCIACAO: 2,
  FECHAMENTO: 3,
  NAO_FECHOU: 4,
};

const STAGE_TITLE_TERMS: Record<WhatsAppPipelineStage, string[]> = {
  LEAD: ['lead'],
  QUALIFICACAO: ['qualificacao', 'qualifica'],
  EM_NEGOCIACAO: ['em negociacao', 'negociacao', 'proposta'],
  FECHAMENTO: ['fechamento', 'fechado', 'ganho'],
  NAO_FECHOU: ['nao fechou', 'perdido', 'perda'],
};

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function parseAllowedWhatsAppNumbers(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map((phone) => normalizePhone(phone))
      .filter((phone) => phone.length >= 8)
  );
}

export function isPhoneAllowedForAutomaticWhatsApp(phone: string): boolean {
  const allowedNumbers = parseAllowedWhatsAppNumbers(getWhatsappAllowedNumbers());

  if (allowedNumbers.size === 0) return true;
  return allowedNumbers.has(normalizePhone(phone));
}

function normalizeTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toPublicCard(deal: DealSummary): PublicWhatsAppCard {
  return {
    id: deal.id,
    title: deal.title,
    pipelineColumnId: deal.pipelineColumnId,
    value: deal.value != null ? deal.value.toFixed(2) : null,
    companyName: deal.companyName,
    contactName: deal.contactName,
    email: deal.email,
    phone: deal.phone,
    notes: deal.notes,
    position: deal.position,
    organizationId: deal.organizationId,
    contactId: deal.contactId,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  };
}

async function assertMember(userId: string, organizationId: string): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
}

async function assertOwner(userId: string, organizationId: string): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership || membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only organization owners can change WhatsApp setup');
  }
}

async function listColumns(organizationId: string): Promise<PipelineColumnSummary[]> {
  const columns = await prisma.pipelineColumn.findMany({
    where: { organizationId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      position: true,
    },
  });

  if (columns.length === 0) {
    throw new AppError(400, 'INVALID_REFERENCE', 'Organization has no pipeline columns');
  }

  return columns;
}

export function columnForStage(
  columns: PipelineColumnSummary[],
  stage: WhatsAppPipelineStage
): PipelineColumnSummary {
  const terms = STAGE_TITLE_TERMS[stage];
  const byTitle = columns.find((column) => {
    const title = normalizeTitle(column.title);
    return terms.some((term) => title.includes(term));
  });

  if (byTitle) return byTitle;

  const fallbackPosition = STAGE_FALLBACK_POSITION[stage];
  return columns.find((column) => column.position === fallbackPosition) ?? columns[0];
}

async function findDealByPhone(organizationId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const deals = await prisma.deal.findMany({
    where: {
      organizationId,
      phone: {
        not: null,
      },
    },
    include: {
      pipelineColumn: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return deals.find((deal) => normalizePhone(deal.phone ?? '') === normalizedPhone) ?? null;
}

async function nextPositionForColumn(pipelineColumnId: string): Promise<number> {
  const agg = await prisma.deal.aggregate({
    where: { pipelineColumnId },
    _max: { position: true },
  });

  return (agg._max.position ?? -1) + 1;
}

function buildNotes(
  currentNotes: string | null,
  message: string,
  analysis: WhatsAppMessageAnalysis,
  receivedAt: Date
): string {
  const entry = [
    `WhatsApp - ${receivedAt.toISOString()}`,
    `Cliente: ${message}`,
    `Resumo: ${analysis.summary}`,
    `Proximo passo: ${analysis.nextStep}`,
  ].join('\n');

  const combined = currentNotes?.trim() ? `${currentNotes.trim()}\n\n${entry}` : entry;
  if (combined.length <= MAX_NOTES_LENGTH) return combined;

  return combined.slice(combined.length - MAX_NOTES_LENGTH).trimStart();
}

function formatProductPrice(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `R$ ${value}`;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numeric);
}

function productLine(product: PublicProduct): string {
  const description = product.description ? ` - ${product.description}` : '';
  return `${product.name} (${formatProductPrice(product.price)})${description}`;
}

function fallbackAnalysis(
  message: string,
  contactName?: string,
  products: PublicProduct[] = []
): GeminiCrmAnalysis {
  const analysis = analyzeWhatsAppMessage(message);
  if (products.length > 0 && analysis.stage === 'LEAD') {
    const intro = contactName ? `Ola, ${contactName}.` : 'Ola.';
    return {
      ...analysis,
      nextStep: 'Apresentar os produtos ativos e identificar interesse do cliente.',
      suggestedReply: `${intro} Posso te ajudar sim. Hoje trabalhamos com: ${products
        .slice(0, 5)
        .map(productLine)
        .join('; ')}. Qual desses produtos te interessa mais?`,
      fields: contactName ? { contactName } : {},
    };
  }

  return {
    ...analysis,
    fields: contactName ? { contactName } : {},
  };
}

async function moveDealAutomatically(
  deal: DealSummary & { pipelineColumn: { id: string; title: string } },
  targetColumn: PipelineColumnSummary,
  userId: string | null
): Promise<DealSummary> {
  if (deal.pipelineColumnId === targetColumn.id) return deal;

  const targetPosition = await nextPositionForColumn(targetColumn.id);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.deal.updateMany({
      where: {
        pipelineColumnId: deal.pipelineColumnId,
        position: { gt: deal.position },
      },
      data: { position: { decrement: 1 } },
    });

    return tx.deal.update({
      where: { id: deal.id },
      data: {
        pipelineColumnId: targetColumn.id,
        position: targetPosition,
      },
    });
  });

  await createPipelineLog({
    organizationId: updated.organizationId,
    userId,
    dealId: updated.id,
    action: PipelineLogAction.DEAL_MOVED,
    description: `Moveu a negociação "${updated.title}" de "${deal.pipelineColumn.title}" para "${targetColumn.title}" via WhatsApp.`,
    fromColumnId: deal.pipelineColumn.id,
    toColumnId: targetColumn.id,
    fromColumnName: deal.pipelineColumn.title,
    toColumnName: targetColumn.title,
    previousValue: String(deal.position),
    newValue: String(targetPosition),
    metadata: {
      dealId: updated.id,
      source: 'whatsapp',
    },
  });

  return updated;
}

async function applyCrmAction(input: {
  userId: string | null;
  organizationId: string;
  phone: string;
  contactName?: string;
  message: string;
  analysis: GeminiCrmAnalysis;
  columns: PipelineColumnSummary[];
  existingDeal?: (DealSummary & { pipelineColumn: { id: string; title: string } }) | null;
}): Promise<ProcessWhatsAppMessageResult> {
  const targetColumn = columnForStage(input.columns, input.analysis.stage);
  const notes = buildNotes(input.existingDeal?.notes ?? null, input.message, input.analysis, new Date());
  const fields = input.analysis.fields;
  const contactName = fields.contactName ?? input.contactName ?? input.existingDeal?.contactName;
  const phone = normalizePhone(input.phone);

  if (!input.existingDeal) {
    const position = await nextPositionForColumn(targetColumn.id);
    const deal = await prisma.deal.create({
      data: {
        title: contactName ? `WhatsApp - ${contactName}` : `WhatsApp - ${phone}`,
        organizationId: input.organizationId,
        pipelineColumnId: targetColumn.id,
        position,
        contactName: contactName ?? null,
        companyName: fields.companyName ?? null,
        email: fields.email ?? null,
        value: fields.dealValue != null ? new Prisma.Decimal(String(fields.dealValue)) : null,
        phone,
        notes,
      },
    });

    await createPipelineLog({
      organizationId: deal.organizationId,
      userId: input.userId,
      dealId: deal.id,
      action: PipelineLogAction.DEAL_CREATED,
      description: `Criou a negociação "${deal.title}" na coluna "${targetColumn.title}" via WhatsApp.`,
      toColumnId: targetColumn.id,
      toColumnName: targetColumn.title,
      metadata: {
        dealId: deal.id,
        source: 'whatsapp',
        stage: input.analysis.stage,
      },
    });

    return {
      card: toPublicCard(deal),
      analysis: input.analysis,
      created: true,
    };
  }

  let updated = await prisma.deal.update({
    where: { id: input.existingDeal.id },
    data: {
      contactName: contactName ?? input.existingDeal.contactName,
      companyName: fields.companyName ?? input.existingDeal.companyName,
      email: fields.email ?? input.existingDeal.email,
      value:
        fields.dealValue != null
          ? new Prisma.Decimal(String(fields.dealValue))
          : input.existingDeal.value,
      phone,
      notes,
    },
  });

  await createPipelineLog({
    organizationId: updated.organizationId,
    userId: input.userId,
    dealId: updated.id,
    action: PipelineLogAction.DEAL_UPDATED,
    description: `Atualizou a negociação "${updated.title}" via WhatsApp.`,
    fromColumnId: input.existingDeal.pipelineColumn.id,
    fromColumnName: input.existingDeal.pipelineColumn.title,
    toColumnId: input.existingDeal.pipelineColumn.id,
    toColumnName: input.existingDeal.pipelineColumn.title,
    metadata: {
      dealId: updated.id,
      source: 'whatsapp',
      stage: input.analysis.stage,
    },
  });

  if (updated.pipelineColumnId !== targetColumn.id) {
    updated = await moveDealAutomatically(
      { ...updated, pipelineColumn: input.existingDeal.pipelineColumn },
      targetColumn,
      input.userId
    );
  }

  return {
    card: toPublicCard(updated),
    analysis: input.analysis,
    created: false,
  };
}

async function loadOrganization(organizationId: string) {
  return prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      niche: true,
    },
  });
}

export async function processWhatsAppMessage(
  userId: string,
  input: ReceiveWhatsAppMessageBody
): Promise<ProcessWhatsAppMessageResult> {
  await assertMember(userId, input.organizationId);

  const organization = await loadOrganization(input.organizationId);
  const columns = await listColumns(input.organizationId);
  const products = await listActiveProductsForOrganization(input.organizationId);
  const phone = normalizePhone(input.phone);
  const existingDeal = await findDealByPhone(input.organizationId, phone);
  const analysis = await analyzeConversationWithAi({
    organizationName: organization.name,
    organizationNiche: organization.niche,
    customerMessage: input.message,
    contactName: input.contactName,
    existingDeal: existingDeal
      ? {
          title: existingDeal.title,
          notes: existingDeal.notes,
          stage: existingDeal.pipelineColumn.title,
        }
      : null,
    pipelineStages: columns.map((column) => column.title),
    products,
  }).catch(() => fallbackAnalysis(input.message, input.contactName, products));

  return applyCrmAction({
    userId,
    organizationId: input.organizationId,
    phone,
    contactName: input.contactName,
    message: input.message,
    analysis,
    columns,
    existingDeal,
  });
}

export async function getIntegration(userId: string) {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { instanceName: env.WHATSAPP_INSTANCE_NAME },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (integration?.organizationId) {
    await assertMember(userId, integration.organizationId);
  }

  return (
    integration ?? {
      id: null,
      instanceName: env.WHATSAPP_INSTANCE_NAME,
      status: WhatsAppConnectionStatus.NOT_CONFIGURED,
      qrCode: null,
      pairingCode: null,
      connectedPhone: null,
      lastWebhookAt: null,
      lastConnectedAt: null,
      organizationId: null,
      organization: null,
      createdAt: null,
      updatedAt: null,
    }
  );
}

export async function setupIntegration(userId: string, organizationId: string) {
  await assertOwner(userId, organizationId);

  return prisma.whatsAppIntegration.upsert({
    where: { instanceName: env.WHATSAPP_INSTANCE_NAME },
    create: {
      instanceName: env.WHATSAPP_INSTANCE_NAME,
      organizationId,
      status: WhatsAppConnectionStatus.NOT_CONFIGURED,
    },
    update: {
      organizationId,
      status: WhatsAppConnectionStatus.NOT_CONFIGURED,
      qrCode: null,
      pairingCode: null,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function connectIntegration(userId: string) {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { instanceName: env.WHATSAPP_INSTANCE_NAME },
  });

  if (!integration?.organizationId) {
    throw new AppError(400, 'WHATSAPP_NOT_CONFIGURED', 'Configure an organization first');
  }

  await assertOwner(userId, integration.organizationId);
  await resetBaileysProvider({ clearAuth: true });
  await prisma.whatsAppIntegration.update({
    where: { instanceName: env.WHATSAPP_INSTANCE_NAME },
    data: {
      status: WhatsAppConnectionStatus.CONNECTING,
      qrCode: null,
      pairingCode: null,
      connectedPhone: null,
    },
  });

  const connection = await connectBaileysProvider(providerOptions(env.WHATSAPP_INSTANCE_NAME));

  return prisma.whatsAppIntegration.update({
    where: { instanceName: env.WHATSAPP_INSTANCE_NAME },
    data: {
      status: connection.status,
      qrCode: connection.qrCode ?? null,
      pairingCode: connection.pairingCode ?? null,
      connectedPhone: connection.connectedPhone ?? null,
      lastConnectedAt:
        connection.status === WhatsAppConnectionStatus.CONNECTED ? new Date() : undefined,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function refreshIntegrationStatus(userId: string) {
  const integration = await getIntegration(userId);
  if (!integration.id) return integration;

  const connection = getBaileysProviderInfo();
  if (
    env.WHATSAPP_PROVIDER !== 'baileys' ||
    connection.status === WhatsAppConnectionStatus.NOT_CONFIGURED
  ) {
    return integration;
  }

  return prisma.whatsAppIntegration.update({
    where: { instanceName: env.WHATSAPP_INSTANCE_NAME },
    data: {
      status: connection.status,
      qrCode: connection.qrCode ?? integration.qrCode,
      pairingCode: connection.pairingCode ?? integration.pairingCode,
      connectedPhone: connection.connectedPhone ?? integration.connectedPhone,
      lastConnectedAt:
        connection.status === WhatsAppConnectionStatus.CONNECTED ? new Date() : undefined,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function listConversations(userId: string, organizationId: string) {
  await assertMember(userId, organizationId);

  return prisma.whatsAppConversation.findMany({
    where: { organizationId },
    include: {
      deal: {
        select: {
          id: true,
          title: true,
          pipelineColumnId: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 2,
      },
    },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: 20,
  });
}

type ProcessInboundOptions = {
  sendText?: (recipient: string, text: string) => Promise<void>;
};

export async function processInboundWhatsAppMessage(
  parsed: ParsedBaileysMessage,
  options: ProcessInboundOptions = {}
) {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { instanceName: parsed.instanceName },
  });

  if (!integration?.organizationId) {
    return { ignored: true, reason: 'integration_not_configured' };
  }

  if (!isPhoneAllowedForAutomaticWhatsApp(parsed.phone)) {
    return { ignored: true, reason: 'phone_not_allowed' };
  }

  await prisma.whatsAppIntegration.update({
    where: { instanceName: parsed.instanceName },
    data: { lastWebhookAt: new Date() },
  });

  const existingMessage = await prisma.whatsAppMessage.findUnique({
    where: { externalMessageId: parsed.externalMessageId },
  });

  if (existingMessage) {
    return { ignored: true, reason: 'duplicate_message' };
  }

  const organization = await loadOrganization(integration.organizationId);
  const columns = await listColumns(integration.organizationId);
  const products = await listActiveProductsForOrganization(integration.organizationId);
  const existingDeal = await findDealByPhone(integration.organizationId, parsed.phone);
  let aiError: string | null = null;
  const analysis = await analyzeConversationWithAi({
    organizationName: organization.name,
    organizationNiche: organization.niche,
    customerMessage: parsed.text,
    contactName: parsed.contactName,
    existingDeal: existingDeal
      ? {
          title: existingDeal.title,
          notes: existingDeal.notes,
          stage: existingDeal.pipelineColumn.title,
        }
      : null,
    pipelineStages: columns.map((column) => column.title),
    products,
  }).catch((error) => {
    aiError = error instanceof Error ? error.message : String(error);
    return fallbackAnalysis(parsed.text, parsed.contactName, products);
  });

  const crmResult = await applyCrmAction({
    userId: null,
    organizationId: integration.organizationId,
    phone: parsed.phone,
    contactName: parsed.contactName,
    message: parsed.text,
    analysis,
    columns,
    existingDeal,
  });

  const conversation = await prisma.whatsAppConversation.upsert({
    where: {
      organizationId_phone: {
        organizationId: integration.organizationId,
        phone: parsed.phone,
      },
    },
    create: {
      organizationId: integration.organizationId,
      phone: parsed.phone,
      contactName: analysis.fields.contactName ?? parsed.contactName ?? null,
      dealId: crmResult.card.id,
      stage: analysis.stage,
      summary: analysis.summary,
      nextStep: analysis.nextStep,
      lastReply: analysis.suggestedReply,
      lastMessageAt: new Date(),
    },
    update: {
      contactName: analysis.fields.contactName ?? parsed.contactName ?? undefined,
      dealId: crmResult.card.id,
      stage: analysis.stage,
      summary: analysis.summary,
      nextStep: analysis.nextStep,
      lastReply: analysis.suggestedReply,
      lastMessageAt: new Date(),
    },
  });

  await prisma.whatsAppMessage.create({
    data: {
      organizationId: integration.organizationId,
      conversationId: conversation.id,
      externalMessageId: parsed.externalMessageId,
      direction: WhatsAppMessageDirection.INBOUND,
      status: WhatsAppMessageStatus.RECEIVED,
      phone: parsed.phone,
      contactName: parsed.contactName ?? null,
      text: parsed.text,
      analysis: analysis as unknown as Prisma.InputJsonValue,
      responseText: analysis.suggestedReply,
      error: aiError,
    },
  });

  try {
    await (options.sendText ?? sendBaileysText)(parsed.replyJid, analysis.suggestedReply);
    await prisma.whatsAppMessage.create({
      data: {
        organizationId: integration.organizationId,
        conversationId: conversation.id,
        externalMessageId: `out:${parsed.externalMessageId}`,
        direction: WhatsAppMessageDirection.OUTBOUND,
        status: WhatsAppMessageStatus.SENT,
        phone: parsed.phone,
        contactName: parsed.contactName ?? null,
        text: analysis.suggestedReply,
      },
    });
  } catch (error) {
    await prisma.whatsAppMessage.create({
      data: {
        organizationId: integration.organizationId,
        conversationId: conversation.id,
        externalMessageId: `out:${parsed.externalMessageId}`,
        direction: WhatsAppMessageDirection.OUTBOUND,
        status: WhatsAppMessageStatus.FAILED,
        phone: parsed.phone,
        contactName: parsed.contactName ?? null,
        text: analysis.suggestedReply,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return {
    ignored: false,
    card: crmResult.card,
    analysis,
    conversationId: conversation.id,
  };
}

function providerOptions(instanceName: string) {
  return {
    instanceName,
    onMessage: async (message: ParsedBaileysMessage) => {
      await processInboundWhatsAppMessage(message);
    },
    onConnectionUpdate: (info: Partial<WhatsAppProviderConnectionInfo>) =>
      persistProviderConnection(instanceName, info),
  };
}

async function persistProviderConnection(
  instanceName: string,
  info: Partial<WhatsAppProviderConnectionInfo>
): Promise<void> {
  await prisma.whatsAppIntegration.updateMany({
    where: { instanceName },
    data: {
      status: info.status,
      qrCode: info.qrCode,
      pairingCode: info.pairingCode,
      connectedPhone: info.connectedPhone,
      lastConnectedAt: info.status === WhatsAppConnectionStatus.CONNECTED ? new Date() : undefined,
    },
  });
}

export async function startConfiguredWhatsAppIntegration(): Promise<void> {
  if (!env.WHATSAPP_AUTO_START || env.WHATSAPP_PROVIDER !== 'baileys') return;

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { instanceName: env.WHATSAPP_INSTANCE_NAME },
  });

  if (!integration?.organizationId) return;
  await startBaileysProvider(providerOptions(env.WHATSAPP_INSTANCE_NAME));
}
