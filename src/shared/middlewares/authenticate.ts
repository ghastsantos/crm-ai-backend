import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from '@/shared/errors';

interface JwtPayload {
  sub: string;
  email: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authorization header'));
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authorization header'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!decoded.sub || !decoded.email) {
      next(new AppError(401, 'UNAUTHORIZED', 'Invalid token payload'));
      return;
    }
    req.auth = { userId: decoded.sub, email: decoded.email };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
}
