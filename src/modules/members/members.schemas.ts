import { OrganizationRole } from '@prisma/client';
import { z } from 'zod';

export const listMembersQuerySchema = z.object({
  organizationId: z.string().min(1),
});

export const createMemberBodySchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(OrganizationRole).default(OrganizationRole.MEMBER),
});

export const memberIdParamsSchema = z.object({
  memberId: z.string().min(1),
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
export type CreateMemberBody = z.infer<typeof createMemberBodySchema>;
export type MemberIdParams = z.infer<typeof memberIdParamsSchema>;
