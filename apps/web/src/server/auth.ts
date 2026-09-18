import NextAuth, { AuthError } from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { createHash } from 'node:crypto';
import { db } from './db';
import { mailer } from './mail';
import { email } from '../domain/policy';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database', maxAge: 7 * 86400, updateAge: 86400 },
  pages: { signIn: '/login', verifyRequest: '/login/check-email', error: '/login' },
  providers: [
    Resend({
      id: 'email',
      name: 'Email',
      from: process.env.EMAIL_FROM ?? 'EnergiePad <hello@energiepad.local>',
      maxAge: 15 * 60,
      normalizeIdentifier: (identifier) => email.parse(identifier),
      async sendVerificationRequest({ identifier, url }) {
        const normalized = email.parse(identifier);
        const window = Math.floor(Date.now() / 900_000);
        const key = createHash('sha256').update(`signin:${normalized}:${window}`).digest('hex');
        const bucket = await db.rateLimitBucket.upsert({
          where: { key },
          create: { key, count: 1, expiresAt: new Date((window + 1) * 900_000) },
          update: { count: { increment: 1 } },
        });
        if (bucket.count > 5) throw new Error('Please wait before requesting another sign-in link.');
        await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        await mailer.send({
          to: normalized,
          subject: 'Your EnergiePad sign-in link',
          text: `Sign in to EnergiePad:\n\n${url}\n\nThis link expires in 15 minutes and works once. If you did not request it, you can ignore this email.`,
        });
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  logger: {
    // Do not print provider payloads or URLs containing verification tokens.
    error(error) {
      console.error('Authentication failed', { type: error instanceof AuthError ? error.type : 'Unknown' });
    },
  },
});
