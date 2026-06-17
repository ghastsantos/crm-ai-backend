import { z } from 'zod';
import { env } from '@/config/env';
import {
  analyzeWhatsAppMessage,
  type WhatsAppMessageAnalysis,
  type WhatsAppPipelineStage,
} from './whatsapp-assistant';

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.string().min(1).max(max).optional()
  );

const crmFieldsSchema = z.object({
  contactName: optionalText(200),
  companyName: optionalText(200),
  email: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.string().email().optional()
  ),
  dealValue: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.coerce.number().positive().optional()
  ),
});

const geminiAnalysisSchema = z.object({
  stage: z.enum(['LEAD', 'QUALIFICACAO', 'EM_NEGOCIACAO', 'FECHAMENTO', 'NAO_FECHOU']),
  summary: z.string().min(1).max(500),
  nextStep: z.string().min(1).max(500),
  suggestedReply: z.string().min(1).max(1000),
  fields: crmFieldsSchema.default({}),
});

export type GeminiCrmAnalysis = WhatsAppMessageAnalysis & {
  fields: z.infer<typeof crmFieldsSchema>;
};

export type AnalyzeConversationInput = {
  organizationName: string;
  organizationNiche: string;
  customerMessage: string;
  contactName?: string;
  products?: Array<{
    name: string;
    description: string | null;
    price: string;
  }>;
  existingDeal?: {
    title: string;
    notes: string | null;
    stage: string;
  } | null;
  pipelineStages: string[];
};

function stripMarkdownJson(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatPrice(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `R$ ${value}`;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numeric);
}

function formatProductLine(product: NonNullable<AnalyzeConversationInput['products']>[number]) {
  const description = product.description ? ` - ${product.description}` : '';
  return `${product.name} (${formatPrice(product.price)})${description}`;
}

function findMentionedProduct(input: AnalyzeConversationInput) {
  const text = normalizeText(input.customerMessage);
  return input.products?.find((product) => text.includes(normalizeText(product.name)));
}

function productIntroReply(input: AnalyzeConversationInput): string | null {
  const products = input.products?.slice(0, 5) ?? [];
  if (products.length === 0) return null;

  const intro = input.contactName ? `Ola, ${input.contactName}.` : 'Ola.';
  const list = products.map(formatProductLine).join('; ');
  return `${intro} Posso te ajudar sim. Hoje trabalhamos com: ${list}. Qual desses produtos te interessa mais?`;
}

export function parseGeminiAnalysisText(value: string): GeminiCrmAnalysis {
  try {
    const parsed = JSON.parse(stripMarkdownJson(value));
    return geminiAnalysisSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Invalid Gemini analysis: ${error instanceof Error ? error.message : error}`);
  }
}

function buildPrompt(input: AnalyzeConversationInput): string {
  return [
    'Voce e um atendente comercial de WhatsApp integrado a um CRM.',
    'Responda somente com JSON valido, sem markdown.',
    'Use uma das etapas: LEAD, QUALIFICACAO, EM_NEGOCIACAO, FECHAMENTO, NAO_FECHOU.',
    'Classifique a conversa e gere uma resposta curta, natural e profissional em portugues do Brasil.',
    'Quando houver produtos ativos, conduza o atendimento para entender qual produto o cliente quer comprar.',
    'Se o cliente ainda nao informou o produto, apresente as opcoes ativas com preco e pergunte qual interessa.',
    'Se o cliente mencionar um produto ativo, foque nele e avance a qualificacao.',
    'Extraia campos somente quando aparecerem claramente na mensagem.',
    '',
    `Empresa: ${input.organizationName}`,
    `Nicho: ${input.organizationNiche}`,
    `Etapas do pipeline: ${input.pipelineStages.join(', ')}`,
    input.products?.length
      ? `Produtos ativos: ${input.products.map(formatProductLine).join(' | ')}`
      : 'Produtos ativos: nenhum cadastrado',
    input.contactName ? `Nome conhecido: ${input.contactName}` : 'Nome conhecido: nao informado',
    input.existingDeal
      ? `Negociacao atual: ${input.existingDeal.title} | etapa ${input.existingDeal.stage} | notas ${input.existingDeal.notes ?? ''}`
      : 'Negociacao atual: nenhuma',
    '',
    `Mensagem do cliente: ${input.customerMessage}`,
    '',
    'Formato obrigatorio:',
    '{"stage":"LEAD","summary":"...","nextStep":"...","suggestedReply":"...","fields":{"contactName":"...","companyName":"...","email":"...","dealValue":123.45}}',
  ].join('\n');
}

function localFallback(input: AnalyzeConversationInput): GeminiCrmAnalysis {
  const analysis = analyzeWhatsAppMessage(input.customerMessage);
  const mentionedProduct = findMentionedProduct(input);

  if (mentionedProduct) {
    return {
      stage: 'QUALIFICACAO',
      summary: `Cliente demonstrou interesse em ${mentionedProduct.name}.`,
      nextStep: 'Entender necessidade, prazo e confirmar se o produto atende o cliente.',
      suggestedReply: `${input.contactName ? `Ola, ${input.contactName}. ` : ''}${mentionedProduct.name} custa ${formatPrice(
        mentionedProduct.price
      )}. Me conta o que voce quer resolver para eu te orientar melhor?`,
      fields: {
        ...(input.contactName ? { contactName: input.contactName } : {}),
        dealValue: Number(mentionedProduct.price),
      },
    };
  }

  const introReply = productIntroReply(input);
  if (introReply && analysis.stage === 'LEAD') {
    return {
      ...analysis,
      nextStep: 'Apresentar os produtos ativos e identificar interesse do cliente.',
      suggestedReply: introReply,
      fields: input.contactName ? { contactName: input.contactName } : {},
    };
  }

  return {
    ...analysis,
    fields: input.contactName ? { contactName: input.contactName } : {},
  };
}

function geminiUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
}

function readGeminiText(payload: unknown): string {
  const root = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = root.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) throw new Error('Gemini response did not include text');
  return text;
}

export async function analyzeConversationWithAi(
  input: AnalyzeConversationInput
): Promise<GeminiCrmAnalysis> {
  if (env.AI_PROVIDER !== 'gemini' || !env.GEMINI_API_KEY) {
    return localFallback(input);
  }

  const response = await fetch(geminiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with ${response.status}`);
  }

  const text = readGeminiText(await response.json());
  return parseGeminiAnalysisText(text);
}

export function stageFromAnalysis(analysis: WhatsAppMessageAnalysis): WhatsAppPipelineStage {
  return analysis.stage;
}
