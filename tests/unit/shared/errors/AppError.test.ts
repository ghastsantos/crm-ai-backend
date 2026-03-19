import { describe, it, expect } from 'vitest';
import { AppError } from '@/shared/errors/AppError';

describe('AppError', () => {
  it('should construct with all properties', () => {
    const error = new AppError(404, 'NOT_FOUND', 'Resource not found', { id: 1 });

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Resource not found');
    expect(error.details).toEqual({ id: 1 });
    expect(error.name).toBe('AppError');
  });

  it('should be instanceof Error', () => {
    const error = new AppError(500, 'INTERNAL', 'fail');

    expect(error).toBeInstanceOf(Error);
  });

  it('should be instanceof AppError', () => {
    const error = new AppError(500, 'INTERNAL', 'fail');

    expect(error).toBeInstanceOf(AppError);
  });

  it('should have undefined details when omitted', () => {
    const error = new AppError(400, 'BAD_REQUEST', 'bad');

    expect(error.details).toBeUndefined();
  });

  it('should preserve complex details object', () => {
    const details = { fields: ['name', 'email'], nested: { key: 'value' } };
    const error = new AppError(422, 'UNPROCESSABLE', 'invalid', details);

    expect(error.details).toEqual(details);
  });
});
