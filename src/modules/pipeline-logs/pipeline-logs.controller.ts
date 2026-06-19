import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import { listPipelineLogsQuerySchema } from './pipeline-logs.schemas';
import * as pipelineLogsService from './pipeline-logs.service';

export async function getPipelineLogs(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const parsed = listPipelineLogsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const logs = await pipelineLogsService.listPipelineLogs(parsed.data);

  res.status(200).json({
    success: true,
    data: logs,
  });
}
