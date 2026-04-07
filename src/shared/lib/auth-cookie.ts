import type { Response } from 'express';
import type { CookieOptions } from 'express';
import { env } from '@/config/env';

export function getAuthCookieOptions(): CookieOptions {
  const sameSite = env.AUTH_COOKIE_SAME_SITE;
  const secure = env.NODE_ENV === 'production' || sameSite === 'none';
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  };
}

export function setAuthCookie(res: Response, token: string): void {
  if (!env.AUTH_HTTPONLY_COOKIE_ENABLED) return;
  res.cookie(env.AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(res: Response): void {
  if (!env.AUTH_HTTPONLY_COOKIE_ENABLED) return;
  const opts = getAuthCookieOptions();
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    path: opts.path,
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
  });
}
