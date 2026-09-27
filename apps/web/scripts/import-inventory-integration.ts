import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './test-database';
import { createDatabase } from '../src/server/db';
import { actorFor } from '../src/server/foundation';
import { ImportInventoryService } from '../src/server/import-inventory';
import { DomainError } from '../src/domain/policy';

const { db, databaseUrl, cleanup } = await testDatabase();
const service = new ImportInventoryService(db, { async send() {} }, 'http://localhost:3100');
const before = '2020-02-01T00:00:00.000Z';
try {
  const owner = actorFor(
    (await db.user.create({ data: { email: 'inventory@example.test', emailVerified: new Date() } })).id,
  );
  const org = await service.createOrganisation(owner, { name: 'Inventory', currency: 'GBP', timezone: 'UTC' });
  const other = await service.createOrganisation(owner, { name: 'Other inventory', currency: 'GBP', timezone: 'UTC' });
  const site = await db.site.create({ data: { organisationId: org.id, code: 'INV', name: 'Inventory site' } });
  const meter = await db.meter.create({
    data: { organisationId: org.id, siteId: site.id, code: 'INV', name: 'Meter', fuel: 'electricity', unit: 'kWh' },
  });
  const privatePayload = { privateImportContent: 'must never be returned' };
  for (const scenario of [
    { status: 'READY', createdAt: new Date('2020-01-01T00:00:00Z'), committedAt: null },
    { status: 'INVALID', createdAt: new Date(before), committedAt: null },
    { status: 'COMMITTED', createdAt: new Date('2020-01-01T00:00:00Z'), committedAt: new Date(before) },
    { status: 'INVALID', createdAt: new Date('2020-01-01T00:00:00Z'), committedAt: new Date(before) },
    { status: 'READY', createdAt: new Date('2020-01-01T00:00:00Z'), committedAt: new Date(before) },
    { status: 'COMMITTED', createdAt: new Date('2020-01-01T00:00:00Z'), committedAt: null },
  ]) {
    const base = { ...scenario, organisationId: org.id, createdBy: owner.userId, fingerprint: randomUUID() };
    await db.importBatch.create({ data: { ...base, sheets: privatePayload } });
    await db.energyImportBatch.create({
      data: { ...base, siteId: site.id, meterId: meter.id, sheets: privatePayload },
    });
    const scoped = { ...base, siteId: site.id, result: privatePayload };
    await db.driverImportBatch.create({ data: scoped });
    await db.occupancyImportBatch.create({ data: scoped });
    await db.patternImportBatch.create({ data: scoped });
    await db.eventImportBatch.create({ data: scoped });
    await db.carbonWorkbookBatch.create({
      data: {
        ...scenario,
        organisationId: org.id,
        siteId: site.id,
        fingerprint: randomUUID(),
        authorId: owner.userId,
        kind: 'emissions',
        result: privatePayload,
      },
    });
  }
  await db.importBatch.create({
    data: {
      organisationId: other.id,
      fingerprint: randomUUID(),
      createdBy: owner.userId,
      sheets: privatePayload,
      createdAt: new Date('2010-01-01T00:00:00Z'),
    },
  });
  const auditCount = await db.auditEvent.count();
  const result = await service.overview(owner, org.id, before);
  assert.equal(result.deletionEnabled, false);
  assert.equal(result.summaries.length, 7);
  for (const summary of result.summaries) {
    assert.equal(summary.total, '6');
    assert.equal(summary.staged, '2');
    assert.equal(summary.committed, '1');
    assert.equal(summary.inconsistent, '3');
    assert.equal(summary.stagedBeforeCutoff, '1');
    assert.equal(summary.oldestCreatedAt?.toISOString(), '2020-01-01T00:00:00.000Z');
  }
  assert.ok(!JSON.stringify(result).includes('privateImportContent'));
  const empty = (await service.overview(owner, other.id, before)).summaries.find((row) => row.kind === 'energy')!;
  assert.equal(empty.total, '0');
  assert.equal(empty.oldestCreatedAt, null);
  for (const role of ['ADMIN', 'ANALYST', 'SITE_MANAGER', 'VIEWER'] as const) {
    const user = await db.user.create({ data: { email: `${role}@inventory.test`, emailVerified: new Date() } });
    const actor = actorFor(user.id);
    const member = await db.membership.create({ data: { organisationId: org.id, userId: user.id, role } });
    if (role === 'ADMIN') assert.equal((await service.overview(actor, org.id, before)).summaries.length, 7);
    else
      await assert.rejects(
        service.overview(actor, org.id, before),
        (e: unknown) => e instanceof DomainError && e.status === 403,
      );
    if (role !== 'ADMIN')
      await assert.rejects(
        service.exportInventory(actor, org.id, before, result.fingerprint),
        (e: unknown) => e instanceof DomainError && e.status === 403,
      );
    if (role === 'ADMIN')
      assert.equal((await service.inconsistentBatches(actor, org.id, { category: 'sites' })).items.length, 3);
    else
      await assert.rejects(
        service.inconsistentBatches(actor, org.id, { category: 'sites' }),
        (e: unknown) => e instanceof DomainError && e.status === 403,
      );
    await db.membership.update({ where: { id: member.id }, data: { revokedAt: new Date() } });
    await assert.rejects(
      service.inconsistentBatches(actor, org.id, { category: 'sites' }),
      (e: unknown) => e instanceof DomainError && e.status === 404,
    );
    await assert.rejects(
      service.exportInventory(actor, org.id, before, result.fingerprint),
      (e: unknown) => e instanceof DomainError && e.status === 404,
    );
    await assert.rejects(
      service.overview(actor, org.id, before),
      (e: unknown) => e instanceof DomainError && e.status === 404,
    );
  }
  const outsider = actorFor(
    (
      await db.user.create({
        data: { email: 'platform@inventory.test', emailVerified: new Date(), platformRole: 'PLATFORM_ADMIN' },
      })
    ).id,
  );
  await assert.rejects(
    service.overview(outsider, org.id, before),
    (e: unknown) => e instanceof DomainError && e.status === 404,
  );
  await assert.rejects(service.overview(owner, org.id, '2999-01-01T00:00:00Z'));
  const frozen = createDatabase(databaseUrl, true);
  try {
    const frozenService = new ImportInventoryService(frozen, { async send() {} }, 'http://localhost:3100');
    assert.deepEqual((await frozenService.overview(owner, org.id, before)).summaries, result.summaries);
    assert.equal((await frozenService.inconsistentBatches(owner, org.id, { category: 'sites' })).items.length, 3);
    await assert.rejects(frozenService.exportInventory(owner, org.id, before, result.fingerprint));
  } finally {
    await frozen.$disconnect();
  }
  assert.equal(await db.auditEvent.count(), auditCount);
  assert.equal(await db.importBatch.count(), 7);
  const exported = await service.exportInventory(actorFor(owner.userId), org.id, before, result.fingerprint);
  assert.equal(exported.exportVersion, 'import-inventory-v1');
  assert.deepEqual(exported.summaries, result.summaries);
  assert.equal(exported.fingerprint, result.fingerprint);
  assert.equal((await service.overview(owner, org.id, before)).fingerprint, result.fingerprint);
  await service.exportInventory(actorFor(owner.userId), org.id, before, result.fingerprint);
  assert.equal(
    await db.auditEvent.count({ where: { action: 'retention.inventory_exported', organisationId: org.id } }),
    2,
  );
  class FailingAudit extends ImportInventoryService {
    protected override async audit(...args: Parameters<ImportInventoryService['audit']>) {
      await super.audit(...args);
      throw new Error('Injected audit failure');
    }
  }
  await assert.rejects(
    new FailingAudit(db, { async send() {} }, 'http://localhost:3100').exportInventory(
      actorFor(owner.userId),
      org.id,
      before,
      result.fingerprint,
    ),
  );
  assert.equal(await db.auditEvent.count(), auditCount + 2);
  await assert.rejects(
    service.exportInventory(owner, other.id, before, result.fingerprint),
    (e: unknown) => e instanceof DomainError && e.status === 409,
  );
  await db.importBatch.create({
    data: {
      organisationId: org.id,
      fingerprint: randomUUID(),
      createdBy: owner.userId,
      sheets: privatePayload,
      status: 'READY',
      createdAt: new Date('2020-01-05T00:00:00Z'),
    },
  });
  await assert.rejects(
    service.exportInventory(owner, org.id, before, result.fingerprint),
    (e: unknown) => e instanceof DomainError && e.code === 'STALE_INVENTORY',
  );
  assert.equal(await db.auditEvent.count(), auditCount + 2);
  for (const category of ['sites', 'energy', 'drivers', 'occupancy', 'patterns', 'events', 'carbon']) {
    const review = await service.inconsistentBatches(owner, org.id, { category });
    assert.equal(review.items.length, 3);
    assert.equal(review.nextCursor, null);
    assert.deepEqual(Object.keys(review.items[0]).sort(), ['committedAt', 'createdAt', 'id', 'status']);
  }
  await db.importBatch.createMany({
    data: Array.from({ length: 107 }, () => ({
      organisationId: org.id,
      createdBy: owner.userId,
      fingerprint: randomUUID(),
      sheets: privatePayload,
      status: 'COMMITTED',
      createdAt: new Date('2019-01-01T00:00:00Z'),
    })),
  });
  const firstPage = await service.inconsistentBatches(owner, org.id, { category: 'sites' });
  assert.equal(firstPage.items.length, 50);
  assert.ok(firstPage.nextCursor);
  const firstIds = firstPage.items.map((item) => item.id);
  // Newer arrivals cannot shift the boundary for an older page.
  const newer = await db.importBatch.create({
    data: {
      organisationId: org.id,
      createdBy: owner.userId,
      fingerprint: randomUUID(),
      sheets: privatePayload,
      status: 'COMMITTED',
      createdAt: new Date('2021-01-01T00:00:00Z'),
    },
  });
  const secondPage = await service.inconsistentBatches(owner, org.id, {
    category: 'sites',
    cursor: firstPage.nextCursor,
  });
  const lastPage = await service.inconsistentBatches(owner, org.id, {
    category: 'sites',
    cursor: secondPage.nextCursor,
  });
  const ids = [...firstIds, ...secondPage.items.map((item) => item.id), ...lastPage.items.map((item) => item.id)];
  assert.equal(ids.length, 110);
  assert.equal(new Set(ids).size, 110);
  assert.ok(!ids.includes(newer.id));
  assert.equal(lastPage.nextCursor, null);
  const foreign = await db.importBatch.findFirstOrThrow({ where: { organisationId: other.id } });
  const consistent = await db.importBatch.findFirstOrThrow({
    where: { organisationId: org.id, status: 'READY', committedAt: null },
  });
  const wrongCategory = (await service.inconsistentBatches(owner, org.id, { category: 'energy' })).items[0].id;
  for (const cursor of [foreign.id, consistent.id, wrongCategory, randomUUID()])
    await assert.rejects(
      service.inconsistentBatches(owner, org.id, { category: 'sites', cursor }),
      (e: unknown) => e instanceof DomainError && e.status === 404,
    );
  await assert.rejects(
    service.inconsistentBatches(outsider, org.id, { category: 'sites' }),
    (e: unknown) => e instanceof DomainError && e.status === 404,
  );
  assert.equal(await db.auditEvent.count(), auditCount + 2);
  console.log(
    '✓ import inventory: all categories, boundary, tenant scope, roles, revocation, privacy and read-only freeze',
  );
} finally {
  await cleanup();
}
