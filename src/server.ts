import { app } from './app';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { prisma } from '@/infrastructure/database/prisma';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started');
  if (env.NODE_ENV === 'production') {
    if (env.API_DOCS_ENABLED) {
      logger.warn(
        'API_DOCS_ENABLED is true: /api-docs is exposed; set API_DOCS_ENABLED=false for public production unless intentional'
      );
    }
    if (env.AUTH_TOKEN_IN_BODY) {
      logger.warn(
        'AUTH_TOKEN_IN_BODY is true: JWT is included in JSON; set false with httpOnly cookies to reduce XSS token exposure (see docs/production-security.md)'
      );
    }
    if (env.AUTH_HTTPONLY_COOKIE_ENABLED && !env.AUTH_ENFORCE_ORIGIN_ON_MUTATIONS) {
      logger.warn(
        'AUTH_ENFORCE_ORIGIN_ON_MUTATIONS is false while cookie auth is enabled; consider true when SPA origins are fixed (see docs/production-security.md)'
      );
    }
  }
});

function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal');
  server.close(() => {
    logger.info('HTTP server closed');
    prisma
      .$disconnect()
      .then(() => {
        logger.info('Database disconnected');
        process.exit(0);
      })
      .catch((err) => {
        logger.error({ err }, 'Error disconnecting database');
        process.exit(1);
      });
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
