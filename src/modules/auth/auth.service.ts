import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { env } from '@/config/env';
import { AppError } from '@/shared/errors';
import type { LoginBody, RegisterBody } from './auth.schemas';

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipSummary {
  id: string;
  role: string;
  organizationId: string;
  organizationName: string;
}

export interface UserWithMemberships extends PublicUser {
  memberships: MembershipSummary[];
}

function signToken(userId: string, email: string): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, options);
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function register(input: RegisterBody): Promise<{ token: string; user: PublicUser }> {
  const email = input.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  try {
    const { user } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: input.name,
        },
      });
      const organization = await tx.organization.create({
        data: { name: input.organizationName },
      });
      await tx.organizationMember.create({
        data: {
          userId: createdUser.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });
      return { user: createdUser };
    });

    const token = signToken(user.id, user.email);
    return { token, user: toPublicUser(user) };
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(409, 'EMAIL_ALREADY_IN_USE', 'Email is already registered');
    }
    throw e;
  }
}

export async function login(input: LoginBody): Promise<{ token: string; user: PublicUser }> {
  const email = input.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = signToken(user.id, user.email);
  return { token, user: toPublicUser(user) };
}

export async function getMe(userId: string): Promise<UserWithMemberships> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { organization: true },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const memberships: MembershipSummary[] = user.memberships.map((m) => ({
    id: m.id,
    role: m.role,
    organizationId: m.organizationId,
    organizationName: m.organization.name,
  }));

  return {
    ...toPublicUser(user),
    memberships,
  };
}
