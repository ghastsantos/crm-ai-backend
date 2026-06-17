import bcrypt from 'bcrypt';
import { OrganizationRole, Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import type { CreateMemberBody, ListMembersQuery } from './members.schemas';

const BCRYPT_ROUNDS = 12;

export type PublicMember = {
  id: string;
  role: OrganizationRole;
  createdAt: Date;
  organizationId: string;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  };
};

async function assertOwner(userId: string, organizationId: string): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership || membership.role !== OrganizationRole.OWNER) {
    throw new AppError(403, 'FORBIDDEN', 'Only organization owners can manage members');
  }
}

export async function listMembers(
  userId: string,
  input: ListMembersQuery
): Promise<PublicMember[]> {
  await assertOwner(userId, input.organizationId);

  return prisma.organizationMember.findMany({
    where: { organizationId: input.organizationId },
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
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createMember(
  userId: string,
  input: CreateMemberBody
): Promise<PublicMember> {
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
          role: input.role,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'EMAIL_ALREADY_IN_USE', 'Email already in use');
    }

    throw error;
  }
}

export async function deleteMember(userId: string, memberId: string): Promise<void> {
  const member = await prisma.organizationMember.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found');
  }

  await assertOwner(userId, member.organizationId);

  if (member.userId === userId) {
    throw new AppError(400, 'OWNER_CANNOT_REMOVE_SELF', 'Owner cannot remove itself');
  }

  if (member.role === OrganizationRole.OWNER) {
    throw new AppError(400, 'OWNER_CANNOT_BE_REMOVED', 'Organization owner cannot be removed');
  }

  await prisma.organizationMember.delete({
    where: { id: memberId },
  });
}
