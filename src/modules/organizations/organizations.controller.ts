import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import {
  createOrganizationBodySchema,
  organizationIdParamsSchema,
  updateOrganizationBodySchema,
} from './organizations.schemas';
import * as organizationsService from './organizations.service';

export async function getOrganizations(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const organizations = await organizationsService.listOrganizationsForUser(userId);
  res.status(200).json({ success: true, data: organizations });
}

export async function postOrganization(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const parsed = createOrganizationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const organization = await organizationsService.createOrganization(userId, parsed.data);
  res.status(201).json({ success: true, data: organization });
}

export async function patchOrganization(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const paramsParsed = organizationIdParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError('Validation failed', paramsParsed.error.flatten());
  }

  const bodyParsed = updateOrganizationBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new ValidationError('Validation failed', bodyParsed.error.flatten());
  }

  const organization = await organizationsService.updateOrganization(
    userId,
    paramsParsed.data.id,
    bodyParsed.data
  );
  res.status(200).json({ success: true, data: organization });
}

export async function deleteOrganization(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const paramsParsed = organizationIdParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError('Validation failed', paramsParsed.error.flatten());
  }

  await organizationsService.deleteOrganization(userId, paramsParsed.data.id);
  res.status(204).send();
}
