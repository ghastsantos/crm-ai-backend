import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import {
  listPipelineColumnsQuerySchema,
  updatePipelineColumnBodySchema,
  pipelineColumnIdParamsSchema,
  deletePipelineColumnQuerySchema,
} from './pipeline-columns.schemas';
import * as pipelineColumnsService from './pipeline-columns.service';

export async function getPipelineColumns(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const parsed = listPipelineColumnsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }
  const columns = await pipelineColumnsService.listPipelineColumns(userId, parsed.data);
  res.status(200).json({ success: true, data: columns });
}

export async function patchPipelineColumn(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const paramsParsed = pipelineColumnIdParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError('Validation failed', paramsParsed.error.flatten());
  }
  const parsed = updatePipelineColumnBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }
  const col = await pipelineColumnsService.updatePipelineColumn(
    userId,
    paramsParsed.data.id,
    parsed.data
  );
  res.status(200).json({ success: true, data: col });
}

export async function deletePipelineColumn(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const paramsParsed = pipelineColumnIdParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError('Validation failed', paramsParsed.error.flatten());
  }
  const queryParsed = deletePipelineColumnQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError('Validation failed', queryParsed.error.flatten());
  }
  await pipelineColumnsService.deletePipelineColumn(
    userId,
    paramsParsed.data.id,
    queryParsed.data.moveToColumnId
  );
  res.status(204).send();
}
