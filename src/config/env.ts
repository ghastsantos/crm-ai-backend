import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  CORS_ORIGINS: z.string().optional(),
  AI_SERVICE_URL: z.union([z.string().url(), z.literal('')]).optional(),
  EVOLUTION_API_URL: z.union([z.string().url(), z.literal('')]).optional(),
  EVOLUTION_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
