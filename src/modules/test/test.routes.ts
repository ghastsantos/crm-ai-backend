import { Router } from 'express';
import { getTest } from './test.controller';

export const testRoutes = Router();

/**
 * @openapi
 * /api/v1/test:
 *   get:
 *     summary: Smoke test
 *     description: Endpoint de teste para validar que a API está respondendo
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: API operacional
 */
testRoutes.get('/', getTest);
