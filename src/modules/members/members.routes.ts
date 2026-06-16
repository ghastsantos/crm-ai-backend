import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as controller from './members.controller';

export const membersRoutes = Router();

membersRoutes.get('/', authenticate, asyncHandler(controller.listar));
membersRoutes.post('/', authenticate, asyncHandler(controller.criar));
membersRoutes.delete('/:id', authenticate, asyncHandler(controller.excluir));
