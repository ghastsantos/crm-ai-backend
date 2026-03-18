import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Test endpoint', () => {
  it('GET /api/v1/test returns correct structure', async () => {
    const res = await request(app).get('/api/v1/test');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('ok', true);
    expect(res.body.data).toHaveProperty('timestamp');
    expect(typeof res.body.data.timestamp).toBe('string');
  });
});
