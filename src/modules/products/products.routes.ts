import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as productsController from './products.controller';

export const productsRoutes = Router();

productsRoutes.get('/', authenticate, asyncHandler(productsController.getProducts));
productsRoutes.post('/', authenticate, asyncHandler(productsController.postProduct));
productsRoutes.patch('/:id', authenticate, asyncHandler(productsController.patchProduct));
productsRoutes.delete('/:id', authenticate, asyncHandler(productsController.deleteProduct));
