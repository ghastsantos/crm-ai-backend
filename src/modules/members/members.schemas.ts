import { z } from 'zod';

export const listMembersSchema = z.object({
  organizationId: z.string().min(1),
});

export const createMemberSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2).max(200),
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});

export const deleteMemberSchema = z.object({
  id: z.string().min(1),
});

export type ListMembersInput = z.infer<typeof listMembersSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
