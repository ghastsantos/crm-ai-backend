import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from '@/shared/errors';

interface JwtPayload {
  sub: string;
  email: string;
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function readCookieToken(req: Request): string | null {
  if (!env.AUTH_HTTPONLY_COOKIE_ENABLED) return null;
  const raw = req.cookies?.[env.AUTH_COOKIE_NAME];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function extractAccessToken(req: Request): string | null {
  return readBearerToken(req) ?? readCookieToken(req);
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractAccessToken(req);
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid credentials'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;
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
