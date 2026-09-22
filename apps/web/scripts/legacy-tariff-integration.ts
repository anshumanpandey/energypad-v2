import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fixture from '../tests/fixtures/legacy-tariffs.json';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyCatalogService } from '../src/server/energy-catalog';
import { LegacyTariffPreflight } from '../src/server/legacy/tariff-preflight';
import { testDatabase } from './test-database';
const { db, databaseUrl, cleanup } = await testDatabase();
const dir = await mkdtemp(path.join(tmpdir(), 'energiepad-migration-preview-'));
const mail = {
  async send() {
    throw new Error('No mail expected');
  },
};
const sites = new SiteService(db, mail, 'http://localhost:3100');
const preflight = new LegacyTariffPreflight(db, mail, 'http://localhost:3100');
try {
  const owner = actorFor(
    (await db.user.create({ data: { email: 'migration@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'other-migration@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(owner, { name: 'Migration', currency: 'GBP', timezone: 'UTC' });
  const other = await sites.createOrganisation(stranger, { name: 'Other', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(owner, org.id, { code: 'A', name: 'Target site' });
  const foreign = await sites.createSite(stranger, other.id, { code: 'B', name: 'Foreign site' });
  const input = structuredClone(fixture);
  input.decisions.sites[0].targetSiteId = site.id;
  const before = await db.auditEvent.count();
  assert.equal((await preflight.preview(owner, org.id, input)).ready, true);
  await assert.rejects(preflight.preview(stranger, org.id, input));
  const cross = structuredClone(input);
  cross.decisions.sites[0].targetSiteId = foreign.id;
  const blocked = await preflight.preview(owner, org.id, cross);
  assert.equal(blocked.ready, false);
  assert.equal(blocked.targetConflicts[0].code, 'SITE_UNAVAILABLE');
  assert.equal(await db.auditEvent.count(), before);
  assert.equal(await db.energyCatalogVersion.count(), 0);
  assert.equal(await db.siteEnergyUse.count(), 0);
  assert.equal(await db.tariffVersion.count(), 0);
  console.log('✓ read-only snapshot, owner/admin gate, foreign site rejection and no domain/audit writes');
  const source = path.join(dir, 'bundle.json'),
    output = path.join(dir, 'report.json');
  await writeFile(source, JSON.stringify(input));
  const run = (target: string) =>
    spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/legacy-tariff-preview.ts', org.id, owner.userId, source, target],
      { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
    );
  assert.equal(run(output).status, 0);
  const report = await readFile(output, 'utf8');
  assert.equal(JSON.parse(report).ready, true);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  assert.equal(run(output).status, 1);
  assert.equal(await readFile(output, 'utf8'), report);
  assert.equal(await db.energyCatalogVersion.count(), 0);
  const catalog = new EnergyCatalogService(db, mail, 'http://localhost:3100');
  const proposed = (await preflight.preview(owner, org.id, input)).plan.catalogs[0].input;
  await catalog.add(owner, org.id, site.id, proposed);
  assert.equal(run(path.join(dir, 'blocked.json')).status, 2);
  const existing = await preflight.preview(owner, org.id, input);
  assert.equal(existing.targetConflicts[0].code, 'CATALOG_ALREADY_PRESENT');
  const huge = path.join(dir, 'oversized.json');
  await writeFile(huge, ' '.repeat(2_000_001));
  const oversized = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/legacy-tariff-preview.ts', org.id, owner.userId, huge, path.join(dir, 'never.json')],
    { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
  );
  assert.equal(oversized.status, 1);
  const member = await db.membership.findFirstOrThrow({ where: { organisationId: org.id, userId: owner.userId } });
  await db.membership.update({ where: { id: member.id }, data: { role: 'VIEWER' } });
  await assert.rejects(preflight.preview(owner, org.id, input));
  console.log(
    '✓ CLI ready/blocked/error exits, private report permissions, overwrite protection, size limit and target conflicts',
  );
} finally {
  await cleanup();
  await rm(dir, { recursive: true, force: true });
}
