import { z } from 'zod';

export const organizationIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const createOrganizationBodySchema = z.object({
  name: z.string().min(1).max(200).trim(),
});

export const updateOrganizationBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type OrganizationIdParams = z.infer<typeof organizationIdParamsSchema>;
export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;
export type UpdateOrganizationBody = z.infer<typeof updateOrganizationBodySchema>;
