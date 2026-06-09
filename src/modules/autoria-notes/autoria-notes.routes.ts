import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as controller from './autoria-notes.controller';

export const autoriaNotesRoutes = Router();

autoriaNotesRoutes.get('/', authenticate, asyncHandler(controller.listar));
autoriaNotesRoutes.post('/', authenticate, asyncHandler(controller.criar));
autoriaNotesRoutes.patch('/:id', authenticate, asyncHandler(controller.atualizar));
autoriaNotesRoutes.delete('/:id', authenticate, asyncHandler(controller.excluir));
