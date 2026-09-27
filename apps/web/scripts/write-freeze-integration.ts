import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { createDatabase } from '../src/server/db';
import { frozenSession } from '../src/server/frozen-session';
const fixture = await testDatabase();
const frozen = createDatabase(fixture.databaseUrl, true);
try {
  const user = await fixture.db.user.create({ data: { email: 'freeze@example.test', emailVerified: new Date() } });
  const expires = new Date(Date.now() + 3600000);
  await fixture.db.session.create({ data: { userId: user.id, sessionToken: 'synthetic-freeze-session', expires } });
  const setting = await frozen.$queryRaw<
    { default_transaction_read_only: string }[]
  >`SHOW default_transaction_read_only`;
  assert.equal(setting[0].default_transaction_read_only, 'on');
  assert.ok(await frozen.user.findUnique({ where: { id: user.id } }));
  await assert.rejects(frozen.user.create({ data: { email: 'blocked@example.test' } }));
  await assert.rejects(
    frozen.$transaction((tx) => tx.user.update({ where: { id: user.id }, data: { name: 'blocked' } })),
  );
  await assert.rejects(frozen.$executeRaw`UPDATE "User" SET name = 'blocked' WHERE id = ${user.id}::uuid`);
  assert.equal((await frozenSession(frozen, 'synthetic-freeze-session'))?.user.id, user.id);
  assert.equal(await frozenSession(frozen, 'synthetic-freeze-session', new Date(expires.getTime() + 1)), null);
  assert.equal(await frozenSession(frozen, undefined), null);
  assert.equal(
    (
      await fixture.db.session.findUniqueOrThrow({ where: { sessionToken: 'synthetic-freeze-session' } })
    ).expires.getTime(),
    expires.getTime(),
  );
  assert.equal(await fixture.db.user.count(), 1);
  console.log('✓ write freeze: PostgreSQL rejects ORM/transaction/raw writes; existing sessions read without renewal');
} finally {
  await frozen.$disconnect();
  await fixture.cleanup();
}
