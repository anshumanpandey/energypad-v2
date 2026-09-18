import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createDatabase(url: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8 }) });
}
const globalDb = globalThis as unknown as { energiepadDb?: PrismaClient };
export const db =
  globalDb.energiepadDb ??
  createDatabase(process.env.DATABASE_URL ?? 'postgresql://energiepad:local-only@127.0.0.1:55432/energiepad_v2');
if (process.env.NODE_ENV !== 'production') globalDb.energiepadDb = db;
