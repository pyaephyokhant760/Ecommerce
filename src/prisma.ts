import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Cache the client on `globalThis` so nodemon/ts-node hot reloads don't leak
// a new connection pool on every restart.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined in .env file');
  }

  return new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;