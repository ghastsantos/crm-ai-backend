import {
  OrganizationPixKeyType,
  PipelineLogAction,
  Prisma,
  WhatsAppConnectionStatus,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { env, getWhatsappAllowedNumbers } from '@/config/env';
import { logger } from '@/config/logger';
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

type IntegrationWithOrganization = Prisma.WhatsAppIntegrationGetPayload<{
  include: {
    organization: {
      select: {
        id: true;
        name: true;
        niche: true;
        pixKey: true;
        pixKeyType: true;
      };
    };
  };
}>;

type RoutableIntegration = IntegrationWithOrganization & {
  organizationId: string;
  connectedPhone: string;
  organization: {
    id: string;
    name: string;
    niche: string;
    pixKey: string | null;
    pixKeyType: OrganizationPixKeyType | null;
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
  analysis: GeminiCrmAnalysis;
  created: boolean;
};

const MAX_NOTES_LENGTH = 2000;
const ORGANIZATION_CHOICE_PROMPT_COOLDOWN_MS = 60_000;

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

function logTextPreview(value: string): string {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function integrationInstanceName(organizationId: string): string {
  return `${env.WHATSAPP_INSTANCE_NAME}-${organizationId}`;
}

function emptyIntegration(organizationId: string) {
  return {
    id: null,
    instanceName: integrationInstanceName(organizationId),
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
  };
}

function isMediaPlaceholder(message: string): boolean {
  const text = normalizeTitle(message);
  return (
    text.includes('[imagem recebida]') ||
    text.includes('[video recebido]') ||
    text.includes('[arquivo recebido]') ||
    text.includes('[audio recebido]')
  );
}

function isPaymentProofMessage(message: string): boolean {
  const text = normalizeTitle(message);
  return [
    'paguei',
    'comprovante',
    'boleto',
    'cartao',
    'transferencia',
    '[imagem recebida]',
    '[video recebido]',
    '[arquivo recebido]',
    '[audio recebido]',
  ].some((term) => text.includes(term));
}

function isUnverifiedPaymentMessage(message: string): boolean {
  const text = normalizeTitle(message);
  return isPaymentProofMessage(message) || ['pix', 'pagamento'].some((term) => text.includes(term));
}

function isPurchaseIntentMessage(message: string): boolean {
  const text = normalizeTitle(message);
  if (isPaymentProofMessage(message)) return false;

  return [
    'finalizar a compra',
    'finalizar compra',
    'finalizar o pedido',
    'finalizar pedido',
    'fechar a compra',
    'fechar compra',
    'fechar o pedido',
    'fechar pedido',
    'concluir a compra',
    'concluir compra',
    'vamos finalizar',
    'quero finalizar',
    'vamos fechar',
    'pode fechar',
    'quero comprar',
    'quero levar',
    'vou querer',
    'fazer o pedido',
    'pix',
    'no pix',
    'chave pix',
    'qual a chave pix',
    'dados do pix',
  ].some((term) => text.includes(term));
}

function isAffirmativeMessage(message: string): boolean {
  const text = normalizeTitle(message).trim();
  return [
    'sim',
    'ok',
    'okay',
    'beleza',
    'pode ser',
    'isso',
    'isso mesmo',
    'confirmo',
    'confirmado',
  ].includes(text);
}

function asksForLeadPersonalData(reply: string): boolean {
  const text = normalizeTitle(reply);
  return [
    'cpf ou cnpj',
    'cpf/cnpj',
    'seu cpf',
    'seu cnpj',
    'confirmar seu cpf',
    'confirme seu cpf',
    'nome completo',
    'dados fiscais',
    'dados para emissao',
    'emissao',
    'gerar a chave pix',
    'gerar chave pix',
  ].some((term) => text.includes(term));
}

function formatPixKeyType(type?: OrganizationPixKeyType | null): string {
  if (!type) return '';

  const labels: Record<OrganizationPixKeyType, string> = {
    CPF: ' CPF',
    CNPJ: ' CNPJ',
    PHONE: ' telefone',
    EMAIL: ' e-mail',
    RANDOM: ' aleatória',
  };

  return labels[type];
}

function isPaymentStatusQuestion(message: string): boolean {
  const text = normalizeTitle(message);
  return [
    'deu certo',
    'deu tudo certo',
    'pagamento deu certo',
    'pagamento aprovado',
    'aprovou',
    'foi aprovado',
    'confirmou',
    'confirmado',
    'recebeu',
    'caiu o pagamento',
    'compensou',
    'esta tudo certo',
    'ta tudo certo',
  ].some((term) => text.includes(term));
}

function buildPixPaymentReply(input: {
  contactName?: string | null;
  existingDeal?: DealSummary | null;
  analysis: GeminiCrmAnalysis;
  pixKey?: string | null;
  pixKeyType?: OrganizationPixKeyType | null;
}): string {
  const greeting = input.contactName ? `Perfeito, ${input.contactName}!` : 'Perfeito!';
  const amount =
    input.existingDeal?.value != null
      ? input.existingDeal.value.toFixed(2)
      : input.analysis.fields.dealValue != null
        ? String(input.analysis.fields.dealValue)
        : null;
  const amountText = amount ? ` no valor de ${formatProductPrice(amount)}` : '';

  if (!input.pixKey?.trim()) {
    return `${greeting} Para finalizar a compra${amountText}, a chave PIX ainda não foi configurada nesta empresa. Vou acionar a equipe para enviar a chave correta antes do pagamento.`;
  }

  const keyType = formatPixKeyType(input.pixKeyType);
  return `${greeting} Para finalizar a compra${amountText}, a chave PIX${keyType} é: ${input.pixKey.trim()}. Assim que realizar o pagamento, me envie o comprovante por aqui para eu confirmar no sistema.`;
}

function buildPaymentApprovedReply(contactName?: string | null): string {
  const greeting = contactName ? `Sim, ${contactName}!` : 'Sim!';
  return `${greeting} Pagamento confirmado por aqui. Sua compra foi aprovada e a negociação está finalizada. Obrigado!`;
}

function buildPaymentApprovedAnalysis(input: {
  contactName?: string | null;
  existingDeal: DealSummary;
}): GeminiCrmAnalysis {
  return {
    stage: 'FECHAMENTO',
    summary: 'Pagamento confirmado pela empresa.',
    nextStep: 'Encerrar esta negociação e iniciar um novo atendimento no próximo contato.',
    suggestedReply: buildPaymentApprovedReply(input.contactName),
    fields: input.contactName ? { contactName: input.contactName } : {},
  };
}

function buildPaymentPendingReply(contactName?: string | null): string {
  const greeting = contactName ? `${contactName}, ` : '';
  return `${greeting}o pagamento ainda não foi aprovado por aqui. Estou aguardando a confirmação no sistema e te aviso assim que estiver tudo certo.`;
}

function normalizeAnalysisForCrm(input: {
  message: string;
  analysis: GeminiCrmAnalysis;
  contactName?: string | null;
  existingDeal?: DealSummary | null;
  organizationPixKey?: string | null;
  organizationPixKeyType?: OrganizationPixKeyType | null;
}): GeminiCrmAnalysis {
  const happyPathAnalysis = normalizeHappyPathContinuationReply({
    message: input.message,
    contactName: input.contactName,
    existingDeal: input.existingDeal,
    analysis: input.analysis,
  });

  if (
    isPaymentStatusQuestion(input.message) &&
    input.existingDeal &&
    !isWonDeal(input.existingDeal) &&
    !isLostDeal(input.existingDeal)
  ) {
    return {
      ...input.analysis,
      stage: 'EM_NEGOCIACAO',
      summary: 'Cliente perguntou se o pagamento foi aprovado, mas ainda não houve confirmação.',
      nextStep: 'Aguardar a aprovação manual do pagamento no pipeline.',
      suggestedReply: buildPaymentPendingReply(input.contactName ?? input.existingDeal.contactName),
    };
  }

  const shouldSendPixKey =
    happyPathAnalysis.stage !== 'NAO_FECHOU' &&
    (isPurchaseIntentMessage(input.message) ||
      (Boolean(input.existingDeal) && isAffirmativeMessage(input.message)) ||
      asksForLeadPersonalData(happyPathAnalysis.suggestedReply));

  if (shouldSendPixKey) {
    return {
      ...happyPathAnalysis,
      stage: 'EM_NEGOCIACAO',
      summary: 'Cliente confirmou intenção de compra e recebeu a chave PIX.',
      nextStep: 'Aguardar o comprovante de pagamento para conferência.',
      suggestedReply: buildPixPaymentReply({
        contactName: input.contactName,
        existingDeal: input.existingDeal,
        analysis: happyPathAnalysis,
        pixKey: input.organizationPixKey,
        pixKeyType: input.organizationPixKeyType,
      }),
    };
  }

  if (!isUnverifiedPaymentMessage(input.message) || happyPathAnalysis.stage === 'NAO_FECHOU') {
    return happyPathAnalysis;
  }

  const media = isMediaPlaceholder(input.message);

  return {
    ...happyPathAnalysis,
    stage: 'EM_NEGOCIACAO',
    summary: media
      ? 'Cliente enviou um anexo pelo WhatsApp para conferencia.'
      : happyPathAnalysis.summary,
    nextStep: 'Conferir o pagamento antes de marcar a negociacao como fechada.',
    suggestedReply: media
      ? 'Recebi o arquivo por aqui. Vou conferir as informacoes do pagamento e ja te aviso o proximo passo.'
      : happyPathAnalysis.suggestedReply,
  };
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
  })
    .format(numeric)
    .replace(/\u00A0/g, ' ');
}

function numberedProductLine(product: PublicProduct, index: number): string {
  return `${index + 1}- ${product.name} (${formatProductPrice(product.price)})`;
}

function findSelectedProduct(message: string, products: PublicProduct[]): PublicProduct | null {
  const numericChoice = message.trim().match(/^(\d+)(?:\s*[-.)])?$/);
  if (numericChoice) {
    const index = Number(numericChoice[1]) - 1;
    return products[index] ?? null;
  }

  const normalized = normalizeTitle(message);
  return products.find((product) => normalized.includes(normalizeTitle(product.name))) ?? null;
}

