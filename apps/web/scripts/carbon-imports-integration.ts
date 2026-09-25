import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EmissionFactorService } from '../src/server/emission-factors';
import { CarbonTargetService } from '../src/server/carbon-targets';
import { CarbonImportService } from '../src/server/carbon-imports';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const args = [db, { async send() {} }, 'http://localhost:3100'] as const;
const sites = new SiteService(...args),
  factors = new EmissionFactorService(...args),
  targets = new CarbonTargetService(...args);
const imports = new CarbonImportService(...args, factors, targets);
async function workbook(name: string, headers: string[], rows: unknown[][], extra = 'excluded') {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(name);
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  sheet.getCell('B2').numFmt = '0.00';
  book.addWorksheet('Other').addRow([extra]);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'carbon-import@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'carbon-import-other@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Carbon imports', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'A', name: 'Site A' });
  const meter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const template = {
    version: 1,
    kind: 'emissions',
    sheetName: 'Factors',
    columns: { fuel: 'Fuel', factor: 'Value' },
    defaults: {
      geography: 'GB',
      basis: 'LOCATION_BASED',
      unit: 'kgCO2e/kWh',
      source: 'Synthetic test reference',
      firstDay: '2020-01-01',
      lastDay: '2020-12-31',
    },
  };
  const bytes = await workbook(
    'Factors',
    ['Fuel', 'Value'],
    [
      ['ELECTRICITY', { formula: '1/5', result: 0.2 }],
      ['GAS', 0.123456789],
    ],
  );
  await assert.rejects(imports.upload(actor, org.id, site.id, 'emissions', bytes));
  await assert.rejects(imports.upload(stranger, org.id, site.id, 'emissions', bytes, undefined, template));
  const batch = await imports.upload(actor, org.id, site.id, 'emissions', bytes, undefined, template);
  assert.equal(batch.status, 'READY');
  assert.equal(await db.emissionFactorVersion.count(), 0);
  assert.equal(await db.auditEvent.count({ where: { action: 'carbon.factor_added' } }), 0);
  const receipts = await Promise.all([
    imports.commit(actor, org.id, site.id, batch.id),
    imports.commit(actor, org.id, site.id, batch.id),
  ]);
  assert.equal(receipts[0].id, receipts[1].id);
  assert.equal(await db.emissionFactorVersion.count(), 2);
  assert.equal(
    (await db.emissionFactorVersion.findFirstOrThrow({ where: { fuel: 'GAS' } })).factor.toString(),
    '0.123456789',
  );
  assert.equal((await imports.upload(actor, org.id, site.id, 'emissions', bytes, undefined, template)).id, batch.id);
  const ignoredChanged = await workbook(
    'Factors',
    ['Fuel', 'Value'],
    [
      ['ELECTRICITY', { formula: '1/5', result: 0.2 }],
      ['GAS', 0.123456789],
    ],
    'changed ignored sheet',
  );
  assert.equal(
    (await imports.upload(actor, org.id, site.id, 'emissions', ignoredChanged, undefined, template)).id,
    batch.id,
  );
  const duplicate = await workbook(
    'Factors',
    ['Fuel', 'Value'],
    [
      ['OIL', 0.1],
      ['OIL', 0.2],
    ],
  );
  const invalid = await imports.upload(actor, org.id, site.id, 'emissions', duplicate, undefined, template);
  assert.equal(invalid.status, 'INVALID');
  await assert.rejects(imports.commit(actor, org.id, site.id, invalid.id));
  assert.equal(await db.emissionFactorVersion.count(), 2);
  const first = await db.emissionFactorVersion.findFirstOrThrow({ where: { fuel: 'ELECTRICITY' } });
  const correctionTemplate = {
    ...template,
    columns: { ...template.columns, supersedesId: 'Previous', reason: 'Reason' },
  };
  const correctionBytes = await workbook(
    'Factors',
    ['Fuel', 'Value', 'Previous', 'Reason'],
    [['ELECTRICITY', 0.3, first.id, 'Correct synthetic factor']],
  );
  const corrected = await imports.upload(
    actor,
    org.id,
    site.id,
    'emissions',
    correctionBytes,
    undefined,
    correctionTemplate,
  );
  assert.equal(corrected.status, 'READY');
  await imports.commit(actor, org.id, site.id, corrected.id);
  assert.equal((await db.emissionFactorVersion.findFirstOrThrow({ where: { supersedesId: first.id } })).revision, 2);
  const targetTemplate = {
    version: 1,
    kind: 'targets',
    sheetName: 'Targets',
    columns: { year: 'Year', limitKgCO2e: 'Limit' },
    defaults: {
      meterCode: 'E',
      geography: 'GB',
      basis: 'LOCATION_BASED',
      unit: 'kgCO2e',
      name: 'Imported annual limit',
      source: 'Synthetic target reference',
    },
  };
  const targetBytes = await workbook(
    'Targets',
    ['Year', 'Limit'],
    [
      [2020, 100],
      [2021, 200],
    ],
  );
  const targetBatch = await imports.upload(actor, org.id, site.id, 'targets', targetBytes, undefined, targetTemplate);
  assert.equal(targetBatch.status, 'READY');
  assert.equal(await db.carbonTargetVersion.count(), 0);
  await targets.add(actor, org.id, site.id, {
    meterId: meter.id,
    year: 2021,
    geography: 'GB',
    basis: 'LOCATION_BASED',
    name: 'Conflicting target',
    source: 'Synthetic',
    limitKgCO2e: '300',
    requestKey: randomUUID(),
  });
  await assert.rejects(imports.commit(actor, org.id, site.id, targetBatch.id));
  assert.equal(await db.carbonTargetVersion.count({ where: { year: 2020 } }), 0);
  assert.equal(await db.auditEvent.count({ where: { action: 'carbon.target_added' } }), 1);
  const validTargets = await workbook('Targets', ['Year', 'Limit'], [[2022, { formula: '0*1', result: 0 }]]);
  const ready = await imports.upload(actor, org.id, site.id, 'targets', validTargets, undefined, targetTemplate);
  await imports.commit(actor, org.id, site.id, ready.id);
  assert.equal(
    (await imports.upload(actor, org.id, site.id, 'targets', validTargets, undefined, targetTemplate)).id,
    ready.id,
  );
  const target = await db.carbonTargetVersion.findFirstOrThrow({ where: { year: 2022 } });
  const correctedTargetBytes = await workbook(
    'Targets',
    ['Year', 'Limit', 'Prior', 'Reason'],
    [[2022, 10, target.id, 'Correct target limit']],
  );
  const targetCorrectionMapping = {
    ...targetTemplate,
    columns: { ...targetTemplate.columns, supersedesId: 'Prior', reason: 'Reason' },
  };
  const correctionBatch = await imports.upload(
    actor,
    org.id,
    site.id,
    'targets',
    correctedTargetBytes,
    undefined,
    targetCorrectionMapping,
  );
  assert.equal(correctionBatch.status, 'READY');
  await imports.commit(actor, org.id, site.id, correctionBatch.id);
  assert.equal((await db.carbonTargetVersion.findFirstOrThrow({ where: { supersedesId: target.id } })).revision, 2);
  await assert.rejects(db.carbonWorkbookBatch.update({ where: { id: batch.id }, data: { status: 'READY' } }));
  await db.membership.create({ data: { organisationId: org.id, userId: stranger.userId, role: 'ANALYST' } });
  await assert.rejects(imports.upload(stranger, org.id, site.id, 'emissions', bytes, undefined, template));
  assert.equal(
    (await imports.upload(stranger, org.id, site.id, 'targets', validTargets, undefined, targetTemplate)).status,
    'COMMITTED',
  );
  await db.membership.update({
    where: { organisationId_userId: { organisationId: org.id, userId: stranger.userId } },
    data: { revokedAt: new Date() },
  });
  await assert.rejects(imports.commit(stranger, org.id, site.id, ready.id));
  console.log(
    '✓ carbon workbooks: mapped named sheets, cached formulas/precision, preview rollback, intra-batch conflicts, atomic stale-commit rollback, correction lineage, immutable receipts, duplicate retries and permissions',
  );
} finally {
  await cleanup();
}
