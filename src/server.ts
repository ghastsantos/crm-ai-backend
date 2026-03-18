import { app } from './app';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { prisma } from '@/infrastructure/database/prisma';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started');
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
