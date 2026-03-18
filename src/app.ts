import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { errorHandler } from '@/shared/middlewares/errorHandler';
import { healthRoutes } from '@/modules/health/health.routes';
import { apiDocsRouter } from '@/config/swagger';

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? '*',
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

// Body parsing
app.use(express.json());

// Logging
app.use(pinoHttp({ logger }));

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/v1/health', healthRoutes);
app.use('/api-docs', apiDocsRouter);

// Error handler (must be last)
app.use(errorHandler);

export { app };
