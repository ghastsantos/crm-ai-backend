import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import { registerBodySchema, loginBodySchema } from './auth.schemas';
import * as authService from './auth.service';

export async function postRegister(req: Request, res: Response): Promise<void> {
  const parsed = registerBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }
  const result = await authService.register(parsed.data);
  res.status(201).json({ success: true, data: result });
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }
  const result = await authService.login(parsed.data);
  res.status(200).json({ success: true, data: result });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const user = await authService.getMe(userId);
  res.status(200).json({ success: true, data: user });
}
