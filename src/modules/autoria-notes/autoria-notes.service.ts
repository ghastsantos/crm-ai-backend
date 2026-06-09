import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import type {
  CreateAutoriaNoteInput,
  ListAutoriaNotesInput,
  UpdateAutoriaNoteInput,
} from './autoria-notes.schemas';

async function validarAcesso(userId: string, organizationId: string) {
  const membro = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membro) {
    throw new AppError(403, 'FORBIDDEN', 'Acesso negado');
  }
}

export async function criarAutoriaNote(userId: string, input: CreateAutoriaNoteInput) {
  await validarAcesso(userId, input.organizationId);

  return prisma.autoriaNote.create({
    data: {
      texto: input.texto,
      organizationId: input.organizationId,
    },
  });
}

export async function listarAutoriaNotes(userId: string, input: ListAutoriaNotesInput) {
  await validarAcesso(userId, input.organizationId);

  return prisma.autoriaNote.findMany({
    where: {
      organizationId: input.organizationId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function atualizarAutoriaNote(
  userId: string,
  id: string,
  input: UpdateAutoriaNoteInput
) {
  const note = await prisma.autoriaNote.findUnique({
    where: { id },
  });

  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Anotação não encontrada');
  }

  await validarAcesso(userId, note.organizationId);

  return prisma.autoriaNote.update({
    where: { id },
    data: {
      texto: input.texto,
    },
  });
}

export async function excluirAutoriaNote(userId: string, id: string) {
  const note = await prisma.autoriaNote.findUnique({
    where: { id },
  });

  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Anotação não encontrada');
  }

  await validarAcesso(userId, note.organizationId);

  await prisma.autoriaNote.delete({
    where: { id },
  });
}
