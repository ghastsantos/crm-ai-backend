import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { isCorsOriginAllowed, parseCorsOrigins } from '@/config/cors';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { errorHandler } from '@/shared/middlewares/errorHandler';
import { verifyMutationOrigin } from '@/shared/middlewares/verifyMutationOrigin';
import { healthRoutes } from '@/modules/health/health.routes';
import { authRoutes } from '@/modules/auth/auth.routes';
import { cardsRoutes } from '@/modules/cards/cards.routes';
import { organizationsRoutes } from '@/modules/organizations/organizations.routes';
import { pipelineColumnsRoutes } from '@/modules/pipeline-columns/pipeline-columns.routes';
import { pipelineLogsRoutes } from '@/modules/pipeline-logs/pipeline-logs.routes';
import { membersRoutes } from '@/modules/members/members.routes';
import { productsRoutes } from '@/modules/products/products.routes';
import { whatsappRoutes } from '@/modules/whatsapp/whatsapp.routes';
import { apiDocsRouter } from '@/config/swagger';

const app = express();
const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);

if (env.TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
}

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, corsOrigins, env.NODE_ENV)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(cookieParser());

// Body parsing
app.use(express.json({ limit: '100kb' }));

app.use('/api/v1', verifyMutationOrigin);

// Logging
app.use(pinoHttp({ logger }));

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cards', cardsRoutes);
app.use('/api/v1/organizations', organizationsRoutes);
app.use('/api/v1/pipeline-columns', pipelineColumnsRoutes);
app.use('/api/v1/pipeline-logs', pipelineLogsRoutes);
app.use('/api/v1/members', membersRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);

if (env.API_DOCS_ENABLED) {
  app.use('/api-docs', apiDocsRouter);
}

// Error handler (must be last)
app.use(errorHandler);

export { app };
