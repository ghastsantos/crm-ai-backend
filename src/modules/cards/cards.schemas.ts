import { z } from 'zod';

const DEAL_STAGES = [
  'LEAD_CAPTADO',
  'QUALIFICACAO_MQL_ICP',
  'CONTATO_INICIAL',
  'PROPOSTA',
  'NEGOCIACAO',
  'FECHAMENTO',
] as const;

export const createCardBodySchema = z.object({
  title: z.string().min(1).max(200).trim(),
  stage: z.enum(DEAL_STAGES).optional(),
  value: z.number().positive().optional(),
  organizationId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  companyName: z.string().max(200).trim().optional(),
  contactName: z.string().max(200).trim().optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(50).trim().optional(),
  notes: z.string().max(500).trim().optional(),
});

export const updateCardBodySchema = createCardBodySchema
  .omit({ organizationId: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const moveCardBodySchema = z.object({
  stage: z.enum(DEAL_STAGES),
});

export const listCardsQuerySchema = z.object({
  organizationId: z.string().min(1),
  stage: z.enum(DEAL_STAGES).optional(),
});

export type CreateCardBody = z.infer<typeof createCardBodySchema>;
export type UpdateCardBody = z.infer<typeof updateCardBodySchema>;
export type MoveCardBody = z.infer<typeof moveCardBodySchema>;
export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;
