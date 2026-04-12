import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as cardsController from './cards.controller';

export const cardsRoutes = Router();

/**
 * @openapi
 * /api/v1/cards:
 *   post:
 *     summary: Create a card
 *     tags: [Cards]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, organizationId]
 *             properties:
 *               title:
 *                 type: string
 *               stage:
 *                 type: string
 *                 enum: [LEAD, QUALIFIED, PROPOSAL, WON, LOST]
 *               value:
 *                 type: number
 *               organizationId:
 *                 type: string
 *               contactId:
 *                 type: string
 *               companyName:
 *                 type: string
 *               contactName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Card created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 */
cardsRoutes.post('/', authenticate, asyncHandler(cardsController.postCard));

/**
 * @openapi
 * /api/v1/cards:
 *   get:
 *     summary: List cards
 *     tags: [Cards]
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
 *         name: stage
 *         schema:
 *           type: string
 *           enum: [LEAD, QUALIFIED, PROPOSAL, WON, LOST]
 *     responses:
 *       200:
 *         description: List of cards
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 */
cardsRoutes.get('/', authenticate, asyncHandler(cardsController.getCards));

/**
 * @openapi
 * /api/v1/cards/{id}:
 *   get:
 *     summary: Get card by ID
 *     tags: [Cards]
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
 *       200:
 *         description: Card found
 *       404:
 *         description: Card not found
 */
cardsRoutes.get('/:id', authenticate, asyncHandler(cardsController.getCard));

/**
 * @openapi
 * /api/v1/cards/{id}/move:
 *   patch:
 *     summary: Move card to a different stage
 *     tags: [Cards]
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
 *             required: [stage]
 *             properties:
 *               stage:
 *                 type: string
 *                 enum: [LEAD, QUALIFIED, PROPOSAL, WON, LOST]
 *     responses:
 *       200:
 *         description: Card moved
 *       404:
 *         description: Card not found
 */
cardsRoutes.patch('/:id/move', authenticate, asyncHandler(cardsController.moveCard));

/**
 * @openapi
 * /api/v1/cards/{id}:
 *   patch:
 *     summary: Update card fields
 *     tags: [Cards]
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
 *               stage:
 *                 type: string
 *                 enum: [LEAD, QUALIFIED, PROPOSAL, WON, LOST]
 *               value:
 *                 type: number
 *               contactId:
 *                 type: string
 *               companyName:
 *                 type: string
 *               contactName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Card updated
 *       404:
 *         description: Card not found
 */
cardsRoutes.patch('/:id', authenticate, asyncHandler(cardsController.patchCard));

/**
 * @openapi
 * /api/v1/cards/{id}:
 *   delete:
 *     summary: Delete a card
 *     tags: [Cards]
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
 *         description: Card deleted
 *       404:
 *         description: Card not found
 */
cardsRoutes.delete('/:id', authenticate, asyncHandler(cardsController.deleteCard));
