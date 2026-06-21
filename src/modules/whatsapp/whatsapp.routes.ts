import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as whatsappController from './whatsapp.controller';

export const whatsappRoutes = Router();

/**
 * @openapi
 * /api/v1/whatsapp/messages:
 *   post:
 *     summary: Process a received WhatsApp message
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, phone, message]
 *             properties:
 *               organizationId:
 *                 type: string
 *               phone:
 *                 type: string
 *               contactName:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Existing card updated
 *       201:
 *         description: New card created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
whatsappRoutes.post('/messages', authenticate, asyncHandler(whatsappController.postMessage));

whatsappRoutes.get('/integration', authenticate, asyncHandler(whatsappController.getIntegration));

whatsappRoutes.post(
  '/integration/setup',
  authenticate,
  asyncHandler(whatsappController.postIntegrationSetup)
);

whatsappRoutes.post(
  '/integration/connect',
  authenticate,
  asyncHandler(whatsappController.postIntegrationConnect)
);

whatsappRoutes.post(
  '/integration/disconnect',
  authenticate,
  asyncHandler(whatsappController.postIntegrationDisconnect)
);

whatsappRoutes.get(
  '/conversations',
  authenticate,
  asyncHandler(whatsappController.getConversations)
);
