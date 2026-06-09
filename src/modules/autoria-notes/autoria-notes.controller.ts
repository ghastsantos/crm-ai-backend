import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import {
  createAutoriaNoteSchema,
  listAutoriaNotesSchema,
  updateAutoriaNoteSchema,
} from './autoria-notes.schemas';
import * as autoriaNotesService from './autoria-notes.service';

export async function criar(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Autenticação obrigatória');
  }

  const parsed = createAutoriaNoteSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Erro de validação', parsed.error.flatten());
  }

  const note = await autoriaNotesService.criarAutoriaNote(userId, parsed.data);

  res.status(201).json({
    success: true,
    data: note,
  });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Autenticação obrigatória');
  }

  const parsed = listAutoriaNotesSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Erro de validação', parsed.error.flatten());
  }

  const notes = await autoriaNotesService.listarAutoriaNotes(userId, parsed.data);

  res.status(200).json({
    success: true,
    data: notes,
  });
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Autenticação obrigatória');
  }

  const parsed = updateAutoriaNoteSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Erro de validação', parsed.error.flatten());
  }

  const note = await autoriaNotesService.atualizarAutoriaNote(userId, req.params.id, parsed.data);

  res.status(200).json({
    success: true,
    data: note,
  });
}

export async function excluir(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Autenticação obrigatória');
  }

  await autoriaNotesService.excluirAutoriaNote(userId, req.params.id);

  res.status(204).send();
}
