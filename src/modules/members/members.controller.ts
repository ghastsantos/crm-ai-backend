import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import {
  createMemberBodySchema,
  listMembersQuerySchema,
  memberIdParamsSchema,
} from './members.schemas';
import * as membersService from './members.service';

function requireUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return userId;
}

export async function getMembers(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = listMembersQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const members = await membersService.listMembers(userId, parsed.data);
  res.status(200).json({ success: true, data: members });
}

export async function postMember(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = createMemberBodySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const member = await membersService.createMember(userId, parsed.data);
  res.status(201).json({ success: true, data: member });
}

export async function deleteMember(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = memberIdParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  await membersService.deleteMember(userId, parsed.data.id);
  res.status(204).send();
}
