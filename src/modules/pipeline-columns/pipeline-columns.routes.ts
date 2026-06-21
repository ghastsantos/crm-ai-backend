import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as pipelineColumnsController from './pipeline-columns.controller';

export const pipelineColumnsRoutes = Router();

/**
 * @openapi
 * /api/v1/pipeline-columns:
 *   get:
 *     summary: List pipeline columns for an organization
 *     tags: [PipelineColumns]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ordered columns
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 */
pipelineColumnsRoutes.get(
  '/',
  authenticate,
  asyncHandler(pipelineColumnsController.getPipelineColumns)
);

/**
 * @openapi
 * /api/v1/pipeline-columns/{id}:
 *   patch:
 *     summary: Update a pipeline column
 *     tags: [PipelineColumns]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               position:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Column updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 *       404:
 *         description: Column not found
 */
pipelineColumnsRoutes.patch(
  '/:id',
  authenticate,
  asyncHandler(pipelineColumnsController.patchPipelineColumn)
);

/**
 * @openapi
 * /api/v1/pipeline-columns/{id}:
 *   delete:
 *     summary: Delete a pipeline column
 *     tags: [PipelineColumns]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: moveToColumnId
 *         schema:
 *           type: string
 *         description: Required when column has deals
 *     responses:
 *       204:
 *         description: Column deleted
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 *       404:
 *         description: Column not found
 *       409:
 *         description: Column has deals and moveToColumnId missing
 */
pipelineColumnsRoutes.delete(
  '/:id',
  authenticate,
  asyncHandler(pipelineColumnsController.deletePipelineColumn)
);
