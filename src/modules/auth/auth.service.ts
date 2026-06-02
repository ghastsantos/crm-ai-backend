import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { env } from '@/config/env';
import { AppError } from '@/shared/errors';
import { seedDefaultPipelineColumnsForOrganization } from '@/modules/pipeline-columns/pipeline-columns.defaults';
import type { ChangePasswordBody, LoginBody, RegisterBody, UpdateMeBody } from './auth.schemas';

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
  organizationNiche: string;
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

export async function register(
  input: RegisterBody
): Promise<{ token: string; user: UserWithMemberships }> {
  const email = input.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  try {
    const { user, membership, organization } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: input.name,
        },
      });
      const createdOrganization = await tx.organization.create({
        data: { name: input.organizationName, niche: input.organizationNiche },
      });
      await seedDefaultPipelineColumnsForOrganization(tx, createdOrganization.id);
      const createdMembership = await tx.organizationMember.create({
        data: {
          userId: createdUser.id,
          organizationId: createdOrganization.id,
          role: 'OWNER',
        },
      });
      return {
        user: createdUser,
        membership: createdMembership,
        organization: createdOrganization,
      };
    });

    const token = signToken(user.id, user.email);
    const userWithMemberships: UserWithMemberships = {
      ...toPublicUser(user),
      memberships: [
        {
          id: membership.id,
          role: membership.role,
          organizationId: membership.organizationId,
          organizationName: organization.name,
          organizationNiche: organization.niche,
        },
      ],
    };
    return { token, user: userWithMemberships };
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
    organizationNiche: m.organization.niche,
  }));

  return {
    ...toPublicUser(user),
    memberships,
  };
}

export async function updateMe(userId: string, input: UpdateMeBody): Promise<UserWithMemberships> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    throw e;
  }

  return getMe(userId);
}

export async function changePassword(userId: string, input: ChangePasswordBody): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError(400, 'PASSWORD_UNCHANGED', 'New password must differ from current');
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}
