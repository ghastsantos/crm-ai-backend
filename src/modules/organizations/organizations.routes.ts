import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as organizationsController from './organizations.controller';

export const organizationsRoutes = Router();

/**
 * @openapi
 * /api/v1/organizations:
 *   get:
 *     summary: List organizations the authenticated user belongs to
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Organizations the user is a member of
 *       401:
 *         description: Unauthorized
 */
organizationsRoutes.get('/', authenticate, asyncHandler(organizationsController.getOrganizations));

/**
 * @openapi
 * /api/v1/organizations:
 *   post:
 *     summary: Create a new organization (the user becomes OWNER)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, niche]
 *             properties:
 *               name:
 *                 type: string
 *               niche:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 120
 *     responses:
 *       201:
 *         description: Organization created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
organizationsRoutes.post('/', authenticate, asyncHandler(organizationsController.postOrganization));

/**
 * @openapi
 * /api/v1/organizations/{id}/users:
 *   post:
 *     summary: Create a user in the organization
 *     tags: [Organizations]
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
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [OWNER, MEMBER]
 *     responses:
 *       201:
 *         description: User created and linked
 *       400:
 *         description: Validation error
 *       403:
 *         description: Only owner can create users
 *       409:
 *         description: Email already in use
 */
organizationsRoutes.post(
  '/:id/users',
  authenticate,
  asyncHandler(organizationsController.postOrganizationUser)
);

/**
 * @openapi
 * /api/v1/organizations/{id}:
 *   patch:
 *     summary: Update organization (OWNER only)
 *     tags: [Organizations]
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
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               niche:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 120
 *     responses:
 *       200:
 *         description: Organization updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Only owner can update
 *       404:
 *         description: Organization not found
 */
organizationsRoutes.patch(
  '/:id',
  authenticate,
  asyncHandler(organizationsController.patchOrganization)
);

/**
 * @openapi
 * /api/v1/organizations/{id}:
 *   delete:
 *     summary: Delete organization (OWNER only). Cascades members, contacts, deals, columns.
 *     tags: [Organizations]
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
 *         description: Organization deleted
 *       403:
 *         description: Only owner can delete
 *       404:
 *         description: Organization not found
 */
organizationsRoutes.delete(
  '/:id',
  authenticate,
  asyncHandler(organizationsController.deleteOrganization)
);
