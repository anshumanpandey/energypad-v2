import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseConnection, writesFrozen } from './write-freeze';

export function createDatabase(url: string, frozen = writesFrozen()) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseConnection(url, frozen), max: 8 }) });
}
const globalDb = globalThis as unknown as { energiepadDb?: PrismaClient };
export const db =
  globalDb.energiepadDb ??
  createDatabase(process.env.DATABASE_URL ?? 'postgresql://energiepad:local-only@127.0.0.1:55432/energiepad_v2');
if (process.env.NODE_ENV !== 'production') globalDb.energiepadDb = db;
