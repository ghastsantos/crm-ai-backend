import { Request, Response, NextFunction } from 'express';
import { env } from '@/config/env';
import { AppError } from '@/shared/errors';

const MUTABLE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function verifyMutationOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (!env.AUTH_ENFORCE_ORIGIN_ON_MUTATIONS) {
    next();
    return;
  }
  if (!MUTABLE.has(req.method)) {
    next();
    return;
  }
  const origin = req.get('Origin');
  if (!origin) {
    next(new AppError(403, 'MISSING_ORIGIN', 'Origin header is required for this request'));
    return;
  }
  const allowed = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  if (!allowed.includes(origin)) {
    next(new AppError(403, 'FORBIDDEN_ORIGIN', 'Origin is not allowed'));
    return;
  }
  next();
}
