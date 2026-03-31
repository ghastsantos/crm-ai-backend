import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('@/infrastructure/database/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '@/infrastructure/database/prisma';
import { app } from '../../src/app';

describe('GET /api/v1/health (readiness)', () => {
  it('should return 200 when database is reachable', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database).toBe('ok');
  });

  it('should return 503 when database is unreachable', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('connection refused'));

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body.data.database).toBe('error');
  });

  it('should have success and data fields in response', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app).get('/api/v1/health');

    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('timestamp');
  });
});
