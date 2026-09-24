import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { Prisma, type PrismaClient } from '@prisma/client';
import { email, DomainError } from '../domain/policy';
import { hashPassword, passwordInput, verifyPassword } from './password';
import { sessionMaxAge } from './session-cookie';

export class PasswordAuth {
  constructor(private db: PrismaClient) {}

  private async limit(address: string, ip: string) {
    const window = Math.floor(Date.now() / 900_000);
    for (const [scope, value, limit] of [
      ['email', address, 10],
      ['ip', isIP(ip) ? ip : 'unknown', 60],
    ] as const) {
      const key = createHash('sha256').update(`password:${scope}:${value}:${window}`).digest('hex');
      const bucket = await this.db.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date((window + 1) * 900_000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > limit) throw new DomainError('RateLimited', 'Try again in 15 minutes.', 429);
    }
    await this.db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  private async session(userId: string, database: Pick<PrismaClient, 'session'> = this.db) {
    const sessionToken = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + sessionMaxAge * 1000);
    await database.session.create({ data: { userId, sessionToken, expires } });
    return { sessionToken, expires };
  }

  async signup(input: { email: unknown; password: unknown }, ip: string) {
    const address = email.parse(input.email);
    const password = passwordInput.parse(input.password);
    await this.limit(address, ip);
    const passwordHash = await hashPassword(password);
    try {
      // Never attach a password to an existing account just by knowing its email.
      return await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: address, passwordCredential: { create: { passwordHash } } },
          select: { id: true },
        });
        return await this.session(user.id, tx);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new DomainError('SignupFailed', 'Unable to create this account. Try signing in instead.', 409);
      throw error;
    }
  }

  async login(input: { email: unknown; password: unknown }, ip: string) {
    const address = email.parse(input.email);
    const password = passwordInput.parse(input.password);
    await this.limit(address, ip);
    const user = await this.db.user.findUnique({
      where: { email: address },
      select: { id: true, passwordCredential: { select: { passwordHash: true } } },
    });
    if (!(await verifyPassword(password, user?.passwordCredential?.passwordHash)) || !user)
      throw new DomainError('Credentials', 'Email or password is incorrect.', 401);
    return this.session(user.id);
  }
}
