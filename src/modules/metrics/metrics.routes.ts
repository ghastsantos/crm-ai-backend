import { Router } from 'express';
import { authenticate } from '@/shared/middlewares/authenticate';
import { asyncHandler } from '@/shared/utils/async-handler';
import * as metricsController from './metrics.controller';

export const metricsRoutes = Router();

metricsRoutes.get('/overview', authenticate, asyncHandler(metricsController.getMetricsOverview));
