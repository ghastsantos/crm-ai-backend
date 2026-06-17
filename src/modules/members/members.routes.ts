import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as controller from './members.controller';

export const membersRoutes = Router();

/**
 * @openapi
 * /api/v1/members:
 *   get:
 *     summary: List organization members
 *     tags: [Members]
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
 *         description: List of organization members
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
membersRoutes.get('/', authenticate, asyncHandler(controller.listar));

/**
 * @openapi
 * /api/v1/members:
 *   post:
 *     summary: Create organization member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, name, email, password]
 *             properties:
 *               organizationId:
 *                 type: string
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 320
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *     responses:
 *       201:
 *         description: Organization member created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       409:
 *         description: Email already in use
 */
membersRoutes.post('/', authenticate, asyncHandler(controller.criar));

/**
 * @openapi
 * /api/v1/members/{id}:
 *   delete:
 *     summary: Remove organization member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Organization member removed
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member not found
 */
membersRoutes.delete('/:id', authenticate, asyncHandler(controller.excluir));
