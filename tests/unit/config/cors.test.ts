import { describe, expect, it } from 'vitest';
import { isCorsOriginAllowed, parseCorsOrigins } from '@/config/cors';

describe('cors config', () => {
  it('parses comma-separated origins', () => {
    expect(parseCorsOrigins('http://localhost:3000, http://localhost:5173,')).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
    ]);
  });

  it('allows local frontend ports in development', () => {
    expect(isCorsOriginAllowed('http://localhost:5174', [], 'development')).toBe(true);
    expect(isCorsOriginAllowed('http://127.0.0.1:5000', [], 'test')).toBe(true);
  });

  it('keeps production restricted to configured origins', () => {
    const allowedOrigins = ['https://crm.example.com'];

    expect(isCorsOriginAllowed('https://crm.example.com', allowedOrigins, 'production')).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:5174', allowedOrigins, 'production')).toBe(false);
  });
});
