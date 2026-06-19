import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as membersController from './members.controller';

const membersRoutes = Router();

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
 *       403:
 *         description: Access denied
 */
membersRoutes.get('/', authenticate, asyncHandler(membersController.getMembers));

/**
 * @openapi
 * /api/v1/members:
 *   post:
 *     summary: Create an organization member
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
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               role:
 *                 type: string
 *                 enum: [OWNER, MEMBER]
 *     responses:
 *       201:
 *         description: Member created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 *       409:
 *         description: Email already in use
 */
membersRoutes.post('/', authenticate, asyncHandler(membersController.postMember));

/**
 * @openapi
 * /api/v1/members/{memberId}:
 *   delete:
 *     summary: Remove an organization member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Member removed
 *       400:
 *         description: Protected member
 *       403:
 *         description: Access denied
 *       404:
 *         description: Member not found
 */
membersRoutes.delete('/:memberId', authenticate, asyncHandler(membersController.deleteMemberById));

export { membersRoutes };
