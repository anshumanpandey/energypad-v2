import type { PrismaClient } from '@prisma/client';

// Existing sessions can be read without Auth.js renewal or expired-session deletion.
export async function frozenSession(db: PrismaClient, token: string | undefined, now = new Date()) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { sessionToken: token },
    select: { expires: true, user: { select: { id: true, email: true, name: true, image: true } } },
  });
  if (!session || session.expires <= now) return null;
  return { user: session.user, expires: session.expires.toISOString() };
}
