import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '@/shared/utils/async-handler';
import { authenticate } from '@/shared/middlewares/authenticate';
import * as authController from './auth.controller';

export const authRoutes = Router();

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: 'Too many requests',
      },
    });
  },
});

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, organizationName, organizationNiche]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               organizationName:
 *                 type: string
 *               organizationNiche:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 120
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 */
authRoutes.post('/register', authWriteLimiter, asyncHandler(authController.postRegister));

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authenticated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 */
authRoutes.post('/login', authWriteLimiter, asyncHandler(authController.postLogin));

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: Clear session cookie
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: Logged out
 */
authRoutes.post('/logout', asyncHandler(authController.postLogout));

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user and memberships
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
authRoutes.get('/me', authenticate, asyncHandler(authController.getMe));

/**
 * @openapi
 * /api/v1/auth/me:
 *   patch:
 *     summary: Update authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *     responses:
 *       200:
 *         description: User updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
authRoutes.patch('/me', authenticate, asyncHandler(authController.patchMe));

/**
 * @openapi
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change authenticated user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       204:
 *         description: Password changed
 *       400:
 *         description: Validation error or invalid current password
 *       401:
 *         description: Unauthorized
 */
authRoutes.post(
  '/change-password',
  authWriteLimiter,
  authenticate,
  asyncHandler(authController.postChangePassword)
);
