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
  /** Número de proxies confiáveis (ex.: 1 atrás de Nginx). 0 = desligado. Necessário para rate limit por IP correto. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(32).default(0),
  /** Swagger em /api-docs. Em produção recomenda-se false. */
  API_DOCS_ENABLED: z
    .string()
    .optional()
    .transform((v) => {
      if (v == null || v === '') return true;
      const s = v.toLowerCase();
      return s !== 'false' && s !== '0';
    }),
  AI_SERVICE_URL: z.union([z.string().url(), z.literal('')]).optional(),
  EVOLUTION_API_URL: z.union([z.string().url(), z.literal('')]).optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  AUTH_HTTPONLY_COOKIE_ENABLED: z
    .string()
    .optional()
    .transform((v) => {
      if (v == null || v === '') return true;
      return v !== 'false' && v !== '0';
    }),
  AUTH_COOKIE_NAME: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : 'crm_access_token')),
  AUTH_TOKEN_IN_BODY: z
    .string()
    .optional()
    .transform((v) => {
      if (v == null || v === '') return true;
      return v !== 'false' && v !== '0';
    }),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  /** Mitigação CSRF com cookies: exige header Origin em métodos mutáveis sob /api/v1 (ativar em produção com SPA conhecida). */
  AUTH_ENFORCE_ORIGIN_ON_MUTATIONS: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
