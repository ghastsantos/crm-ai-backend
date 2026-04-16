import { Request, Response } from 'express';
import { env } from '@/config/env';
import { AppError, ValidationError } from '@/shared/errors';
import { clearAuthCookie, setAuthCookie } from '@/shared/lib/auth-cookie';
import { registerBodySchema, loginBodySchema } from './auth.schemas';
import * as authService from './auth.service';

function respondAuthSuccess(
  res: Response,
  status: number,
  result: { token: string; user: authService.PublicUser | authService.UserWithMemberships }
): void {
  if (env.AUTH_HTTPONLY_COOKIE_ENABLED) {
    setAuthCookie(res, result.token);
  }
  if (env.AUTH_TOKEN_IN_BODY) {
    res.status(status).json({ success: true, data: result });
    return;
  }
  res.status(status).json({ success: true, data: { user: result.user } });
}

export async function postRegister(req: Request, res: Response): Promise<void> {
  const parsed = registerBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }
  const result = await authService.register(parsed.data);
  respondAuthSuccess(res, 201, result);
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }
  const result = await authService.login(parsed.data);
  respondAuthSuccess(res, 200, result);
}

export async function postLogout(_req: Request, res: Response): Promise<void> {
  clearAuthCookie(res);
  res.status(204).send();
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const user = await authService.getMe(userId);
  res.status(200).json({ success: true, data: user });
}
