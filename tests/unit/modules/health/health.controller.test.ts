import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse } from '../../../helpers/express-mocks';

vi.mock('@/modules/health/health.service', () => ({
  checkReadiness: vi.fn(),
}));

import { checkReadiness } from '@/modules/health/health.service';
import { getReadiness } from '@/modules/health/health.controller';

describe('getReadiness controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should respond 200 when database is ok', async () => {
    const status = { database: 'ok' as const, timestamp: new Date().toISOString() };
    vi.mocked(checkReadiness).mockResolvedValue(status);

    const req = mockRequest();
    const res = mockResponse();

    await getReadiness(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: status });
  });

  it('should respond 503 when database is error', async () => {
    const status = { database: 'error' as const, timestamp: new Date().toISOString() };
    vi.mocked(checkReadiness).mockResolvedValue(status);

    const req = mockRequest();
    const res = mockResponse();

    await getReadiness(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: status });
  });
});
