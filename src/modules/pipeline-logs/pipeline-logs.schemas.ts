import { PipelineLogAction } from '@prisma/client';
import { z } from 'zod';

export const listPipelineLogsQuerySchema = z.object({
  organizationId: z.string().min(1),
  action: z.nativeEnum(PipelineLogAction).optional(),
  search: z.string().max(200).trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type ListPipelineLogsQuery = z.infer<typeof listPipelineLogsQuerySchema>;
