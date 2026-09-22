import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fixture from '../tests/fixtures/legacy-tariffs.json';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { LegacyTariffApply } from '../src/server/legacy/tariff-apply';
import { testDatabase } from './test-database';
const { db, databaseUrl, cleanup } = await testDatabase();
const dir = await mkdtemp(path.join(tmpdir(), 'tariff-apply-test-'));
const mail = {
  async send() {
    throw new Error('No mail');
  },
};
const sites = new SiteService(db, mail, 'http://localhost:3100');
const service = new LegacyTariffApply(db, mail, 'http://localhost:3100');
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'apply@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Apply', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'A', name: 'Target' });
  const input = structuredClone(fixture);
  input.decisions.sites[0].targetSiteId = site.id;
  const report = await service.preview(actor, org.id, input);
  const changed = structuredClone(input);
  changed.reference = 'Changed review source';
  await assert.rejects(service.apply(actor, org.id, changed, report));
  await db.site.update({ where: { id: site.id }, data: { archivedAt: new Date() } });
  await assert.rejects(service.apply(actor, org.id, input, report));
  await db.site.update({ where: { id: site.id }, data: { archivedAt: null } });
  const before = await db.auditEvent.count();
  // Force a late failure after catalog and site-use writes to verify transaction rollback.
  await db.$executeRawUnsafe(
    `CREATE FUNCTION reject_test_tariff() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER reject_test_tariff BEFORE INSERT ON "TariffVersion" FOR EACH ROW EXECUTE FUNCTION reject_test_tariff()`,
  );
  await assert.rejects(service.apply(actor, org.id, input, report));
  assert.equal(await db.energyCatalogVersion.count(), 0);
  assert.equal(await db.siteEnergyUse.count(), 0);
  assert.equal(await db.legacyTariffBatch.count(), 0);
  assert.equal(await db.auditEvent.count(), before);
  await db.$executeRawUnsafe('DROP TRIGGER reject_test_tariff ON "TariffVersion"');
  const results = await Promise.all([
    service.apply(actor, org.id, input, report),
    service.apply(actor, org.id, input, report),
  ]);
  assert.equal(results[0].batch.id, results[1].batch.id);
  assert.equal(results.filter((r) => r.reused).length, 1);
  assert.equal(await db.energyCatalogVersion.count(), 2);
  assert.equal(await db.siteEnergyUse.count(), 1);
  assert.equal(await db.tariffVersion.count(), 1);
  assert.equal(await db.legacyTariffBatch.count(), 1);
  const receipt = results[0].batch.receipt as { ledger: { targetId: string; original: unknown }[] };
  assert.equal(receipt.ledger.length, 5);
  assert.ok(receipt.ledger.every((r) => r.targetId && r.original));
  const tariff = await db.tariffVersion.findFirstOrThrow();
  assert.equal(tariff.vatPercent.toString(), '20');
  assert.equal((tariff.bands as { rate: string }[])[0].rate, '0.15');
  const audits = await db.auditEvent.count();
  assert.equal((await service.apply(actor, org.id, input, report)).reused, true);
  assert.equal(await db.auditEvent.count(), audits);
  const fresh = await service.preview(actor, org.id, changed);
  await assert.rejects(service.apply(actor, org.id, changed, { ...fresh, ready: true }));
  await assert.rejects(db.legacyTariffBatch.delete({ where: { id: results[0].batch.id } }));
  await assert.rejects(
    db.legacyTariffBatch.update({ where: { id: results[0].batch.id }, data: { source: 'changed' } }),
  );
  await assert.rejects(db.$executeRawUnsafe('TRUNCATE "LegacyTariffBatch"'));
  const bundleFile = path.join(dir, 'bundle.json');
  const reportFile = path.join(dir, 'report.json');
  await writeFile(bundleFile, JSON.stringify(input));
  await writeFile(reportFile, JSON.stringify(report));
  const cli = () =>
    spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/legacy-tariff-apply.ts', org.id, actor.userId, bundleFile, reportFile],
      { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
    );
  const retry = cli();
  assert.equal(retry.status, 0, retry.stderr);
  assert.ok(retry.stdout.includes(results[0].batch.id));
  assert.equal(await db.auditEvent.count(), audits);
  const member = await db.membership.findFirstOrThrow({ where: { organisationId: org.id, userId: actor.userId } });
  await db.membership.update({ where: { id: member.id }, data: { role: 'VIEWER' } });
  await assert.rejects(service.apply(actor, org.id, input, report));
  assert.equal(cli().status, 1);
  console.log(
    '✓ reviewed hash, stale destination, late rollback, concurrent/repeated apply, provenance, decimal conversion, immutable receipt and revoked permission',
  );
} finally {
  await cleanup();
  await rm(dir, { recursive: true, force: true });
}
