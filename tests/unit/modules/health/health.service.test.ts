import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/infrastructure/database/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '@/infrastructure/database/prisma';
import { checkReadiness } from '@/modules/health/health.service';

describe('checkReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return database ok when query succeeds', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const result = await checkReadiness();

    expect(result.database).toBe('ok');
  });

  it('should return database error when query fails', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('connection refused'));

    const result = await checkReadiness();

    expect(result.database).toBe('error');
  });

  it('should return a valid ISO timestamp', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const result = await checkReadiness();
    const parsed = new Date(result.timestamp);

    expect(parsed.toISOString()).toBe(result.timestamp);
  });

  it('should not throw on database failure', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('timeout'));

    await expect(checkReadiness()).resolves.not.toThrow();
  });
});
