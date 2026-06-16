import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import type { CreateMemberInput, ListMembersInput } from './members.schemas';

const BCRYPT_ROUNDS = 12;

async function assertOwner(userId: string, organizationId: string): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Acesso negado');
  }

  if (membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Apenas administradores podem gerenciar membros');
  }
}

export async function listarMembros(userId: string, input: ListMembersInput) {
  await assertOwner(userId, input.organizationId);

  return prisma.organizationMember.findMany({
    where: {
      organizationId: input.organizationId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

export async function criarMembro(userId: string, input: CreateMemberInput) {
  await assertOwner(userId, input.organizationId);

  const email = input.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  try {
    return await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
        },
      });

      return tx.organizationMember.create({
        data: {
          userId: createdUser.id,
          organizationId: input.organizationId,
          role: 'MEMBER',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
            },
          },
        },
      });
    });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(409, 'EMAIL_ALREADY_IN_USE', 'Este e-mail já está cadastrado');
    }

    throw e;
  }
}

export async function excluirMembro(userId: string, memberId: string) {
  const member = await prisma.organizationMember.findUnique({
    where: {
      id: memberId,
    },
  });

  if (!member) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'Membro não encontrado');
  }

  await assertOwner(userId, member.organizationId);

  if (member.userId === userId) {
    throw new AppError(
      400,
      'OWNER_CANNOT_REMOVE_SELF',
      'O administrador não pode remover a si mesmo'
    );
  }

  if (member.role === 'OWNER') {
    throw new AppError(
      400,
      'OWNER_CANNOT_BE_REMOVED',
      'O dono da organização não pode ser removido'
    );
  }

  await prisma.organizationMember.delete({
    where: {
      id: memberId,
    },
  });
}
