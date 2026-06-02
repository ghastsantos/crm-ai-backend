import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import { seedDefaultPipelineColumnsForOrganization } from '@/modules/pipeline-columns/pipeline-columns.defaults';
import type { CreateOrganizationBody, UpdateOrganizationBody } from './organizations.schemas';

export interface PublicOrganization {
  id: string;
  name: string;
  niche: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

function toPublicOrganization(
  org: {
    id: string;
    name: string;
    niche: string;
    createdAt: Date;
    updatedAt: Date;
  },
  role: string
): PublicOrganization {
  return {
    id: org.id,
    name: org.name,
    niche: org.niche,
    role,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

async function getMembership(userId: string, organizationId: string) {
  return prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
}

async function assertOwner(userId: string, organizationId: string): Promise<void> {
  const membership = await getMembership(userId, organizationId);
  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
  if (membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only the organization owner can perform this action');
  }
}

export async function createOrganization(
  userId: string,
  input: CreateOrganizationBody
): Promise<PublicOrganization> {
  const created = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.name, niche: input.niche },
    });
    await seedDefaultPipelineColumnsForOrganization(tx, organization.id);
    await tx.organizationMember.create({
      data: {
        userId,
        organizationId: organization.id,
        role: 'OWNER',
      },
    });
    return organization;
  });
  return toPublicOrganization(created, 'OWNER');
}

export async function listOrganizationsForUser(userId: string): Promise<PublicOrganization[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map((m) => toPublicOrganization(m.organization, m.role));
}

export async function updateOrganization(
  userId: string,
  organizationId: string,
  input: UpdateOrganizationBody
): Promise<PublicOrganization> {
  await assertOwner(userId, organizationId);

  const data: Prisma.OrganizationUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.niche !== undefined) data.niche = input.niche;

  try {
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data,
    });
    const membership = await getMembership(userId, organizationId);
    return toPublicOrganization(updated, membership?.role ?? 'OWNER');
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
    }
    throw e;
  }
}

export async function deleteOrganization(userId: string, organizationId: string): Promise<void> {
  await assertOwner(userId, organizationId);

  try {
    await prisma.organization.delete({ where: { id: organizationId } });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
    }
    throw e;
  }
}
