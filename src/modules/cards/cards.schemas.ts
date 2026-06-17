import { z } from 'zod';

export const createCardBodySchema = z.object({
  title: z.string().min(1).max(200).trim(),
  pipelineColumnId: z.string().min(1),
  value: z.number().positive().optional(),
  organizationId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  companyName: z.string().max(200).trim().optional(),
  contactName: z.string().max(200).trim().optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(50).trim().optional(),
  notes: z.string().max(2000).trim().optional(),
});

export const updateCardBodySchema = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    pipelineColumnId: z.string().min(1).optional(),
    value: z.union([z.number().positive(), z.null()]).optional(),
    contactId: z.string().min(1).optional().nullable(),
    companyName: z.string().max(200).trim().optional().nullable(),
    contactName: z.string().max(200).trim().optional().nullable(),
    email: z.string().email().max(320).optional().nullable(),
    phone: z.string().max(50).trim().optional().nullable(),
    notes: z.string().max(2000).trim().optional().nullable(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const moveCardBodySchema = z.object({
  pipelineColumnId: z.string().min(1),
  position: z.number().int().min(0).max(1_000_000).optional(),
});

export const listCardsQuerySchema = z.object({
  organizationId: z.string().min(1),
  pipelineColumnId: z.string().min(1).optional(),
});

export type CreateCardBody = z.infer<typeof createCardBodySchema>;
export type UpdateCardBody = z.infer<typeof updateCardBodySchema>;
export type MoveCardBody = z.infer<typeof moveCardBodySchema>;
export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;