function buildProductPurchaseReply(input: {
  contactName?: string | null;
  productName?: string | null;
  price?: string | null;
}): string {
  const greeting = input.contactName
    ? `Excelente escolha, ${input.contactName}!`
    : 'Excelente escolha!';
  const productText = input.productName ? ` ${input.productName}` : ' Essa opção';
  const priceText = input.price ? ` sai por ${formatProductPrice(input.price)}` : '';

  return `${greeting}${productText}${priceText}. Para seguir com a compra, responda "quero comprar" ou "PIX" que eu te envio a chave de pagamento.`;
}

function buildProductChoiceReply(input: {
  organizationName: string;
  contactName?: string;
  products: PublicProduct[];
}): string {
  const greeting = input.contactName ? `Perfeito, ${input.contactName}.` : 'Perfeito.';

  if (input.products.length === 0) {
    return `${greeting} Você está falando com ${input.organizationName}. Ainda não há produtos cadastrados para esta empresa. Me conta o que você procura para eu te orientar melhor?`;
  }

  return [
    `${greeting} Você está falando com ${input.organizationName}. Estes são os produtos disponíveis:`,
    '',
    ...input.products.slice(0, 5).map(numberedProductLine),
    '',
    'Qual deles te interessa?',
  ].join('\n');
}

