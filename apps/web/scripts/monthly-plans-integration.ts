import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { testDatabase } from './test-database';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { MonthlyPlanService } from '../src/server/monthly-plans';
import { CarbonImportService } from '../src/server/carbon-imports';
import { CarbonService } from '../src/server/carbon';
import { CarbonTargetService } from '../src/server/carbon-targets';
import { EmissionFactorService } from '../src/server/emission-factors';
import type { MonthlyPlanPayload } from '../src/domain/monthly-plans';
const { db, cleanup } = await testDatabase();
const args = [db, { async send() {} }, 'http://localhost:3100'] as const;
const sites = new SiteService(...args),
  plans = new MonthlyPlanService(...args),
  carbon = new CarbonService(...args);
const imports = new CarbonImportService(...args, new EmissionFactorService(...args), new CarbonTargetService(...args));
async function book(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Plans');
  sheet.addRow([
    'month',
    'fuel',
    'unit',
    'energy',
    'carbon',
    'conversionFactor',
    'source',
    'energyUseCodes',
    'supersedesId',
    'reason',
  ]);
  for (const row of rows) sheet.addRow(row);
  workbook.addWorksheet('Ignored').addRow(['Untouched']);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'plans@example.test', emailVerified: new Date() } })).id,
  );
  const other = actorFor(
    (await db.user.create({ data: { email: 'other-plans@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Plans', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'P', name: 'Plans' });
  const data = {
    kind: 'TARGET',
    month: '2020-ALL',
    fuel: 'ELECTRICITY',
    unit: 'MWh',
    energy: '0.1',
    carbon: '10',
    conversionFactor: '1000',
    source: 'Synthetic target',
    requestKey: randomUUID(),
  };
  const originals = await plans.add(actor, org.id, site.id, data);
  assert.equal(originals.length, 12);
  assert.equal((originals[0].payload as unknown as MonthlyPlanPayload).normalizedKwh, '100');
  assert.deepEqual(
    (await plans.add(actor, org.id, site.id, data)).map((r) => r.id),
    originals.map((r) => r.id),
  );
  await assert.rejects(plans.add(actor, org.id, site.id, { ...data, energy: '2' }));
  await assert.rejects(plans.add(actor, org.id, site.id, { ...data, requestKey: randomUUID() }));
  assert.equal(
    (await carbon.benchmark(actor, org.id, { year: 2020, geography: 'GB', basis: 'LOCATION_BASED' })).rows[0]
      .energyTarget,
    '1200',
  );
  const correction = { ...data, month: '2020-01', energy: '0.2', requestKey: randomUUID() };
  const corrected = await plans.add(actor, org.id, site.id, correction, originals[0].id, 'Revised plan');
  assert.equal(corrected[0].revision, 2);
  assert.equal((await plans.list(actor, org.id, site.id, 2020)).length, 13);
  assert.equal(
    (await plans.add(actor, org.id, site.id, correction, originals[0].id, 'Revised plan'))[0].id,
    corrected[0].id,
  );
  await assert.rejects(
    plans.add(actor, org.id, site.id, { ...correction, requestKey: randomUUID() }, originals[0].id, 'Stale correction'),
  );
  const use = await db.siteEnergyUse.create({
    data: {
      organisationId: org.id,
      siteId: site.id,
      code: 'HEAT',
      name: 'Heating',
      fuel: 'ELECTRICITY',
      source: 'Test',
      authorId: actor.userId,
    },
  });
  const monitoring = {
    ...data,
    kind: 'MONITORING',
    unit: 'kWh',
    conversionFactor: '1',
    energyUseCodes: 'HEAT',
    requestKey: randomUUID(),
  };
  const monitored = await plans.add(actor, org.id, site.id, monitoring);
  assert.equal((monitored[0].payload as unknown as MonthlyPlanPayload).energyUses[0].id, use.id);
  await assert.rejects(
    plans.add(actor, org.id, site.id, {
      ...monitoring,
      month: '2021-01',
      energyUseCodes: 'UNKNOWN',
      requestKey: randomUUID(),
    }),
  );
  await assert.rejects(plans.list(other, org.id, site.id, 2020));
  const membership = await db.membership.create({
    data: { organisationId: org.id, userId: other.userId, role: 'SITE_MANAGER' },
  });
  await assert.rejects(plans.list(other, org.id, site.id, 2020));
  await db.siteAssignment.create({ data: { membershipId: membership.id, organisationId: org.id, siteId: site.id } });
  assert.equal((await plans.list(other, org.id, site.id, 2020)).length, 25);
  await assert.rejects(plans.add(other, org.id, site.id, { ...data, month: '2022-01', requestKey: randomUUID() }));
  for (const action of [
    () => db.monthlyPlanVersion.update({ where: { id: originals[0].id }, data: { month: '2020-02' } }),
    () => db.monthlyPlanVersion.delete({ where: { id: originals[0].id } }),
    () => db.$executeRawUnsafe('TRUNCATE TABLE "MonthlyPlanVersion"'),
  ])
    await assert.rejects(action());
  const bytes = await book([['2021-ALL', 'ELECTRICITY', 'kWh', '5', '1', '1', 'Imported plan', 'HEAT', '', '']]);
  await assert.rejects(imports.upload(actor, org.id, site.id, 'monitoring', bytes));
  const preview = await imports.upload(actor, org.id, site.id, 'monitoring', bytes, 'Plans');
  assert.equal(preview.status, 'READY');
  assert.equal((preview.result as { records: unknown[] }).records.length, 12);
  assert.equal((await plans.list(actor, org.id, site.id, 2021)).length, 0);
  const committed = await imports.commit(actor, org.id, site.id, preview.id);
  assert.equal((committed.receipt as unknown[]).length, 12);
  assert.equal((await plans.list(actor, org.id, site.id, 2021)).length, 12);
  assert.equal((await imports.commit(actor, org.id, site.id, preview.id)).id, committed.id);
  assert.equal((await imports.upload(actor, org.id, site.id, 'monitoring', bytes, 'Plans')).id, committed.id);
  const importedJanuary = (await plans.list(actor, org.id, site.id, 2021)).find((r) => r.month === '2021-01')!;
  const fixPreview = await imports.upload(
    actor,
    org.id,
    site.id,
    'monitoring',
    await book([
      [
        '2021-01',
        'ELECTRICITY',
        'kWh',
        '6',
        '1',
        '1',
        'Corrected workbook plan',
        'HEAT',
        importedJanuary.id,
        'Revised quantity',
      ],
    ]),
    'Plans',
  );
  assert.equal(fixPreview.status, 'READY');
  await imports.commit(actor, org.id, site.id, fixPreview.id);
  assert.equal((await plans.list(actor, org.id, site.id, 2021)).length, 13);
  assert.equal(
    (await plans.list(actor, org.id, site.id, 2021)).find((r) => r.id === importedJanuary.id)!.replacement !== null,
    true,
  );
  const mappedBook = new ExcelJS.Workbook();
  mappedBook.addWorksheet('Custom').addRows([
    ['Period', 'Quantity'],
    ['2024-ALL', '7'],
  ]);
  const mapped = await imports.upload(
    actor,
    org.id,
    site.id,
    'monthlyTargets',
    new Uint8Array(await mappedBook.xlsx.writeBuffer()),
    undefined,
    {
      version: 1,
      kind: 'monthlyTargets',
      sheetName: 'Custom',
      columns: { month: 'Period', energy: 'Quantity' },
      defaults: { fuel: 'ELECTRICITY', unit: 'kWh', conversionFactor: '1', source: 'Mapped defaults' },
    },
  );
  assert.equal(mapped.status, 'READY');
  await imports.commit(actor, org.id, site.id, mapped.id);
  assert.equal((await plans.list(actor, org.id, site.id, 2024)).length, 12);
  const conflicts = await imports.upload(
    actor,
    org.id,
    site.id,
    'monitoring',
    await book([['2022-ALL', 'ELECTRICITY', 'kWh', '5', '1', '1', 'Imported plan', 'HEAT', '', '']]),
    'Plans',
  );
  await plans.add(actor, org.id, site.id, { ...monitoring, month: '2022-06', requestKey: randomUUID() });
  await assert.rejects(imports.commit(actor, org.id, site.id, conflicts.id));
  assert.equal((await plans.list(actor, org.id, site.id, 2022)).length, 1);
  const invalid = await imports.upload(
    actor,
    org.id,
    site.id,
    'monitoring',
    await book([['2023-ALL', 'ELECTRICITY', 'kWh', '5', '1', '1', 'Imported plan', 'BAD', '', '']]),
    'Plans',
  );
  assert.equal(invalid.status, 'INVALID');
  assert.equal((await plans.list(actor, org.id, site.id, 2023)).length, 0);
  console.log(
    '✓ monthly plans: separate mechanisms, normalization, all-month expansion, retries, corrections, end-use scope, immutable history, scoped reads/writes and atomic workbook commits',
  );
} finally {
  await cleanup();
}
