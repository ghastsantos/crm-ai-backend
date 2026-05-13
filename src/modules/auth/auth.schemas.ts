import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200).trim(),
  organizationName: z.string().min(1).max(200).trim(),
  organizationNiche: z.string().min(1).max(120).trim(),
});

export const loginBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export const updateMeBodySchema = z
  .object({
    name: z.string().min(2).max(200).trim().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