function shouldUseProductChoiceReply(input: {
  existingDeal: DealSummary | null;
  products: PublicProduct[];
  analysis: GeminiCrmAnalysis;
}): boolean {
  return !input.existingDeal && input.products.length > 0 && input.analysis.stage === 'LEAD';
}

function normalizeProductIntroReply(input: {
  organizationName: string;
  contactName?: string;
  products: PublicProduct[];
  existingDeal: DealSummary | null;
  analysis: GeminiCrmAnalysis;
}): GeminiCrmAnalysis {
  if (!shouldUseProductChoiceReply(input)) return input.analysis;

  return {
    ...input.analysis,
    nextStep: 'Apresentar os produtos ativos e identificar interesse do cliente.',
    suggestedReply: buildProductChoiceReply({
      organizationName: input.organizationName,
      contactName: input.contactName,
      products: input.products,
    }),
  };
}

function normalizeProductSelectionReply(input: {
  message: string;
  contactName?: string | null;
  products: PublicProduct[];
  analysis: GeminiCrmAnalysis;
}): GeminiCrmAnalysis {
  const selectedProduct = findSelectedProduct(input.message, input.products);
  if (!selectedProduct || isPaymentProofMessage(input.message)) return input.analysis;

  return {
    ...input.analysis,
    stage: 'EM_NEGOCIACAO',
    summary: `Cliente demonstrou interesse em ${selectedProduct.name}.`,
    nextStep: 'Aguardar confirmacao de compra para enviar a chave PIX.',
    suggestedReply: buildProductPurchaseReply({
      contactName: input.contactName ?? input.analysis.fields.contactName,
      productName: selectedProduct.name,
      price: selectedProduct.price,
    }),
    fields: {
      ...input.analysis.fields,
      ...(input.contactName ? { contactName: input.contactName } : {}),
      dealValue: Number(selectedProduct.price),
    },
  };
}

function isHappyPathContinuation(message: string): boolean {
  const text = normalizeTitle(message);
  return ['ja utilizo', 'ja uso', 'uso sim', 'utilizo sim', 'tenho interesse', 'me interessa'].some(
    (term) => text.includes(term)
  );
}

function hasQualificationQuestion(reply: string): boolean {
  const text = normalizeTitle(reply);
  return [
    'servico similar',
    'primeira vez',
    'como voce utiliza',
    'como utiliza',
    'suporte especifico',
    'precisa de algum suporte',
    'me conta',
    'o que voce precisa',
    'qual sua necessidade',
  ].some((term) => text.includes(term));
}

function normalizeHappyPathContinuationReply(input: {
  message: string;
  contactName?: string | null;
  existingDeal?: DealSummary | null;
  analysis: GeminiCrmAnalysis;
}): GeminiCrmAnalysis {
  if (
    !input.existingDeal?.value ||
    !isHappyPathContinuation(input.message) ||
    isPaymentProofMessage(input.message) ||
    isPaymentStatusQuestion(input.message)
  ) {
    return input.analysis;
  }

  const shouldUseDirectReply =
    hasQualificationQuestion(input.analysis.suggestedReply) ||
    input.analysis.stage === 'LEAD' ||
    input.analysis.stage === 'QUALIFICACAO';

  return {
    ...input.analysis,
    stage: 'EM_NEGOCIACAO',
    summary: 'Cliente segue interessado na compra.',
    nextStep: 'Aguardar confirmacao de compra para enviar a chave PIX.',
    suggestedReply: shouldUseDirectReply
      ? buildProductPurchaseReply({
          contactName: input.contactName ?? input.existingDeal.contactName,
          price: input.existingDeal.value.toFixed(2),
        })
      : input.analysis.suggestedReply,
  };
}

function buildOrganizationChoiceReply(integrations: RoutableIntegration[]): string {
  return [
    'Olá! Esse número atende mais de uma empresa. Qual você deseja contatar?',
    '',
    ...integrations.map((integration, index) => `${index + 1}- ${integration.organization.name}`),
  ].join('\n');
}

function isRoutableIntegration(
  integration: IntegrationWithOrganization | null
): integration is RoutableIntegration {
  return Boolean(
    integration?.organizationId && integration.connectedPhone && integration.organization
  );
}

