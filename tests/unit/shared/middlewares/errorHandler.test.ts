import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from '@/shared/middlewares/errorHandler';
import { AppError } from '@/shared/errors/AppError';
import { ValidationError } from '@/shared/errors/ValidationError';
import { mockRequest, mockResponse, mockNext } from '../../../helpers/express-mocks';

vi.mock('@/config/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '@/config/logger';

describe('errorHandler middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should respond with correct statusCode for AppError', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Resource not found');
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        details: undefined,
      },
    });
  });

  it('should include details when AppError has details', () => {
    const details = { field: 'email' };
    const err = new AppError(422, 'UNPROCESSABLE', 'Invalid', details);
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ details }),
      }),
    );
  });

  it('should handle ValidationError as AppError subclass with 400', () => {
    const err = new ValidationError('Bad input');
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
    );
  });

  it('should respond with 500 for generic Error', () => {
    const err = new Error('something broke');
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  it('should not leak internal error message to client', () => {
    const err = new Error('database connection string exposed');
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    errorHandler(err, req, res, next);

    const jsonCall = vi.mocked(res.json).mock.calls[0][0] as {
      error: { message: string };
    };
    expect(jsonCall.error.message).not.toContain('database');
    expect(jsonCall.error.message).toBe('An unexpected error occurred');
  });

  it('should call logger.error for generic Error', () => {
    const err = new Error('unexpected');
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    errorHandler(err, req, res, next);

    expect(logger.error).toHaveBeenCalledWith({ err }, 'Unhandled error');
  });

  it('should not call logger.error for AppError', () => {
    const err = new AppError(400, 'BAD', 'bad request');
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    errorHandler(err, req, res, next);

    expect(logger.error).not.toHaveBeenCalled();
  });
});
