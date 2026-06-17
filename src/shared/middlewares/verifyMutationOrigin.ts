import { Request, Response, NextFunction } from 'express';
import { isCorsOriginAllowed, parseCorsOrigins } from '@/config/cors';
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
  const allowed = parseCorsOrigins(env.CORS_ORIGINS);

  if (!isCorsOriginAllowed(origin, allowed, env.NODE_ENV)) {
    next(new AppError(403, 'FORBIDDEN_ORIGIN', 'Origin is not allowed'));
    return;
  }
  next();
}
