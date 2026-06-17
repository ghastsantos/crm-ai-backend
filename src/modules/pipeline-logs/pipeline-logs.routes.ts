import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as pipelineLogsController from './pipeline-logs.controller';

export const pipelineLogsRoutes = Router();

/**
 * @openapi
 * /api/v1/pipeline-logs:
 *   get:
 *     summary: List pipeline logs
 *     tags: [Pipeline Logs]
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
 *         name: action
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - DEAL_CREATED
 *             - DEAL_MOVED
 *             - DEAL_UPDATED
 *             - DEAL_ARCHIVED
 *             - DEAL_DELETED
 *             - OWNER_CHANGED
 *             - COLUMN_CREATED
 *             - COLUMN_UPDATED
 *             - COLUMN_DELETED
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *     responses:
 *       200:
 *         description: List of pipeline logs
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
pipelineLogsRoutes.get('/', authenticate, asyncHandler(pipelineLogsController.getPipelineLogs));
