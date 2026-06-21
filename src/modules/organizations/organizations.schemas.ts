import { OrganizationPixKeyType, OrganizationRole } from '@prisma/client';
import { z } from 'zod';

export const organizationIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const createOrganizationBodySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  niche: z.string().min(1).max(120).trim(),
});

export const updateOrganizationBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    niche: z.string().min(1).max(120).trim().optional(),
    pixKey: z
      .preprocess(
        (value) => (value === '' ? null : value),
        z.union([z.string().min(1).max(200).trim(), z.null()])
      )
      .optional(),
    pixKeyType: z.nativeEnum(OrganizationPixKeyType).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const createOrganizationUserBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200).trim(),
  role: z.nativeEnum(OrganizationRole).default(OrganizationRole.MEMBER),
});

export type OrganizationIdParams = z.infer<typeof organizationIdParamsSchema>;
export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;
export type UpdateOrganizationBody = z.infer<typeof updateOrganizationBodySchema>;
export type CreateOrganizationUserBody = z.infer<typeof createOrganizationUserBodySchema>;
