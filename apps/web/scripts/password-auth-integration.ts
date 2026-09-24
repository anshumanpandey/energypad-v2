import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { PasswordAuth } from '../src/server/password-auth';
import { actorFor, FoundationService } from '../src/server/foundation';
import { DomainError } from '../src/domain/policy';
import { hashPassword, verifyPassword } from '../src/server/password';

const { db, cleanup } = await testDatabase();
const auth = new PasswordAuth(db);
const password = ' example password 123 ';
const input = { email: 'Password@EXAMPLE.test', password };
const denied = (work: Promise<unknown>, code: string) =>
  assert.rejects(work, (error: unknown) => error instanceof DomainError && error.code === code);
try {
  const first = await auth.signup(input, '127.0.0.1');
  const user = await db.user.findUniqueOrThrow({
    where: { email: 'password@example.test' },
    include: { passwordCredential: true },
  });
  assert.equal(user.emailVerified, null);
  assert.ok(user.passwordCredential);
  assert.notEqual(user.passwordCredential.passwordHash, password);
  assert.notEqual(await hashPassword(password), user.passwordCredential.passwordHash);
  assert.equal(await verifyPassword(password.trim(), user.passwordCredential.passwordHash), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
  assert.ok(first.expires.getTime() > Date.now());
  assert.equal((await db.session.findUniqueOrThrow({ where: { sessionToken: first.sessionToken } })).userId, user.id);
  const service = new FoundationService(
    db,
    {
      async send() {
        throw new Error('Signup must not send mail');
      },
    },
    'http://localhost:3100',
  );
  const org = await service.createOrganisation(actorFor(user.id), {
    name: 'Password workspace',
    currency: 'GBP',
    timezone: 'UTC',
  });
  assert.ok(await service.getWorkspace(actorFor(user.id), org.id));
  await denied(auth.signup(input, '127.0.0.1'), 'SignupFailed');
  await denied(auth.login({ ...input, password: 'incorrect password' }, '127.0.0.1'), 'Credentials');
  await denied(auth.login({ ...input, email: 'missing@example.test' }, '127.0.0.1'), 'Credentials');
  assert.equal(await db.session.count(), 1);
  const second = await auth.login(input, '127.0.0.1');
  assert.notEqual(second.sessionToken, first.sessionToken);
  const legacy = await db.user.create({ data: { email: 'legacy@example.test', emailVerified: new Date() } });
  await denied(auth.signup({ ...input, email: legacy.email }, '127.0.0.1'), 'SignupFailed');
  assert.equal(await db.passwordCredential.count({ where: { userId: legacy.id } }), 0);
  const results = await Promise.allSettled([
    auth.signup({ ...input, email: 'race@example.test' }, '127.0.0.1'),
    auth.signup({ ...input, email: 'race@example.test' }, '127.0.0.1'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  await db.rateLimitBucket.deleteMany();
  for (let i = 0; i < 10; i++)
    await denied(auth.login({ ...input, email: 'limited@example.test' }, '127.0.0.2'), 'Credentials');
  await denied(auth.login({ ...input, email: 'limited@example.test' }, '127.0.0.2'), 'RateLimited');
  console.log('✓ Password signup, hashing, sessions, workspace access, duplicate protection and rate limits');
} finally {
  await cleanup();
}