function isLostStageName(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalizeTitle(value);
  return (
    normalized === 'nao_fechou' ||
    normalized.includes('nao fechou') ||
    normalized.includes('perdido') ||
    normalized.includes('perda')
  );
}

function isWonStageName(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalizeTitle(value);
  return (
    normalized === 'fechamento' ||
    normalized.includes('fechamento') ||
    normalized.includes('fechado') ||
    normalized.includes('ganho')
  );
}

function isLostDeal(deal: DealSummary | null): boolean {
  return isLostStageName(deal?.pipelineColumn?.title);
}

function isWonDeal(deal: DealSummary | null): boolean {
  return isWonStageName(deal?.pipelineColumn?.title);
}

function shouldUseExistingDealForMessage(deal: DealSummary | null, message: string): boolean {
  if (!deal || isLostDeal(deal)) return false;
  if (isWonDeal(deal)) return isPaymentStatusQuestion(message);
  return true;
}

function findOrganizationChoice(
  message: string,
  integrations: RoutableIntegration[]
): RoutableIntegration | null {
  const numericChoice = message.trim().match(/^(\d+)(?:\s*[-.)])?$/);
  if (numericChoice) {
    const index = Number(numericChoice[1]) - 1;
    return integrations[index] ?? null;
  }

  const normalized = normalizeTitle(message);
  return (
    integrations.find((integration) =>
      normalized.includes(normalizeTitle(integration.organization.name))
    ) ?? null
  );
}

function rawExternalMessageId(externalMessageId: string): string {
  const [, ...parts] = externalMessageId.split(':');
  return parts.length > 0 ? parts.join(':') : externalMessageId;
}

function inboundDedupeKey(parsed: ParsedBaileysMessage): string {
  return `in:${normalizePhone(parsed.phone)}:${rawExternalMessageId(parsed.externalMessageId)}`;
}

async function findDuplicateInboundMessage(parsed: ParsedBaileysMessage) {
  const deduped = await prisma.whatsAppMessage.findUnique({
    where: { dedupeKey: inboundDedupeKey(parsed) },
    select: { id: true },
  });

  if (deduped) return deduped;

  const exact = await prisma.whatsAppMessage.findUnique({
    where: { externalMessageId: parsed.externalMessageId },
    select: { id: true },
  });

  if (exact) return exact;

  const rawId = rawExternalMessageId(parsed.externalMessageId);
  if (!rawId || rawId === parsed.externalMessageId) return null;

  return prisma.whatsAppMessage.findFirst({
    where: {
      direction: WhatsAppMessageDirection.INBOUND,
      phone: normalizePhone(parsed.phone),
      externalMessageId: {
        endsWith: `:${rawId}`,
      },
    },
    select: { id: true },
  });
}

