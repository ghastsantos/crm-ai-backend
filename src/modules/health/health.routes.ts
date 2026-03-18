import { Router } from 'express';
import { getReadiness } from './health.controller';

export const healthRoutes = Router();

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     summary: Health check (readiness)
 *     description: Verifica conectividade com banco de dados e dependências
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Serviço saudável
 *       503:
 *         description: Dependência indisponível
 */
healthRoutes.get('/', getReadiness);
