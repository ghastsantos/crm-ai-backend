import { Request, Response } from 'express';
import { checkReadiness } from './health.service';

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const status = await checkReadiness();
  const isHealthy = status.database === 'ok';
  res.status(isHealthy ? 200 : 503).json({
    success: true,
    data: status,
  });
}
