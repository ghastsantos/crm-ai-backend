import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS is required (comma-separated origins, no wildcard)')
    .refine(
      (s) => s.split(',').some((o) => o.trim().length > 0),
      'CORS_ORIGINS must include at least one origin'
    ),
  AI_SERVICE_URL: z.union([z.string().url(), z.literal('')]).optional(),
  EVOLUTION_API_URL: z.union([z.string().url(), z.literal('')]).optional(),
  EVOLUTION_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
