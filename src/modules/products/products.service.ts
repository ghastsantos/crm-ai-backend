import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/database/prisma';
import { AppError } from '@/shared/errors';
import type {
  CreateProductBody,
  ListProductsQuery,
  UpdateProductBody,
} from './products.schemas';

export type PublicProduct = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  price: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ProductRecord = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicProduct(product: ProductRecord): PublicProduct {
  return {
    id: product.id,
    organizationId: product.organizationId,
    name: product.name,
    description: product.description,
    price: product.price.toFixed(2),
    active: product.active,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function assertMember(userId: string, organizationId: string): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }
}

async function findProductForUser(userId: string, productId: string): Promise<ProductRecord> {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organization: {
        members: {
          some: { userId },
        },
      },
    },
  });

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  return product;
}

export async function listProducts(
  userId: string,
  query: ListProductsQuery
): Promise<PublicProduct[]> {
  await assertMember(userId, query.organizationId);

  const products = await prisma.product.findMany({
    where: {
      organizationId: query.organizationId,
      active: query.active,
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  return products.map(toPublicProduct);
}

export async function createProduct(
  userId: string,
  input: CreateProductBody
): Promise<PublicProduct> {
  await assertMember(userId, input.organizationId);

  try {
    const product = await prisma.product.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        description: input.description?.trim() ? input.description.trim() : null,
        price: new Prisma.Decimal(String(input.price)),
        active: input.active ?? true,
      },
    });

    return toPublicProduct(product);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'PRODUCT_ALREADY_EXISTS', 'Product already exists');
    }

    throw error;
  }
}

export async function updateProduct(
  userId: string,
  productId: string,
  input: UpdateProductBody
): Promise<PublicProduct> {
  const product = await findProductForUser(userId, productId);

  try {
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        name: input.name,
        description:
          input.description === undefined
            ? undefined
            : input.description?.trim()
              ? input.description.trim()
              : null,
        price: input.price === undefined ? undefined : new Prisma.Decimal(String(input.price)),
        active: input.active,
      },
    });

    return toPublicProduct(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'PRODUCT_ALREADY_EXISTS', 'Product already exists');
    }

    throw error;
  }
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  const product = await findProductForUser(userId, productId);

  await prisma.product.delete({
    where: { id: product.id },
  });
}

export async function listActiveProductsForOrganization(
  organizationId: string
): Promise<PublicProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      active: true,
    },
    orderBy: { name: 'asc' },
  });

  return products.map(toPublicProduct);
}
