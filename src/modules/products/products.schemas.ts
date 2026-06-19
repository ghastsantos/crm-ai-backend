import { z } from 'zod';

const priceSchema = z.coerce.number().positive().max(1_000_000_000);

export const listProductsQuerySchema = z.object({
  organizationId: z.string().min(1),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const createProductBodySchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(160).trim(),
  description: z.string().max(500).trim().optional(),
  price: priceSchema,
  active: z.boolean().optional(),
});

export const updateProductBodySchema = z
  .object({
    name: z.string().min(1).max(160).trim().optional(),
    description: z.string().max(500).trim().nullable().optional(),
    price: priceSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const productIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductBody = z.infer<typeof createProductBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
export type ProductIdParams = z.infer<typeof productIdParamsSchema>;
