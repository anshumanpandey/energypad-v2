import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { testDatabase } from './test-database';
import { seedMultidriver } from './fixtures/analysis-multidriver';
import { AnalysisService } from '../src/server/analysis/service';
import { EnergyService } from '../src/server/energy';
import { DriverService } from '../src/server/drivers';
import { calculationWorkbook } from '../src/server/analysis/calculation-workbook';

const { db, cleanup } = await testDatabase();
try {
  const f = await seedMultidriver(db);
  const service = new AnalysisService(db, { async send() {} }, 'http://localhost:3101');
  const energy = new EnergyService(db, { async send() {} }, 'http://localhost:3101');
  const drivers = new DriverService(db, { async send() {} }, 'http://localhost:3101');
  const missing = await service.wastePreview(f.owner, f.orgId, f.siteId);
  assert.equal(missing.preview.year, 2020);
  assert.ok(
    missing.preview.meters.every(
      (meter) => meter.rows.some((row) => row.actual !== null) && meter.rows.every((row) => row.expected === null),
    ),
  );
  for (const year of [2021, 2022]) {
    const monthly = [];
    for (let i = 0; i < 12; i++) {
      const month = `${year}-${String(i + 1).padStart(2, '0')}`;
      const hdd = 10 + (i & 1 ? 1 : -1),
        cdd = 20 + (i & 2 ? 1 : -1);
      const expected = 100 + 2 * hdd + 3 * cdd;
      await energy.add(f.owner, f.orgId, f.siteId, {
        meterId: f.twoId,
        month,
        quantity: String(expected - (year === 2022 ? 10 : 0)),
        netCost: ((expected - (year === 2022 ? 10 : 0)) * 0.2).toFixed(3),
        currency: 'GBP',
        estimated: false,
      });
      await drivers.add(f.owner, f.orgId, f.siteId, {
        month,
        driver: 'POPULATION',
        value: String(year === 2021 ? 100 : 200),
        source: 'Preview fixture',
      });
      monthly.push({
        month,
        days: new Date(Date.UTC(year, i + 1, 0)).getUTCDate(),
        heatingDegreeDays: hdd,
        coolingDegreeDays: cdd,
        daylightHours: 30,
      });
    }
    await db.weatherYear.create({
      data: {
        organisationId: f.orgId,
        siteId: f.siteId,
        configurationId: f.configurationId,
        year,
        methodology: 'daily-mean-degree-days-v1',
        provenance: { synthetic: true },
        daily: [],
        monthly,
        inputHash: `preview-fixture-${year}`,
        authorId: f.owner.userId,
      },
    });
  }
  const before = [await db.baselineVersion.count(), await db.analysisRun.count(), await db.auditEvent.count()];
  const multi = await service.wastePreview(f.owner, f.orgId, f.siteId);
  assert.equal(multi.preview.year, 2022);
  assert.deepEqual(multi.preview.drivers, ['HDD', 'CDD']);
  const meter = multi.preview.meters.find((meter) => meter.id === f.twoId)!;
  assert.equal(meter.rows.length, 12);
  assert.equal(meter.issues.length, 0);
  meter.rows.forEach((row) => {
    assert.ok(Math.abs(row.variance! - 10) < 1e-8);
    assert.ok(Math.abs(row.cost! - 2) < 1e-8);
  });
  assert.equal(meter.downloadable, true);
  const source = multi.sources.find((source) => source.meterId === f.twoId)!;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    (await calculationWorkbook(source.source, 'Preview site')) as unknown as Parameters<typeof book.xlsx.load>[0],
  );
  assert.ok(book.getWorksheet('Generated evidence'));
  assert.ok(
    String(book.getWorksheet('Regression Analysis')!.getCell('A1').value).includes('Multiple Routine Adjustment'),
  );
  const classification = await db.siteDriverClassification.create({
    data: {
      organisationId: f.orgId,
      siteId: f.siteId,
      year: 2021,
      heating: 'R',
      cooling: 'N/A',
      population: 'N/A',
      operatingHours: 'N/A',
      daylighting: 'N/A',
      buildingSize: 'N/A',
      source: 'Preview fixture',
      sourceRow: 1,
      authorId: f.owner.userId,
    },
  });
  const single = await service.wastePreview(f.owner, f.orgId, f.siteId);
  assert.deepEqual(single.preview.drivers, ['HDD']);
  assert.equal(single.preview.method, 'Single routine adjustment');
  await db.siteDriverClassificationCorrection.create({
    data: {
      organisationId: f.orgId,
      classificationId: classification.id,
      authorId: f.owner.userId,
      values: {
        heating: 'R',
        cooling: 'R',
        population: 'NR',
        operatingHours: 'N/A',
        daylighting: 'N/A',
        buildingSize: 'N/A',
      },
    },
  });
  const nra = await service.wastePreview(f.owner, f.orgId, f.siteId);
  assert.equal(nra.preview.method, 'Multiple routine adjustment + NRA');
  nra.preview.meters
    .find((meter) => meter.id === f.twoId)!
    .rows.forEach((row) => assert.ok(Math.abs(row.adjusted! - 2 * row.expected!) < 1e-8));
  assert.deepEqual(
    [await db.baselineVersion.count(), await db.analysisRun.count(), await db.auditEvent.count()],
    before,
  );
  await assert.rejects(service.wastePreview(f.owner, f.orgId, crypto.randomUUID()));
  await assert.rejects(service.wastePreview(f.owner, f.orgId, f.siteId, 2022, ['INVALID']));
  console.log(
    '✓ automatic uploaded-data previews, single/multiple/NRA calculations, generated workbook, scoped access and no saved analysis writes',
  );
} finally {
  await cleanup();
}
