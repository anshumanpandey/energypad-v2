import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { testDatabase } from './test-database';
import { SiteService } from '../src/server/sites';
import { actorFor } from '../src/server/foundation';
import { DomainError } from '../src/domain/policy';
import { readWorkbook } from '../src/server/workbook';
const { db, cleanup } = await testDatabase();
const service = new SiteService(db, { async send() {} }, 'http://localhost:3100');
let count = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  count++;
  console.log(`✓ ${name}`);
}
async function denied(work: Promise<unknown>) {
  await assert.rejects(work, (e: unknown) => e instanceof DomainError);
}
const owner = actorFor(
  (await db.user.create({ data: { email: 'sites-owner@example.test', emailVerified: new Date() } })).id,
);
const stranger = actorFor(
  (await db.user.create({ data: { email: 'sites-other@example.test', emailVerified: new Date() } })).id,
);
const viewer = actorFor(
  (await db.user.create({ data: { email: 'sites-viewer@example.test', emailVerified: new Date() } })).id,
);
try {
  const org = await service.createOrganisation(owner, { name: 'Site tests', currency: 'GBP', timezone: 'UTC' });
  const other = await service.createOrganisation(stranger, { name: 'Other tests', currency: 'GBP', timezone: 'UTC' });
  await db.membership.create({ data: { organisationId: org.id, userId: viewer.userId, role: 'SITE_MANAGER' } });
  const portfolio = await service.savePortfolio(owner, org.id, { name: 'North' });
  const foreignPortfolio = await service.savePortfolio(stranger, other.id, { name: 'Other' });
  const site = await service.createSite(owner, org.id, {
    code: 'SITE-1',
    name: 'First site',
    portfolioId: portfolio.id,
    attributes: { effectiveFrom: '2026-01-01', population: '0', floorArea: '1500.125' },
  });
  await check('site/portfolio CRUD and append-only history', async () => {
    await service.updateSite(owner, org.id, site.id, {
      code: 'SITE-1',
      name: 'Updated site',
      portfolioId: portfolio.id,
    });
    await service.addAttributes(owner, org.id, site.id, {
      effectiveFrom: '2026-02-01',
      population: '10',
      weeklyHours: '40',
    });
    const detail = await service.siteDetail(owner, org.id, site.id);
    assert.equal(detail.attributes.length, 2);
    assert.equal(detail.attributes[1].population?.toString(), '0');
    await assert.rejects(
      db.siteAttributeHistory.update({ where: { id: detail.attributes[0].id }, data: { population: 100 } }),
    );
    await denied(service.archivePortfolio(owner, org.id, portfolio.id));
    await service.savePortfolio(owner, org.id, { name: 'North region' }, portfolio.id);
  });
  await check('foreign IDs, viewer writes and cross-tenant portfolio relations fail', async () => {
    await denied(service.siteDetail(stranger, org.id, site.id));
    await denied(service.siteDetail(viewer, org.id, site.id));
    await denied(service.createSite(viewer, org.id, { code: 'DENIED', name: 'Denied' }));
    await denied(
      service.createSite(owner, org.id, { code: 'BAD', name: 'Bad relation', portfolioId: foreignPortfolio.id }),
    );
    await assert.rejects(
      db.site.create({
        data: { code: 'FK', name: 'Forbidden', organisationId: org.id, portfolioId: foreignPortfolio.id },
      }),
    );
    const member = await db.membership.findFirstOrThrow({ where: { userId: viewer.userId, organisationId: org.id } });
    await service.assignSites(owner, org.id, member.id, { siteIds: [site.id] });
    assert.equal((await service.siteDetail(viewer, org.id, site.id)).id, site.id);
  });
  await check('meter CRUD is site and tenant scoped', async () => {
    const meter = await service.saveMeter(owner, org.id, site.id, {
      code: 'MAIN',
      name: 'Main meter',
      fuel: 'ELECTRICITY',
      unit: 'kWh',
    });
    await service.saveMeter(
      owner,
      org.id,
      site.id,
      { code: 'MAIN', name: 'Updated meter', fuel: 'ELECTRICITY', unit: 'MWh' },
      meter.id,
    );
    await denied(service.archiveMeter(stranger, other.id, site.id, meter.id));
    await service.archiveMeter(owner, org.id, site.id, meter.id);
    assert.equal((await service.siteDetail(owner, org.id, site.id)).meters.length, 0);
  });
  const bytes = await readFile('../../test/fixtures/business_example_v3.xlsx');
  const original = new ExcelJS.Workbook();
  await original.xlsx.load(Uint8Array.from(bytes).buffer);
  const secrets = original
    .getWorksheet('Hoja1')!
    .getColumn(15)
    .values.slice(2)
    .filter((v) => typeof v === 'string' && v);
  const batch = await service.upload(owner, org.id, bytes);
  await check('business fixture is detected and credential values never reach staging', async () => {
    const sheets = await readWorkbook(bytes);
    assert.equal(sheets.length, 2);
    assert.ok(!sheets[0].headers.includes('password'));
    const stored = JSON.stringify(batch);
    for (const value of secrets) assert.ok(!stored.includes(String(value)));
    assert.equal((await service.upload(owner, org.id, bytes)).id, batch.id);
    await denied(service.importDetail(stranger, other.id, batch.id));
    await denied(service.upload(viewer, org.id, bytes));
  });
  const sheets = await readWorkbook(bytes),
    source = sheets[1],
    email = source.rows[0].cells[source.headers.indexOf('businessEmail')];
  const mapping = {
    sheet: 1,
    columns: { name: 0, type: 1, address: 2, postCode: 3, town: 4, population: 5, floorArea: 6, weeklyHours: 8 },
    defaults: {},
    codePrefix: 'LEGACY',
    effectiveFrom: '2026-01-01',
    businessEmail: email,
    confirmCurrentOrganisation: true,
  };
  await check('missing codes/dates produce row errors and prevent commit', async () => {
    const invalid = await service.mapImport(owner, org.id, batch.id, { ...mapping, codePrefix: '', effectiveFrom: '' });
    assert.equal(invalid.status, 'INVALID');
    await denied(service.commitImport(owner, org.id, batch.id));
  });
  await check('mapped fixture commits atomically once under concurrent retries', async () => {
    const ready = await service.mapImport(owner, org.id, batch.id, mapping);
    assert.equal(ready.status, 'READY');
    const results = await Promise.all([
      service.commitImport(owner, org.id, batch.id),
      service.commitImport(owner, org.id, batch.id),
    ]);
    assert.equal(results[0].id, results[1].id);
    assert.equal(await db.site.count({ where: { organisationId: org.id, code: 'LEGACY-2' } }), 1);
    assert.equal(
      await db.auditEvent.count({ where: { organisationId: org.id, action: 'import.committed', targetId: batch.id } }),
      1,
    );
    for (const secret of secrets)
      assert.ok(!JSON.stringify(await service.listAudit(owner, org.id)).includes(String(secret)));
  });
  await check('plan limits and archival preserve records and revoke assignments', async () => {
    for (let i = 0; i < 3; i++) await service.createSite(owner, org.id, { code: `LIMIT-${i}`, name: 'Limit site' });
    await denied(service.createSite(owner, org.id, { code: 'OVER', name: 'Over limit' }));
    await service.archiveSite(owner, org.id, site.id);
    await denied(service.siteDetail(viewer, org.id, site.id));
    assert.equal(await db.siteAttributeHistory.count({ where: { siteId: site.id } }), 2);
    await service.createSite(owner, org.id, { code: 'REPLACEMENT', name: 'Replacement' });
    await service.archivePortfolio(owner, org.id, portfolio.id);
  });
  await check('formulas and malformed workbooks are rejected', async () => {
    await denied(service.upload(owner, org.id, new Uint8Array([1, 2, 3])));
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet('Sites');
    sheet.addRow(['name']);
    sheet.addRow([{ formula: '1+1', result: 2 }]);
    await denied(service.upload(owner, org.id, new Uint8Array(await book.xlsx.writeBuffer())));
    await denied(service.importDetail(owner, org.id, randomUUID()));
  });
  await check('stale previews and plan limits abort the entire import', async () => {
    const target = await service.createOrganisation(owner, {
      name: 'Atomic import tests',
      currency: 'GBP',
      timezone: 'UTC',
    });
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet('Sites');
    sheet.addRow(['code', 'name']);
    sheet.addRow(['CONFLICT', 'Conflict site']);
    sheet.addRow(['SAFE', 'Safe site']);
    const upload = await service.upload(owner, target.id, new Uint8Array(await book.xlsx.writeBuffer()));
    const mapping = { sheet: 0, columns: { code: 0, name: 1 }, defaults: {}, confirmCurrentOrganisation: true };
    await service.mapImport(owner, target.id, upload.id, mapping);
    await service.createSite(owner, target.id, { code: 'CONFLICT', name: 'Concurrent site' });
    await denied(service.commitImport(owner, target.id, upload.id));
    assert.equal(await db.site.count({ where: { organisationId: target.id, code: 'SAFE' } }), 0);
    assert.equal((await service.importDetail(owner, target.id, upload.id)).status, 'READY');
    const book2 = new ExcelJS.Workbook(),
      sheet2 = book2.addWorksheet('Sites');
    sheet2.addRow(['code', 'name']);
    for (let i = 0; i < 5; i++) sheet2.addRow([`BULK-${i}`, 'Bulk site']);
    const upload2 = await service.upload(owner, target.id, new Uint8Array(await book2.xlsx.writeBuffer()));
    await service.mapImport(owner, target.id, upload2.id, mapping);
    await denied(service.commitImport(owner, target.id, upload2.id));
    assert.equal(await db.site.count({ where: { organisationId: target.id } }), 1);
    await denied(service.mapImport(stranger, other.id, upload2.id, mapping));
    await denied(service.commitImport(stranger, other.id, upload2.id));
  });
  console.log(`${count} Sprint 2 integration scenarios passed.`);
} finally {
  await cleanup();
}
