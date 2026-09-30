import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { testDatabase } from './test-database';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { CarbonService } from '../src/server/carbon';
import { HistoricEmissionsService } from '../src/server/historic-emissions';
import { emissionsColumns } from '../src/domain/historic-emissions';
import { WorkbookCellError } from '../src/domain/workbook-errors';
import type { CarbonSnapshot } from '../src/domain/carbon';
const { db, cleanup } = await testDatabase();
const args = [db, { async send() {} }, 'http://localhost:3100'] as const;
const service = new HistoricEmissionsService(...args),
  sites = new SiteService(...args),
  energy = new EnergyService(...args),
  carbon = new CarbonService(...args);
const settings = { geography: 'GB', basis: 'LOCATION_BASED' };
async function workbook(rows: unknown[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Emissions');
  sheet.addRow(['', ...emissionsColumns.slice(1)]);
  rows.forEach((row) => sheet.addRow(row));
  sheet.getColumn(6).numFmt = '0.00';
  book.addWorksheet('Ignored').getCell('A1').value = { error: '#VALUE!' };
  return new Uint8Array(await book.xlsx.writeBuffer());
}
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'emissions@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'stranger@example.test', emailVerified: new Date() } })).id,
  );
  const org = await service.createOrganisation(actor, { name: 'Emission imports', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'site_mit', name: 'MIT' });
  const other = await sites.createSite(actor, org.id, { code: 'OTHER', name: 'Other site' });
  const rows = Array.from({ length: 12 }, (_, i) => [
    'site_mit',
    2024,
    i + 1,
    'Gas',
    'kWh',
    { formula: '1/2', result: 0.5 },
  ]);
  const bytes = await workbook(rows);
  await assert.rejects(service.process(stranger, org.id, bytes, settings));
  const preview = await service.process(actor, org.id, bytes, settings);
  assert.equal(preview.count, 12);
  assert.equal(await db.emissionFactorVersion.count(), 0);
  await assert.rejects(service.process(actor, org.id, bytes, settings, 'stale'), /changed/);
  await assert.rejects(
    service.process(
      actor,
      org.id,
      await workbook([['missing', 'invalid', '13', '??', 'MWh', { error: '#DIV/0!' }]]),
      settings,
    ),
    (error) => {
      assert.ok(error instanceof WorkbookCellError);
      assert.deepEqual(
        error.cellErrors.map((e) => e.cell),
        ['A2', 'B2', 'C2', 'D2', 'E2', 'F2'],
      );
      return true;
    },
  );
  assert.equal(await db.emissionFactorVersion.count(), 0);
  await Promise.all([
    service.process(actor, org.id, bytes, settings, preview.signature),
    service.process(actor, org.id, bytes, settings, preview.signature),
  ]);
  assert.equal(await db.emissionFactorVersion.count(), 12);
  const manager = await db.membership.create({
    data: { organisationId: org.id, userId: stranger.userId, role: 'SITE_MANAGER' },
  });
  assert.equal((await service.list(stranger, org.id)).length, 0);
  await db.siteAssignment.create({ data: { organisationId: org.id, membershipId: manager.id, siteId: site.id } });
  assert.equal((await service.list(stranger, org.id)).length, 12);
  await assert.rejects(service.process(stranger, org.id, bytes, settings));
  assert.equal((await service.process(actor, org.id, bytes, settings)).committed, true);
  const changed = await workbook([
    ['site_mit', 2024, 1, 'Gas', 'kWh', 0.6],
    ['site_mit', 2024, 2, 'Gas', 'kWh', 0.8],
  ]);
  await assert.rejects(
    service.process(actor, org.id, changed, settings),
    (e) => e instanceof WorkbookCellError && e.cellErrors.length === 2,
  );
  // Other sites can use independent factors for the same dates; carbon must never borrow them.
  const otherBytes = await workbook([['OTHER', 2024, 1, 'Gas', 'kWh', 0.9]]);
  const otherPreview = await service.process(actor, org.id, otherBytes, settings);
  await service.process(actor, org.id, otherBytes, settings, otherPreview.signature);
  const meters = [];
  for (const target of [site, other]) {
    const meter = await sites.saveMeter(actor, org.id, target.id, {
      code: 'GAS',
      name: 'Gas meter',
      fuel: 'GAS',
      unit: 'kWh',
    });
    meters.push(meter);
    for (let month = 1; month <= 12; month++)
      await energy.add(actor, org.id, target.id, {
        meterId: meter.id,
        month: `2024-${String(month).padStart(2, '0')}`,
        quantity: '100',
      });
    const snapshot = (
      await carbon.calculate(actor, org.id, target.id, {
        ...settings,
        year: 2024,
        meterId: meter.id,
        requestKey: randomUUID(),
      })
    ).snapshot as unknown as CarbonSnapshot;
    assert.equal(snapshot.status, target.id === site.id ? 'COMPLETE' : 'BLOCKED');
    assert.equal(snapshot.rows[0].kgCO2e, target.id === site.id ? '50' : '90');
  }
  assert.equal((await carbon.summary(actor, org.id, site.id, { ...settings, year: 2024 })).totalKgCO2e, '600');
  const factor = await db.emissionFactorVersion.findFirstOrThrow({
    where: { siteId: site.id },
    orderBy: { validFrom: 'asc' },
  });
  await service.correct(actor, org.id, factor.id, {
    reason: 'Reviewed source correction',
    factor: {
      fuel: 'GAS',
      ...settings,
      unit: 'kgCO2e/kWh',
      factor: '0.4',
      source: 'Reviewed source',
      firstDay: '2024-01-01',
      lastDay: '2024-01-31',
    },
  });
  assert.equal(
    (await db.emissionFactorVersion.findFirstOrThrow({ where: { supersedesId: factor.id } })).siteId,
    site.id,
  );
  assert.equal(
    (await carbon.summary(actor, org.id, site.id, { ...settings, year: 2024 })).meters[0].status,
    'OUTDATED',
  );
  // Optional real attachment validation/import, isolated from application data.
  if (process.env.EMISSIONS_REFERENCE_PATH) {
    const referenceOrg = await service.createOrganisation(actor, {
      name: 'Reference workbook',
      currency: 'GBP',
      timezone: 'UTC',
    });
    await sites.createSite(actor, referenceOrg.id, { code: 'site_mit', name: 'Reference MIT site' });
    const reference = await readFile(process.env.EMISSIONS_REFERENCE_PATH);
    const p = await service.process(actor, referenceOrg.id, reference, settings);
    assert.equal(p.count, 72);
    await service.process(actor, referenceOrg.id, reference, settings, p.signature);
    assert.equal(await db.emissionFactorVersion.count({ where: { organisationId: referenceOrg.id } }), 72);
    console.log('Reference workbook: 72 factors validated and imported into isolated test database.');
  }
  console.log('Historic emissions integration passed.');
} finally {
  await cleanup();
}
