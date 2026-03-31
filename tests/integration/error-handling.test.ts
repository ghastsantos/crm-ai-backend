import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '@/shared/middlewares/errorHandler';
import { AppError } from '@/shared/errors/AppError';
import { ValidationError } from '@/shared/errors/ValidationError';

vi.mock('@/config/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function createTestApp() {
  const testApp = express();

  testApp.get('/throw-app-error', () => {
    throw new AppError(422, 'UNPROCESSABLE', 'Bad input');
  });

  testApp.get('/throw-validation', () => {
    throw new ValidationError('Invalid field', { field: 'email' });
  });

  testApp.get('/throw-generic', () => {
    throw new Error('unexpected internal failure');
  });

  testApp.use(errorHandler);

  return testApp;
}

describe('Error handling (integration)', () => {
  const testApp = createTestApp();

  it('should return structured error with correct status for AppError', async () => {
    const res = await request(testApp).get('/throw-app-error');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'UNPROCESSABLE',
        message: 'Bad input',
        details: undefined,
      },
    });
  });

  it('should return 400 for ValidationError', async () => {
    const res = await request(testApp).get('/throw-validation');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({ field: 'email' });
  });

  it('should return 500 with INTERNAL_ERROR for generic Error', async () => {
    const res = await request(testApp).get('/throw-generic');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('should not expose internal error message for generic Error', async () => {
    const res = await request(testApp).get('/throw-generic');

    expect(res.body.error.message).toBe('An unexpected error occurred');
    expect(res.body.error.message).not.toContain('internal failure');
  });
});
