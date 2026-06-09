import { z } from 'zod';

export const createAutoriaNoteSchema = z.object({
  texto: z.string().trim().min(1).max(200),
  organizationId: z.string().min(1),
});

export const updateAutoriaNoteSchema = z.object({
  texto: z.string().trim().min(1).max(200),
});

export const listAutoriaNotesSchema = z.object({
  organizationId: z.string().min(1),
});

export type CreateAutoriaNoteInput = z.infer<typeof createAutoriaNoteSchema>;
export type UpdateAutoriaNoteInput = z.infer<typeof updateAutoriaNoteSchema>;
export type ListAutoriaNotesInput = z.infer<typeof listAutoriaNotesSchema>;
