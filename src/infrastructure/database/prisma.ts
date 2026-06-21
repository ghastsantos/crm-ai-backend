import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const logQueries = env.NODE_ENV === 'development' && env.LOG_LEVEL === 'trace';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logQueries
      ? [
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'error' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
