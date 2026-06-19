import { Request, Response } from 'express';
import { AppError, ValidationError } from '@/shared/errors';
import {
  createProductBodySchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateProductBodySchema,
} from './products.schemas';
import * as productsService from './products.service';

function requireUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return userId;
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = listProductsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const products = await productsService.listProducts(userId, parsed.data);
  res.status(200).json({ success: true, data: products });
}

export async function postProduct(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = createProductBodySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.flatten());
  }

  const product = await productsService.createProduct(userId, parsed.data);
  res.status(201).json({ success: true, data: product });
}

export async function patchProduct(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const params = productIdParamsSchema.safeParse(req.params);
  const body = updateProductBodySchema.safeParse(req.body);

  if (!params.success) {
    throw new ValidationError('Validation failed', params.error.flatten());
  }

  if (!body.success) {
    throw new ValidationError('Validation failed', body.error.flatten());
  }

  const product = await productsService.updateProduct(userId, params.data.id, body.data);
  res.status(200).json({ success: true, data: product });
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const params = productIdParamsSchema.safeParse(req.params);

  if (!params.success) {
    throw new ValidationError('Validation failed', params.error.flatten());
  }

  await productsService.deleteProduct(userId, params.data.id);
  res.status(204).send();
}
