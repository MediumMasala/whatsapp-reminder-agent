import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['warn', 'error'],
    });

    logger.info('Prisma client initialized');
  }

  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  }
}
