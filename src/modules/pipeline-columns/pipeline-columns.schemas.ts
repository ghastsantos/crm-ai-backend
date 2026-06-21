import { z } from 'zod';

export const listPipelineColumnsQuerySchema = z.object({
  organizationId: z.string().min(1),
});

export const updatePipelineColumnBodySchema = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    position: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const pipelineColumnIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const deletePipelineColumnQuerySchema = z.object({
  moveToColumnId: z.string().min(1).optional(),
});

export type ListPipelineColumnsQuery = z.infer<typeof listPipelineColumnsQuerySchema>;
export type UpdatePipelineColumnBody = z.infer<typeof updatePipelineColumnBodySchema>;
