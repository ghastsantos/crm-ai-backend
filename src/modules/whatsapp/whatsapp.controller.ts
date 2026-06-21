import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import {
  connectWhatsAppIntegrationBodySchema,
  disconnectWhatsAppIntegrationBodySchema,
  listWhatsAppConversationsQuerySchema,
  receiveWhatsAppMessageBodySchema,
  setupWhatsAppIntegrationBodySchema,
  whatsappIntegrationQuerySchema,
} from './whatsapp.schemas';
import * as whatsappService from './whatsapp.service';

function requireUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return userId;
}

export async function postMessage(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = receiveWhatsAppMessageBodySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const result = await whatsappService.processWhatsAppMessage(userId, parsed.data);
  res.status(result.created ? 201 : 200).json({ success: true, data: result });
}

export async function getIntegration(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = whatsappIntegrationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const result = await whatsappService.refreshIntegrationStatus(userId, parsed.data.organizationId);
  res.status(200).json({ success: true, data: result });
}

export async function postIntegrationSetup(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = setupWhatsAppIntegrationBodySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const result = await whatsappService.setupIntegration(userId, parsed.data.organizationId);
  res.status(200).json({ success: true, data: result });
}

export async function postIntegrationConnect(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = connectWhatsAppIntegrationBodySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const result = await whatsappService.connectIntegration(userId, parsed.data.organizationId);
  res.status(200).json({ success: true, data: result });
}

export async function postIntegrationDisconnect(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = disconnectWhatsAppIntegrationBodySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const result = await whatsappService.disconnectIntegration(userId, parsed.data.organizationId);
  res.status(200).json({ success: true, data: result });
}

export async function getConversations(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = listWhatsAppConversationsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const result = await whatsappService.listConversations(userId, parsed.data.organizationId);
  res.status(200).json({ success: true, data: result });
}
