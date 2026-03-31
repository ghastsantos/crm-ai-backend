import { Request, Response, NextFunction } from 'express';
import { vi } from 'vitest';

export function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    ...overrides,
  } as Request;
}

export function mockResponse(): Response {
  const res = {} as Partial<Response>;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
}

export function mockNext(): NextFunction {
  return vi.fn() as NextFunction;
}
