import { db } from '@/server/db';
import { DatabaseHealth } from '@/server/health';
import { writesFrozen } from '@/server/write-freeze';

export const dynamic = 'force-dynamic';

const health = new DatabaseHealth(
  () => db.$queryRaw`SELECT 1`,
  (event) => console.log(JSON.stringify(event)),
);

export async function GET() {
  const status = await health.check();
  return Response.json(
    { status },
    {
      status: status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store', 'X-Write-Freeze': writesFrozen() ? 'enabled' : 'disabled' },
    },
  );
}
