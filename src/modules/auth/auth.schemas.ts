import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200).trim(),
  organizationName: z.string().min(1).max(200).trim(),
});

export const loginBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
