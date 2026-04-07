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
 *             required: [email, password, name, organizationName]
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