async function reserveInboundMessage(parsed: ParsedBaileysMessage, organizationId: string) {
  const dedupeKey = inboundDedupeKey(parsed);
  const result = await prisma.whatsAppMessage.createMany({
    data: {
      organizationId,
      externalMessageId: parsed.externalMessageId,
      dedupeKey,
      direction: WhatsAppMessageDirection.INBOUND,
      status: WhatsAppMessageStatus.RECEIVED,
      phone: normalizePhone(parsed.phone),
      contactName: parsed.contactName ?? null,
      text: parsed.text,
    },
    skipDuplicates: true,
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.whatsAppMessage.findUniqueOrThrow({
    where: { dedupeKey },
    select: { id: true },
  });
}

function fallbackAnalysis(
  message: string,
  contactName?: string,
  products: PublicProduct[] = []
): GeminiCrmAnalysis {
  const analysis = analyzeWhatsAppMessage(message);
  if (products.length > 0 && analysis.stage === 'LEAD') {
    const intro = contactName ? `Ola, ${contactName}.` : 'Ola.';
    const productList = products.slice(0, 5).map(numberedProductLine).join('\n');
    return {
      ...analysis,
      nextStep: 'Apresentar os produtos ativos e identificar interesse do cliente.',
      suggestedReply: `${intro} Posso te ajudar sim. Estes são os produtos disponíveis:\n\n${productList}\n\nQual deles te interessa?`,
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
  organizationPixKey?: string | null;
  organizationPixKeyType?: OrganizationPixKeyType | null;
  existingDeal?: (DealSummary & { pipelineColumn: { id: string; title: string } }) | null;
}): Promise<ProcessWhatsAppMessageResult> {
  const analysis = normalizeAnalysisForCrm({
    message: input.message,
    analysis: input.analysis,
    contactName: input.contactName,
    existingDeal: input.existingDeal ?? null,
    organizationPixKey: input.organizationPixKey,
    organizationPixKeyType: input.organizationPixKeyType,
  });
  const targetColumn = columnForStage(input.columns, analysis.stage);
  const notes = buildNotes(input.existingDeal?.notes ?? null, input.message, analysis, new Date());
  const fields = analysis.fields;
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
        stage: analysis.stage,
      },
    });

    return {
      card: toPublicCard(deal),
      analysis,
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
      stage: analysis.stage,
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
    analysis,
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
      pixKey: true,
      pixKeyType: true,
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
  const aiAnalysis = await analyzeConversationWithAi({
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
  const productSelectionAnalysis = normalizeProductSelectionReply({
    message: input.message,
    contactName: input.contactName,
    products,
    analysis: aiAnalysis,
  });
  const analysis = normalizeProductIntroReply({
    organizationName: organization.name,
    contactName: input.contactName,
    products,
    existingDeal,
    analysis: productSelectionAnalysis,
  });

  return applyCrmAction({
    userId,
    organizationId: input.organizationId,
    phone,
    contactName: input.contactName,
    message: input.message,
    analysis,
    columns,
    organizationPixKey: organization.pixKey,
    organizationPixKeyType: organization.pixKeyType,
    existingDeal,
  });
}

export async function getIntegration(userId: string, organizationId: string) {
  await assertMember(userId, organizationId);

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return integration ?? emptyIntegration(organizationId);
}

export async function setupIntegration(userId: string, organizationId: string) {
  await assertOwner(userId, organizationId);

  const existing = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId },
  });

  if (existing) {
    return prisma.whatsAppIntegration.findUniqueOrThrow({
      where: { id: existing.id },
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

  return prisma.whatsAppIntegration.create({
    data: {
      instanceName: integrationInstanceName(organizationId),
      organizationId,
      status: WhatsAppConnectionStatus.NOT_CONFIGURED,
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

export async function connectIntegration(userId: string, organizationId: string) {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId },
  });

  if (!integration) {
    throw new AppError(400, 'WHATSAPP_NOT_CONFIGURED', 'Configure an organization first');
  }

  await assertOwner(userId, organizationId);
  await resetBaileysProvider(integration.instanceName, { clearAuth: true });
  await prisma.whatsAppIntegration.update({
    where: { id: integration.id },
    data: {
      status: WhatsAppConnectionStatus.CONNECTING,
      qrCode: null,
      pairingCode: null,
      connectedPhone: null,
    },
  });

  const connection = await connectBaileysProvider(providerOptions(integration.instanceName));

  return prisma.whatsAppIntegration.update({
    where: { id: integration.id },
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

export async function disconnectIntegration(userId: string, organizationId: string) {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId },
  });

  if (!integration) {
    throw new AppError(400, 'WHATSAPP_NOT_CONFIGURED', 'Configure an organization first');
  }

  await assertOwner(userId, organizationId);
  await resetBaileysProvider(integration.instanceName, { clearAuth: true });

  const connectedPhone = integration.connectedPhone
    ? normalizePhone(integration.connectedPhone)
    : null;
  if (connectedPhone) {
    await prisma.whatsAppRoutingSession.deleteMany({
      where: { connectedPhone },
    });
  }

  logger.info(
    {
      instanceName: integration.instanceName,
      organizationId,
      connectedPhone,
    },
    'WhatsApp integration disconnected'
  );

  return prisma.whatsAppIntegration.update({
    where: { id: integration.id },
    data: {
      status: WhatsAppConnectionStatus.DISCONNECTED,
      qrCode: null,
      pairingCode: null,
      connectedPhone: null,
      lastConnectedAt: null,
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

export async function refreshIntegrationStatus(userId: string, organizationId: string) {
  const integration = await getIntegration(userId, organizationId);
  if (!integration.id) return integration;

  const connection = getBaileysProviderInfo(integration.instanceName);
  if (
    env.WHATSAPP_PROVIDER !== 'baileys' ||
    connection.status === WhatsAppConnectionStatus.NOT_CONFIGURED
  ) {
    return integration;
  }

  return prisma.whatsAppIntegration.update({
    where: { id: integration.id },
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

type OrganizationRouteDecision =
  | {
      type: 'process';
      integration: RoutableIntegration;
      selectedByLead: boolean;
    }
  | {
      type: 'awaiting_organization_choice';
    };

async function sendInboundReply(
  parsed: ParsedBaileysMessage,
  options: ProcessInboundOptions,
  text: string
): Promise<void> {
  const sendText =
    options.sendText ??
    ((recipient: string, reply: string) => sendBaileysText(parsed.instanceName, recipient, reply));

  await sendText(parsed.replyJid, text);
}

async function listSharedRoutableIntegrations(
  sourceIntegration: IntegrationWithOrganization
): Promise<RoutableIntegration[]> {
  if (!isRoutableIntegration(sourceIntegration)) return [];

  const connectedPhone = normalizePhone(sourceIntegration.connectedPhone);
  const integrations = await prisma.whatsAppIntegration.findMany({
    where: {
      status: WhatsAppConnectionStatus.CONNECTED,
      organizationId: { not: null },
      connectedPhone: { not: null },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          niche: true,
          pixKey: true,
          pixKeyType: true,
        },
      },
    },
  });

  return integrations
    .filter(isRoutableIntegration)
    .filter((integration) => normalizePhone(integration.connectedPhone) === connectedPhone)
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name, 'pt-BR'));
}

async function findActiveIntegrationForLead(
  integrations: RoutableIntegration[],
  leadPhone: string,
  message: string
): Promise<RoutableIntegration | null> {
  const activeDeals = await Promise.all(
    integrations.map(async (integration) => {
      const deal = await findDealByPhone(integration.organizationId, leadPhone);
      if (!deal) return null;
      if (!shouldUseExistingDealForMessage(deal, message)) return null;

      return {
        integration,
        updatedAt: deal.updatedAt,
      };
    })
  );

  const newestDeal = activeDeals
    .filter((item): item is { integration: RoutableIntegration; updatedAt: Date } => Boolean(item))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

  if (newestDeal) return newestDeal.integration;
  return null;
}

async function reserveOrganizationChoicePrompt(input: {
  connectedPhone: string;
  leadPhone: string;
  promptedAt: Date;
}): Promise<boolean> {
  const created = await prisma.whatsAppRoutingSession.createMany({
    data: {
      connectedPhone: input.connectedPhone,
      leadPhone: input.leadPhone,
      lastPromptAt: input.promptedAt,
    },
    skipDuplicates: true,
  });

  if (created.count === 1) return true;

  const promptBefore = new Date(
    input.promptedAt.getTime() - ORGANIZATION_CHOICE_PROMPT_COOLDOWN_MS
  );
  const refreshed = await prisma.whatsAppRoutingSession.updateMany({
    where: {
      connectedPhone: input.connectedPhone,
      leadPhone: input.leadPhone,
      OR: [{ lastPromptAt: null }, { lastPromptAt: { lt: promptBefore } }],
    },
    data: {
      selectedOrganizationId: null,
      lastPromptAt: input.promptedAt,
    },
  });

  return refreshed.count === 1;
}

function logIgnoredInboundMessage(
  parsed: ParsedBaileysMessage,
  reason: string,
  extra: Record<string, unknown> = {}
): void {
  logger.info(
    {
      instanceName: parsed.instanceName,
      externalMessageId: parsed.externalMessageId,
      phone: normalizePhone(parsed.phone),
      text: logTextPreview(parsed.text),
      reason,
      ...extra,
    },
    'WhatsApp inbound message ignored'
  );
}

async function resolveInboundOrganizationRoute(
  parsed: ParsedBaileysMessage,
  sourceIntegration: IntegrationWithOrganization,
  options: ProcessInboundOptions
): Promise<OrganizationRouteDecision> {
  if (!isRoutableIntegration(sourceIntegration)) {
    if (sourceIntegration.organizationId && sourceIntegration.organization) {
      return {
        type: 'process',
        integration: {
          ...sourceIntegration,
          organizationId: sourceIntegration.organizationId,
          connectedPhone: sourceIntegration.connectedPhone ?? '',
          organization: sourceIntegration.organization,
        },
        selectedByLead: false,
      };
    }

    return { type: 'awaiting_organization_choice' };
  }

  const sharedIntegrations = await listSharedRoutableIntegrations(sourceIntegration);
  if (sharedIntegrations.length <= 1) {
    return {
      type: 'process',
      integration: sourceIntegration,
      selectedByLead: false,
    };
  }

  const activeIntegration = await findActiveIntegrationForLead(
    sharedIntegrations,
    parsed.phone,
    parsed.text
  );
  if (activeIntegration) {
    return {
      type: 'process',
      integration: activeIntegration,
      selectedByLead: false,
    };
  }

  const connectedPhone = normalizePhone(sourceIntegration.connectedPhone);
  const leadPhone = normalizePhone(parsed.phone);
  const routingKey = {
    connectedPhone_leadPhone: {
      connectedPhone,
      leadPhone,
    },
  };
  const pending = await prisma.whatsAppRoutingSession.findUnique({
    where: routingKey,
  });
  const selectedIntegration = pending
    ? findOrganizationChoice(parsed.text, sharedIntegrations)
    : null;

  if (selectedIntegration) {
    await prisma.whatsAppRoutingSession.deleteMany({
      where: {
        connectedPhone,
        leadPhone,
      },
    });

    logger.info(
      {
        instanceName: parsed.instanceName,
        connectedPhone,
        leadPhone,
        organizationId: selectedIntegration.organizationId,
        organizationName: selectedIntegration.organization.name,
        text: logTextPreview(parsed.text),
      },
      'WhatsApp lead selected organization'
    );

    return {
      type: 'process',
      integration: selectedIntegration,
      selectedByLead: true,
    };
  }

  const now = new Date();
  const shouldSendPrompt = await reserveOrganizationChoicePrompt({
    connectedPhone,
    leadPhone,
    promptedAt: now,
  });

  if (shouldSendPrompt) {
    await sendInboundReply(parsed, options, buildOrganizationChoiceReply(sharedIntegrations));
    logger.info(
      {
        instanceName: parsed.instanceName,
        connectedPhone,
        leadPhone,
        organizations: sharedIntegrations.map((integration) => ({
          id: integration.organizationId,
          name: integration.organization.name,
        })),
      },
      'WhatsApp organization choice prompt sent'
    );
  } else {
    logger.info(
      {
        instanceName: parsed.instanceName,
        connectedPhone,
        leadPhone,
        text: logTextPreview(parsed.text),
      },
      'WhatsApp organization choice prompt skipped by cooldown'
    );
  }

  return { type: 'awaiting_organization_choice' };
}

export async function processInboundWhatsAppMessage(
  parsed: ParsedBaileysMessage,
  options: ProcessInboundOptions = {}
) {
  logger.info(
    {
      instanceName: parsed.instanceName,
      externalMessageId: parsed.externalMessageId,
      phone: normalizePhone(parsed.phone),
      text: logTextPreview(parsed.text),
    },
    'WhatsApp inbound message received'
  );

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { instanceName: parsed.instanceName },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          niche: true,
          pixKey: true,
          pixKeyType: true,
        },
      },
    },
  });

  if (!integration?.organizationId) {
    logIgnoredInboundMessage(parsed, 'integration_not_configured');
    return { ignored: true, reason: 'integration_not_configured' };
  }

  if (!isPhoneAllowedForAutomaticWhatsApp(parsed.phone)) {
    logIgnoredInboundMessage(parsed, 'phone_not_allowed', {
      organizationId: integration.organizationId,
    });
    return { ignored: true, reason: 'phone_not_allowed' };
  }

  await prisma.whatsAppIntegration.update({
    where: { instanceName: parsed.instanceName },
    data: { lastWebhookAt: new Date() },
  });

  const existingMessage = await findDuplicateInboundMessage(parsed);

  if (existingMessage) {
    logIgnoredInboundMessage(parsed, 'duplicate_message', {
      organizationId: integration.organizationId,
    });
    return { ignored: true, reason: 'duplicate_message' };
  }

  const route = await resolveInboundOrganizationRoute(parsed, integration, options);
  if (route.type === 'awaiting_organization_choice') {
    logIgnoredInboundMessage(parsed, 'awaiting_organization_choice', {
      sourceOrganizationId: integration.organizationId,
    });
    return { ignored: true, reason: 'awaiting_organization_choice' };
  }

  const targetIntegration = route.integration;
  const targetOrganizationId = targetIntegration.organizationId;
  const inboundMessage = await reserveInboundMessage(parsed, targetOrganizationId);
  if (!inboundMessage) {
    logIgnoredInboundMessage(parsed, 'duplicate_message', {
      organizationId: targetOrganizationId,
    });
    return { ignored: true, reason: 'duplicate_message' };
  }

  const organization =
    targetIntegration.organization ?? (await loadOrganization(targetOrganizationId));
  const columns = await listColumns(targetOrganizationId);
  const products = await listActiveProductsForOrganization(targetOrganizationId);
  const foundDeal = await findDealByPhone(targetOrganizationId, parsed.phone);
  const existingDeal = shouldUseExistingDealForMessage(foundDeal, parsed.text) ? foundDeal : null;
  const paymentApprovedByManualMove =
    existingDeal && isWonDeal(existingDeal) && isPaymentStatusQuestion(parsed.text);
  let aiError: string | null = null;
  const rawAnalysis = paymentApprovedByManualMove
    ? buildPaymentApprovedAnalysis({
        contactName: parsed.contactName ?? existingDeal.contactName,
        existingDeal,
      })
    : route.selectedByLead
      ? {
          stage: 'LEAD' as const,
          summary: `Cliente escolheu falar com ${organization.name}.`,
          nextStep: 'Apresentar os produtos ativos e identificar interesse do cliente.',
          suggestedReply: buildProductChoiceReply({
            organizationName: organization.name,
            contactName: parsed.contactName,
            products,
          }),
          fields: parsed.contactName ? { contactName: parsed.contactName } : {},
        }
      : await analyzeConversationWithAi({
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
          logger.warn(
            {
              instanceName: parsed.instanceName,
              externalMessageId: parsed.externalMessageId,
              organizationId: targetOrganizationId,
              err: error,
            },
            'WhatsApp AI analysis failed; using fallback'
          );
          return fallbackAnalysis(parsed.text, parsed.contactName, products);
        });
  const productSelectionAnalysis = route.selectedByLead
    ? rawAnalysis
    : normalizeProductSelectionReply({
        message: parsed.text,
        contactName: parsed.contactName,
        products,
        analysis: rawAnalysis,
      });
  const analysis = normalizeProductIntroReply({
    organizationName: organization.name,
    contactName: parsed.contactName,
    products,
    existingDeal,
    analysis: productSelectionAnalysis,
  });

  const crmResult = await applyCrmAction({
    userId: null,
    organizationId: targetOrganizationId,
    phone: parsed.phone,
    contactName: parsed.contactName,
    message: parsed.text,
    analysis,
    columns,
    organizationPixKey: organization.pixKey,
    organizationPixKeyType: organization.pixKeyType,
    existingDeal,
  });
  const crmAnalysis = crmResult.analysis as GeminiCrmAnalysis;

  const conversation = await prisma.whatsAppConversation.upsert({
    where: {
      organizationId_phone: {
        organizationId: targetOrganizationId,
        phone: parsed.phone,
      },
    },
    create: {
      organizationId: targetOrganizationId,
      phone: parsed.phone,
      contactName: crmAnalysis.fields.contactName ?? parsed.contactName ?? null,
      dealId: crmResult.card.id,
      stage: crmAnalysis.stage,
      summary: crmAnalysis.summary,
      nextStep: crmAnalysis.nextStep,
      lastReply: crmAnalysis.suggestedReply,
      lastMessageAt: new Date(),
    },
    update: {
      contactName: crmAnalysis.fields.contactName ?? parsed.contactName ?? undefined,
      dealId: crmResult.card.id,
      stage: crmAnalysis.stage,
      summary: crmAnalysis.summary,
      nextStep: crmAnalysis.nextStep,
      lastReply: crmAnalysis.suggestedReply,
      lastMessageAt: new Date(),
    },
  });

  await prisma.whatsAppMessage.update({
    where: { id: inboundMessage.id },
    data: {
      conversationId: conversation.id,
      analysis: crmAnalysis as unknown as Prisma.InputJsonValue,
      responseText: crmAnalysis.suggestedReply,
      error: aiError,
    },
  });

  try {
    await sendInboundReply(parsed, options, crmAnalysis.suggestedReply);
    logger.info(
      {
        instanceName: parsed.instanceName,
        externalMessageId: parsed.externalMessageId,
        organizationId: targetOrganizationId,
        conversationId: conversation.id,
        cardId: crmResult.card.id,
        stage: crmAnalysis.stage,
        reply: logTextPreview(crmAnalysis.suggestedReply),
      },
      'WhatsApp reply sent'
    );
    await prisma.whatsAppMessage.create({
      data: {
        organizationId: targetOrganizationId,
        conversationId: conversation.id,
        externalMessageId: `out:${parsed.externalMessageId}`,
        direction: WhatsAppMessageDirection.OUTBOUND,
        status: WhatsAppMessageStatus.SENT,
        phone: parsed.phone,
        contactName: parsed.contactName ?? null,
        text: crmAnalysis.suggestedReply,
      },
    });
  } catch (error) {
    logger.warn(
      {
        instanceName: parsed.instanceName,
        externalMessageId: parsed.externalMessageId,
        organizationId: targetOrganizationId,
        conversationId: conversation.id,
        err: error,
      },
      'WhatsApp reply failed'
    );
    await prisma.whatsAppMessage.create({
      data: {
        organizationId: targetOrganizationId,
        conversationId: conversation.id,
        externalMessageId: `out:${parsed.externalMessageId}`,
        direction: WhatsAppMessageDirection.OUTBOUND,
        status: WhatsAppMessageStatus.FAILED,
        phone: parsed.phone,
        contactName: parsed.contactName ?? null,
        text: crmAnalysis.suggestedReply,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return {
    ignored: false,
    card: crmResult.card,
    analysis: crmAnalysis,
    conversationId: conversation.id,
  };
}

export async function notifyWhatsAppPaymentApprovedForDeal(dealId: string): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      organization: {
        select: {
          whatsappIntegration: true,
        },
      },
      whatsappConversations: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
  });

  const conversation = deal?.whatsappConversations[0] ?? null;
  const integration = deal?.organization.whatsappIntegration ?? null;

  if (!deal || !conversation || !integration?.connectedPhone) {
    logger.info(
      { dealId },
      'WhatsApp payment approval notification skipped without conversation or integration'
    );
    return;
  }

  if (integration.status !== WhatsAppConnectionStatus.CONNECTED) {
    logger.info(
      {
        dealId,
        organizationId: deal.organizationId,
        integrationStatus: integration.status,
      },
      'WhatsApp payment approval notification skipped because integration is not connected'
    );
    return;
  }

  const contactName = conversation.contactName ?? deal.contactName;
  const text = buildPaymentApprovedReply(contactName);
  const externalMessageId = `out:payment-approved:${deal.id}:${randomUUID()}`;
  let status: WhatsAppMessageStatus = WhatsAppMessageStatus.SENT;
  let errorMessage: string | null = null;

  try {
    await sendBaileysText(integration.instanceName, conversation.phone, text);
    logger.info(
      {
        dealId,
        organizationId: deal.organizationId,
        conversationId: conversation.id,
        instanceName: integration.instanceName,
        phone: normalizePhone(conversation.phone),
      },
      'WhatsApp payment approval notification sent'
    );
  } catch (error) {
    status = WhatsAppMessageStatus.FAILED;
    errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      {
        dealId,
        organizationId: deal.organizationId,
        conversationId: conversation.id,
        instanceName: integration.instanceName,
        phone: normalizePhone(conversation.phone),
        err: error,
      },
      'WhatsApp payment approval notification failed'
    );
  }

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: {
      stage: 'FECHAMENTO',
      summary: 'Pagamento confirmado pela empresa.',
      nextStep: 'Encerrar esta negociação e iniciar um novo atendimento no próximo contato.',
      lastReply: text,
      lastMessageAt: new Date(),
    },
  });

  await prisma.whatsAppMessage.create({
    data: {
      organizationId: deal.organizationId,
      conversationId: conversation.id,
      externalMessageId,
      direction: WhatsAppMessageDirection.OUTBOUND,
      status,
      phone: conversation.phone,
      contactName,
      text,
      error: errorMessage,
    },
  });
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

  const integrations = await prisma.whatsAppIntegration.findMany({
    where: {
      status: WhatsAppConnectionStatus.CONNECTED,
      connectedPhone: {
        not: null,
      },
      organizationId: {
        not: null,
      },
    },
  });

  logger.info(
    { count: integrations.length },
    'Starting configured connected WhatsApp integrations'
  );

  await Promise.all(
    integrations.map((integration) =>
      startBaileysProvider(providerOptions(integration.instanceName))
    )
  );
}
