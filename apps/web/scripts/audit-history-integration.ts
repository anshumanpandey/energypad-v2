import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './test-database';
import { actorFor, FoundationService } from '../src/server/foundation';
import { DomainError } from '../src/domain/policy';

const { db, cleanup } = await testDatabase();
const service = new FoundationService(db, { async send() {} }, 'http://localhost:3100');
try {
  const owner = actorFor(
    (await db.user.create({ data: { email: 'audit-owner@example.test', emailVerified: new Date() } })).id,
  );
  const org = await service.createOrganisation(owner, { name: 'Audit history', currency: 'GBP', timezone: 'UTC' });
  const other = await service.createOrganisation(actorFor(owner.userId), {
    name: 'Other audit',
    currency: 'GBP',
    timezone: 'UTC',
  });
  const tied = new Date('2020-01-01T00:00:00Z');
  await db.auditEvent.createMany({
    data: Array.from({ length: 205 }, () => ({
      organisationId: org.id,
      actorUserId: owner.userId,
      action: 'test.history',
      targetId: org.id,
      correlationId: randomUUID(),
      createdAt: tied,
      metadata: {},
    })),
  });
  const expected = await db.auditEvent.findMany({
    where: { organisationId: org.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  const first = await service.auditHistory(owner, org.id);
  assert.equal(first.items.length, 100);
  assert.ok(first.nextCursor);
  // A newer insertion between pages must not shift the cursor boundary.
  await db.auditEvent.create({
    data: {
      organisationId: org.id,
      actorUserId: owner.userId,
      action: 'test.new',
      targetId: org.id,
      correlationId: randomUUID(),
      metadata: {},
    },
  });
  const second = await service.auditHistory(owner, org.id, first.nextCursor);
  const third = await service.auditHistory(owner, org.id, second.nextCursor!);
  assert.equal(third.nextCursor, null);
  assert.deepEqual(
    [...first.items, ...second.items, ...third.items].map((r) => r.id),
    expected.map((r) => r.id),
  );
  assert.equal((await service.listAudit(owner, org.id)).length, 100);
  const filtered = await service.auditHistory(owner, org.id, undefined, { action: 'test.history' });
  const filtered2 = await service.auditHistory(owner, org.id, filtered.nextCursor!, { action: 'test.history' });
  const filtered3 = await service.auditHistory(owner, org.id, filtered2.nextCursor!, { action: 'test.history' });
  const matching = [...filtered.items, ...filtered2.items, ...filtered3.items];
  assert.equal(matching.length, 205);
  assert.equal(new Set(matching.map((r) => r.id)).size, 205);
  assert.ok(matching.every((r) => r.action === 'test.history'));
  const requestId = matching[0].correlationId;
  assert.equal((await service.auditHistory(owner, org.id, undefined, { requestId })).items[0].id, matching[0].id);
  assert.equal(
    (await service.auditHistory(owner, org.id, undefined, { action: 'test.new', requestId })).items.length,
    0,
  );
  await assert.rejects(
    service.auditHistory(owner, org.id, filtered.nextCursor!, { action: 'test.new' }),
    (e: unknown) => e instanceof DomainError && e.status === 404,
  );
  await assert.rejects(service.auditHistory(owner, org.id, undefined, { requestId: 'invalid' }));
  const exportCount = await db.auditEvent.count({ where: { organisationId: org.id, action: 'audit.page_exported' } });
  const exported = await service.exportAudit(owner, org.id, filtered.nextCursor!, { action: 'test.history' });
  assert.deepEqual(
    exported.items.map((r) => r.id),
    filtered2.items.map((r) => r.id),
  );
  assert.equal(exported.nextCursor, filtered2.nextCursor);
  assert.equal(exported.filters.action, 'test.history');
  assert.equal(exported.cursor, filtered.nextCursor);
  assert.equal(
    await db.auditEvent.count({ where: { organisationId: org.id, action: 'audit.page_exported' } }),
    exportCount + 1,
  );
  await db.$executeRawUnsafe(
    `CREATE FUNCTION reject_audit_export_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'audit.page_exported' THEN RAISE EXCEPTION 'test rejection'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER reject_audit_export_test BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION reject_audit_export_test()`,
  );
  await assert.rejects(service.exportAudit(owner, org.id));
  await db.$executeRawUnsafe('DROP TRIGGER reject_audit_export_test ON "AuditEvent"');
  assert.equal(
    await db.auditEvent.count({ where: { organisationId: org.id, action: 'audit.page_exported' } }),
    exportCount + 1,
  );
  const foreign = await db.auditEvent.findFirstOrThrow({ where: { organisationId: other.id } });
  assert.equal(
    (await service.auditHistory(owner, org.id, undefined, { requestId: foreign.correlationId })).items.length,
    0,
  );
  for (const cursor of [foreign.id, randomUUID()])
    await assert.rejects(
      service.auditHistory(owner, org.id, cursor),
      (e: unknown) => e instanceof DomainError && e.status === 404,
    );
  await assert.rejects(service.auditHistory(owner, org.id, 'invalid'));
  for (const role of ['ADMIN', 'ANALYST', 'SITE_MANAGER', 'VIEWER'] as const) {
    const user = await db.user.create({ data: { email: `${role}@example.test`, emailVerified: new Date() } });
    const member = await db.membership.create({ data: { userId: user.id, organisationId: org.id, role } });
    if (role === 'ADMIN') assert.equal((await service.auditHistory(actorFor(user.id), org.id)).items.length, 100);
    else
      await assert.rejects(
        service.auditHistory(actorFor(user.id), org.id),
        (e: unknown) => e instanceof DomainError && e.status === 403,
      );
    await db.membership.update({ where: { id: member.id }, data: { revokedAt: new Date() } });
    await assert.rejects(
      service.exportAudit(actorFor(user.id), org.id),
      (e: unknown) => e instanceof DomainError && e.status === 404,
    );
    await assert.rejects(
      service.auditHistory(actorFor(user.id), org.id, first.nextCursor),
      (e: unknown) => e instanceof DomainError && e.status === 404,
    );
  }
  const outsider = actorFor(
    (
      await db.user.create({
        data: { email: 'outside@example.test', emailVerified: new Date(), platformRole: 'PLATFORM_ADMIN' },
      })
    ).id,
  );
  await assert.rejects(
    service.auditHistory(outsider, org.id),
    (e: unknown) => e instanceof DomainError && e.status === 404,
  );
  console.log(
    '✓ audit history: tied timestamps, stable pagination, new inserts, scoped cursors, roles, revocation and legacy API',
  );
} finally {
  await cleanup();
}
