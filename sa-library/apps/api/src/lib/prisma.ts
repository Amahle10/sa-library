import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

let prisma: PrismaClient | undefined;

// Keep database access lazy: health checks and startup do not require PostgreSQL.
export function getPrisma(): PrismaClient {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required for database access');
  prisma ??= new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: env.DATABASE_URL },
      { schema: new URL(env.DATABASE_URL).searchParams.get('schema') ?? 'public' },
    ),
  });
  return prisma;
}
