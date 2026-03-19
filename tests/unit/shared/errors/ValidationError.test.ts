import { describe, it, expect } from 'vitest';
import { AppError } from '@/shared/errors/AppError';
import { ValidationError } from '@/shared/errors/ValidationError';

describe('ValidationError', () => {
  it('should have statusCode 400 and code VALIDATION_ERROR', () => {
    const error = new ValidationError('Invalid input');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('ValidationError');
  });

  it('should be instanceof AppError', () => {
    const error = new ValidationError('Invalid input');

    expect(error).toBeInstanceOf(AppError);
  });

  it('should be instanceof Error', () => {
    const error = new ValidationError('Invalid input');

    expect(error).toBeInstanceOf(Error);
  });

  it('should pass message through', () => {
    const error = new ValidationError('Email is required');

    expect(error.message).toBe('Email is required');
  });

  it('should pass details through', () => {
    const details = { field: 'email', reason: 'required' };
    const error = new ValidationError('Invalid', details);

    expect(error.details).toEqual(details);
  });
});
