import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { TargetImportService } from '../src/server/target-import';
import { SiteService } from '../src/server/sites';
import { actorFor } from '../src/server/foundation';
import { targetColumns } from '../src/domain/target-import';
import { WorkbookCellError } from '../src/domain/workbook-errors';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const args = [db, { async send() {} }, 'http://localhost:3100'] as const;
const service = new TargetImportService(...args),
  sites = new SiteService(...args);
const row = (energy: number | ExcelJS.CellValue = 150): ExcelJS.CellValue[] => [
  'site_mit',
  2023,
  'Jan',
  'Grid Electricity',
  'kWh',
  energy,
  200,
];
async function workbook(rows: ExcelJS.CellValue[][]) {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet('Targets');
  sheet.addRow(targetColumns);
  rows.forEach((r) => sheet.addRow(r));
  sheet.getCell('F2').numFmt = '#,##0.00';
  book.addWorksheet('Ignored').getCell('A1').value = { error: '#VALUE!' };
  return new Uint8Array(await book.xlsx.writeBuffer());
}
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'target-import@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'target-stranger@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Target imports', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'site_mit', name: 'Target site' });
  const bytes = await workbook([row({ formula: '100+50', result: 150 })]);
  await assert.rejects(service.process(stranger, org.id, bytes));
  const preview = await service.process(actor, org.id, bytes);
  assert.equal(preview.created, 1);
  assert.equal(await db.monthlyPlanVersion.count(), 0);
  await assert.rejects(service.process(actor, org.id, bytes, 'bad'), /changed/);
  await Promise.all([
    service.process(actor, org.id, bytes, preview.signature),
    service.process(actor, org.id, bytes, preview.signature),
  ]);
  assert.equal(await db.monthlyPlanVersion.count(), 1);
  assert.equal((await service.process(actor, org.id, bytes)).unchanged, 1);
  const changed = await workbook([row(175)]),
    update = await service.process(actor, org.id, changed);
  assert.equal(update.updated, 1);
  const newer = await workbook([row(190)]),
    newPreview = await service.process(actor, org.id, newer);
  await service.process(actor, org.id, newer, newPreview.signature);
  await assert.rejects(service.process(actor, org.id, changed, update.signature), /changed/);
  const fresh = await service.process(actor, org.id, changed);
  await service.process(actor, org.id, changed, fresh.signature);
  const current = await db.monthlyPlanVersion.findFirstOrThrow({
    where: { siteId: site.id, replacement: { is: null } },
  });
  assert.equal(current.revision, 3);
  assert.equal((current.payload as { energy: string }).energy, '175');
  const bad = row();
  bad[0] = 'missing';
  bad[5] = { error: '#VALUE!' };
  bad[6] = -1;
  await assert.rejects(service.process(actor, org.id, await workbook([row(), bad])), (error) => {
    assert.ok(error instanceof WorkbookCellError);
    return true;
  });
  assert.equal(await db.monthlyPlanVersion.count(), 3);
  await assert.rejects(service.process(actor, org.id, await workbook([row(), row()])), WorkbookCellError);
  if (process.env.TARGETS_REFERENCE_PATH) {
    const original = new Uint8Array(await readFile(process.env.TARGETS_REFERENCE_PATH));
    await assert.rejects(service.process(actor, org.id, original), (error) => {
      assert.ok(error instanceof WorkbookCellError);
      assert.deepEqual(
        error.cellErrors.map((e) => e.cell),
        ['A26', 'A50'],
      );
      return true;
    });
    // Correct only the disposable test copy; the supplied workbook remains untouched.
    const corrected = new ExcelJS.Workbook();
    await corrected.xlsx.readFile(process.env.TARGETS_REFERENCE_PATH);
    corrected.getWorksheet('Targets')!.getCell('D50').value = 'Diesel';
    const reference = new Uint8Array(await corrected.xlsx.writeBuffer());
    const p = await service.process(actor, org.id, reference);
    assert.equal(p.count, 72);
    await service.process(actor, org.id, reference, p.signature);
    assert.equal(await db.monthlyPlanVersion.count({ where: { siteId: site.id, replacement: { is: null } } }), 72);
    assert.equal((await service.process(actor, org.id, reference)).unchanged, 72);
  }
  console.log(
    'Target import integration passed: atomic validation, formulas, isolation, concurrency, corrections, stale preview and reference workbook.',
  );
} finally {
  await cleanup();
}
