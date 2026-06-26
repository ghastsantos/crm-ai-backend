import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as metricsController from './metrics.controller';

export const metricsRoutes = Router();

/**
 * @openapi
 * /api/v1/metrics/overview:
 *   get:
 *     summary: Get organization metrics overview
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: rangeDays
 *         required: false
 *         schema:
 *           type: integer
 *           enum: [7, 14, 30, 90]
 *     responses:
 *       200:
 *         description: Metrics overview
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
metricsRoutes.get('/overview', authenticate, asyncHandler(metricsController.getMetricsOverview));
