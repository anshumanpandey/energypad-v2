import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { testDatabase } from './test-database';
import { DriverClassificationService } from '../src/server/driver-classifications';
import { SiteService } from '../src/server/sites';
import { actorFor } from '../src/server/foundation';
import { classificationColumns } from '../src/domain/driver-classifications';
import { WorkbookCellError } from '../src/domain/workbook-errors';
const { db, cleanup } = await testDatabase();
const args = [db, { async send() {} }, 'http://localhost:3100'] as const;
const service = new DriverClassificationService(...args),
  sites = new SiteService(...args);
async function workbook(rows: ExcelJS.CellValue[][]) {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet('Drivers');
  sheet.getCell('A2').value = 'R';
  sheet.getCell('B2').value = 'Routine';
  sheet.getRow(6).values = classificationColumns;
  rows.forEach((r, i) => {
    sheet.getRow(i + 7).values = r;
  });
  sheet.getCell('J1000').numFmt = '0.00';
  book.addWorksheet('Ignored').getCell('A1').value = { error: '#VALUE!' };
  return new Uint8Array(await book.xlsx.writeBuffer());
}
const row = (site: string) => [site, 2024, { formula: '"R"', result: 'R' }, 'NR', 'NR', 'N/A', 'N/A', 'N/A'];
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'drivers@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'other@example.test', emailVerified: new Date() } })).id,
  );
  const org = await service.createOrganisation(actor, { name: 'Driver imports', currency: 'GBP', timezone: 'UTC' });
  for (const name of ['Leicester', 'Leeds', 'London', 'Bristol', 'Glasgow'])
    await sites.createSite(actor, org.id, { code: name.toUpperCase(), name });
  const bytes = await workbook([row('London'), row('Leeds')]);
  await assert.rejects(service.process(stranger, org.id, bytes));
  await assert.rejects(service.list(stranger, org.id));
  const preview = await service.process(actor, org.id, bytes);
  assert.equal(preview.count, 2);
  assert.equal(await db.siteDriverClassification.count(), 0);
  await assert.rejects(service.process(actor, org.id, bytes, 'changed'), /changed/);
  const bad = await workbook([row('London'), ['missing', 'bad', { error: '#VALUE!' }, 'X', 'NR', 'N/A', 'N/A', 'N/A']]);
  await assert.rejects(service.process(actor, org.id, bad), (e) => {
    assert.ok(e instanceof WorkbookCellError);
    assert.deepEqual(
      e.cellErrors.map((i) => i.cell),
      ['A8', 'B8', 'C8', 'D8'],
    );
    return true;
  });
  assert.equal(await db.siteDriverClassification.count(), 0);
  await Promise.all([
    service.process(actor, org.id, bytes, preview.signature),
    service.process(actor, org.id, bytes, preview.signature),
  ]);
  assert.equal(await db.siteDriverClassification.count(), 2);
  assert.equal((await service.list(actor, org.id))[0].year, 2024);
  assert.equal((await service.process(actor, org.id, bytes)).existingCount, 2);
  const altered = row('London');
  altered[3] = 'R';
  altered[4] = 'N/A';
  await assert.rejects(
    service.process(actor, org.id, await workbook([row('Bristol'), altered])),
    (e) => e instanceof WorkbookCellError && e.cellErrors.map((i) => i.cell).join(',') === 'D8,E8',
  );
  assert.equal(await db.siteDriverClassification.count(), 2);
  const london = await db.site.findFirstOrThrow({ where: { organisationId: org.id, name: 'London' } });
  await db.site.update({ where: { id: london.id }, data: { code: 'LON' } });
  await assert.rejects(service.process(actor, org.id, await workbook([row('London'), row('LON')])), /Duplicate/);
  await assert.rejects(db.siteDriverClassification.updateMany({ data: { heating: 'NR' } }));
  if (process.env.DRIVERS_REFERENCE_PATH) {
    const referenceOrg = await service.createOrganisation(actor, {
      name: 'Reference drivers',
      currency: 'GBP',
      timezone: 'UTC',
    });
    for (const name of ['Leicester', 'Leeds', 'London', 'Bristol', 'Glasgow'])
      await sites.createSite(actor, referenceOrg.id, { code: name, name });
    const reference = await readFile(process.env.DRIVERS_REFERENCE_PATH);
    const p = await service.process(actor, referenceOrg.id, reference);
    assert.equal(p.count, 5);
    await service.process(actor, referenceOrg.id, reference, p.signature);
    assert.equal(await db.siteDriverClassification.count({ where: { organisationId: referenceOrg.id } }), 5);
    console.log('Reference Drivers sheet: 5 site/year rows, 30 classifications imported into isolated database.');
  }
  console.log('Driver classification integration passed.');
} finally {
  await cleanup();
}
