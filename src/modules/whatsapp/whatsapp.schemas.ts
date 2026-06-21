import { z } from 'zod';

export const receiveWhatsAppMessageBodySchema = z.object({
  organizationId: z.string().min(1),
  phone: z.string().min(8).max(40).trim(),
  contactName: z.string().min(1).max(200).trim().optional(),
  message: z.string().min(1).max(1000).trim(),
});

export const setupWhatsAppIntegrationBodySchema = z.object({
  organizationId: z.string().min(1),
});

export const whatsappIntegrationQuerySchema = z.object({
  organizationId: z.string().min(1),
});

export const connectWhatsAppIntegrationBodySchema = z.object({
  organizationId: z.string().min(1),
});

export const disconnectWhatsAppIntegrationBodySchema = z.object({
  organizationId: z.string().min(1),
});

export const listWhatsAppConversationsQuerySchema = z.object({
  organizationId: z.string().min(1),
});

export type ReceiveWhatsAppMessageBody = z.infer<typeof receiveWhatsAppMessageBodySchema>;
export type SetupWhatsAppIntegrationBody = z.infer<typeof setupWhatsAppIntegrationBodySchema>;
export type WhatsAppIntegrationQuery = z.infer<typeof whatsappIntegrationQuerySchema>;
export type ConnectWhatsAppIntegrationBody = z.infer<typeof connectWhatsAppIntegrationBodySchema>;
export type DisconnectWhatsAppIntegrationBody = z.infer<
  typeof disconnectWhatsAppIntegrationBodySchema
>;
export type ListWhatsAppConversationsQuery = z.infer<typeof listWhatsAppConversationsQuerySchema>;
