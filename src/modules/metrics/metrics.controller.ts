import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import { metricsOverviewQuerySchema } from './metrics.schemas';
import * as metricsService from './metrics.service';

export async function getMetricsOverview(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const parsed = metricsOverviewQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const overview = await metricsService.getMetricsOverview(userId, parsed.data);
  res.status(200).json({ success: true, data: overview });
}
