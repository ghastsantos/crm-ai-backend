import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import {
  createCardBodySchema,
  updateCardBodySchema,
  moveCardBodySchema,
  listCardsQuerySchema,
} from './cards.schemas';
import * as cardsService from './cards.service';

export async function postCard(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const parsed = createCardBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const card = await cardsService.createCard(userId, parsed.data);
  res.status(201).json({ success: true, data: card });
}

export async function getCards(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const parsed = listCardsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const cards = await cardsService.listCards(userId, parsed.data);
  res.status(200).json({ success: true, data: cards });
}

export async function getCard(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const card = await cardsService.getCard(userId, req.params.id);
  res.status(200).json({ success: true, data: card });
}

export async function patchCard(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const parsed = updateCardBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const card = await cardsService.updateCard(userId, req.params.id, parsed.data);
  res.status(200).json({ success: true, data: card });
}

export async function moveCard(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const parsed = moveCardBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const card = await cardsService.moveCard(userId, req.params.id, parsed.data);
  res.status(200).json({ success: true, data: card });
}

export async function deleteCard(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  await cardsService.deleteCard(userId, req.params.id);
  res.status(204).send();
}
