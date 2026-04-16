import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { errorHandler } from '@/shared/middlewares/errorHandler';
import { verifyMutationOrigin } from '@/shared/middlewares/verifyMutationOrigin';
import { healthRoutes } from '@/modules/health/health.routes';
import { authRoutes } from '@/modules/auth/auth.routes';
import { cardsRoutes } from '@/modules/cards/cards.routes';
import { apiDocsRouter } from '@/config/swagger';

const app = express();

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
    origin: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0),
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
if (env.API_DOCS_ENABLED) {
  app.use('/api-docs', apiDocsRouter);
}

// Error handler (must be last)
app.use(errorHandler);

export { app };
