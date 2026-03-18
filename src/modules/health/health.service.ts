import { prisma } from '@/infrastructure/database/prisma';

export interface HealthStatus {
  database: 'ok' | 'error';
  timestamp: string;
}

export async function checkReadiness(): Promise<HealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      database: 'ok',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      database: 'error',
      timestamp: new Date().toISOString(),
    };
  }
}
