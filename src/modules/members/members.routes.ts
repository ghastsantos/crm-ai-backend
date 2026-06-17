import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as membersController from './members.controller';

const membersRoutes = Router();

membersRoutes.get('/', authenticate, asyncHandler(membersController.getMembers));
membersRoutes.post('/', authenticate, asyncHandler(membersController.postMember));
membersRoutes.delete('/:memberId', authenticate, asyncHandler(membersController.deleteMemberById));

export { membersRoutes };
