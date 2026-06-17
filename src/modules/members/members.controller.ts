import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import { createMemberSchema, deleteMemberSchema, listMembersSchema } from './members.schemas';
import * as membersService from './members.service';

export async function listar(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Autenticação obrigatória');
  }

  const parsed = listMembersSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Erro de validação', parsed.error.flatten());
  }

  const members = await membersService.listarMembros(userId, parsed.data);

  res.status(200).json({
    success: true,
    data: members,
  });
}

export async function criar(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Autenticação obrigatória');
  }

  const parsed = createMemberSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Erro de validação', parsed.error.flatten());
  }

  const member = await membersService.criarMembro(userId, parsed.data);

  res.status(201).json({
    success: true,
    data: member,
  });
}

export async function excluir(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Autenticação obrigatória');
  }

  const parsed = deleteMemberSchema.safeParse(req.params);

  if (!parsed.success) {
    throw new ValidationError('Erro de validação', parsed.error.flatten());
  }

  await membersService.excluirMembro(userId, parsed.data.id);

  res.status(204).send();
}
