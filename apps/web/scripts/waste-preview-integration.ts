import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { testDatabase } from './test-database';
import { seedMultidriver } from './fixtures/analysis-multidriver';
import { AnalysisService } from '../src/server/analysis/service';
import { EnergyService } from '../src/server/energy';
import { DriverService } from '../src/server/drivers';
import { calculationWorkbook } from '../src/server/analysis/calculation-workbook';
import { SiteService } from '../src/server/sites';
import { WeatherJobs } from '../src/server/weather/jobs';
import { weatherPeriod, type WeatherMonth } from '../src/domain/weather';

const { db, cleanup } = await testDatabase();
try {
  const f = await seedMultidriver(db);
  const service = new AnalysisService(db, { async send() {} }, 'http://localhost:3101');
  const energy = new EnergyService(db, { async send() {} }, 'http://localhost:3101');
  const drivers = new DriverService(db, { async send() {} }, 'http://localhost:3101');
  const missing = await service.wastePreview(f.owner, f.orgId, f.siteId);
  assert.equal(missing.preview.year, 2020);
  assert.ok(
    missing.preview.meters.every((meter) =>
      meter.issues.some((issue) => issue.startsWith('Baseline 2019 has no uploaded consumption')),
    ),
  );
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
  const futureYear = new Date().getUTCFullYear() + 2;
  await energy.add(f.owner, f.orgId, f.siteId, {
    meterId: f.twoId,
    month: `${futureYear}-01`,
    quantity: '100',
    estimated: false,
  });
  const unavailableYear = await service.wastePreview(f.owner, f.orgId, f.siteId, futureYear, ['HDD']);
  const blockedMeter = unavailableYear.preview.meters.find((meter) => meter.id === f.twoId)!;
  assert.ok(
    blockedMeter.issues.some((issue) => issue.startsWith(`Baseline ${futureYear - 1} has no uploaded consumption`)),
  );
  assert.ok(
    blockedMeter.issues.some((issue) => issue.startsWith(`Reporting ${futureYear} weather is not available to fetch`)),
  );
  assert.ok(blockedMeter.rows.every((row) => row.variance === null));
  const sites = new SiteService(db, { async send() {} }, 'http://localhost:3101');
  const apiSite = await sites.createSite(f.owner, f.orgId, {
    code: 'AUTO-WEATHER',
    name: 'Leeds',
    town: 'Leeds',
    country: 'GB',
  });
  const apiMeter = await sites.saveMeter(f.owner, f.orgId, apiSite.id, {
    code: 'HEAT',
    name: 'Heating',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  let geocodes = 0;
  const automatic = new WeatherJobs(
    db,
    { async send() {} },
    'http://localhost:3101',
    {
      async fetchYear(request) {
        return {
          days: request.dates.map((date) => ({
            date,
            meanTemperature: Number(date.slice(5, 7)) * 2 - 5 - (Number(date.slice(0, 4)) === reportingYear ? 1 : 0),
            daylightSeconds: 43200,
          })),
          provenance: {
            provider: 'Synthetic test',
            dataset: 'Test temperatures',
            endpoint: 'https://example.test/weather',
            returnedLatitude: 53.8,
            returnedLongitude: -1.5,
            elevation: 20,
            timezone: 'Europe/London',
            utcOffsetSeconds: 0,
            retrievedAt: new Date().toISOString(),
            attribution: 'Synthetic fixture',
            licence: 'Test',
          },
        };
      },
    },
    async (location, country) => {
      geocodes++;
      assert.equal(location, 'Leeds');
      assert.equal(country, 'GB');
      return {
        latitude: '53.800000',
        longitude: '-1.500000',
        timezone: 'Europe/London',
        label: 'Leeds, United Kingdom',
      };
    },
  );
  const apiYear = new Date().getUTCFullYear();
  // January has no completed current-year months; test the latest year with published monthly data.
  let reportingYear = apiYear;
  try {
    weatherPeriod(reportingYear);
  } catch {
    reportingYear--;
  }
  await assert.rejects(automatic.prepareCalculation(f.owner, crypto.randomUUID(), apiSite.id, { year: reportingYear }));
  assert.equal(geocodes, 0);
  const prepared = await automatic.prepareCalculation(f.owner, f.orgId, apiSite.id, { year: reportingYear });
  const repeated = await automatic.prepareCalculation(f.owner, f.orgId, apiSite.id, { year: reportingYear });
  assert.equal(geocodes, 1);
  assert.equal(prepared.configurationId, repeated.configurationId);
  assert.deepEqual(
    prepared.jobs.map((job) => job.id),
    repeated.jobs.map((job) => job.id),
  );
  while (await automatic.processOne()) {}
  const fetched = await db.weatherYear.findMany({ where: { siteId: apiSite.id } });
  assert.equal(fetched.length, 2);
  assert.equal(
    fetched.find((row) => row.year === reportingYear)!.methodology,
    weatherPeriod(reportingYear).methodology,
  );
  for (const result of fetched) {
    for (const month of result.monthly as unknown as WeatherMonth[]) {
      const expected = 100 + 2 * month.heatingDegreeDays + 3 * month.coolingDegreeDays;
      const actual = expected - (result.year === reportingYear ? 10 : 0);
      await energy.add(f.owner, f.orgId, apiSite.id, {
        meterId: apiMeter.id,
        month: month.month,
        quantity: String(actual),
        netCost: (actual * 0.2).toFixed(3),
        currency: 'GBP',
        estimated: false,
      });
    }
  }
  const calculated = await service.wastePreview(f.owner, f.orgId, apiSite.id, reportingYear);
  assert.equal(calculated.preview.weather!.ready, true);
  const rows = calculated.preview.meters[0].rows.filter((row) => row.variance !== null);
  assert.equal(
    rows.length,
    (fetched.find((row) => row.year === reportingYear)!.monthly as unknown as WeatherMonth[]).length,
  );
  rows.forEach((row) => {
    assert.ok(Math.abs(row.variance! - 10) < 1e-7);
    assert.ok(Math.abs(row.cost! - 2) < 1e-7);
  });
  await automatic.prepareCalculation(f.owner, f.orgId, apiSite.id, { year: reportingYear });
  assert.equal(await db.weatherYear.count({ where: { siteId: apiSite.id } }), 2);
  const solar = await sites.saveMeter(f.owner, f.orgId, apiSite.id, {
    code: 'SOLAR-HEATING',
    name: 'Solar PV heating baseline',
    fuel: 'SOLAR_PV',
    unit: 'kWh',
  });
  const biodiesel = await sites.saveMeter(f.owner, f.orgId, apiSite.id, {
    code: 'BIO-HEATING',
    name: 'Biodiesel heating reporting',
    fuel: 'BIODIESEL',
    unit: 'kWh',
  });
  for (const result of fetched) {
    for (const month of result.monthly as unknown as WeatherMonth[]) {
      const expected = 100 + 2 * month.heatingDegreeDays + 3 * month.coolingDegreeDays;
      const actual = expected - (result.year === reportingYear ? 7 : 0);
      await energy.add(f.owner, f.orgId, apiSite.id, {
        meterId: result.year === reportingYear ? biodiesel.id : solar.id,
        month: month.month,
        quantity: String(actual),
        endUse: 'Heating',
        netCost: (actual * 0.2).toFixed(3),
        currency: 'GBP',
        estimated: false,
      });
    }
  }
  const fuelChange = await service.wastePreview(f.owner, f.orgId, apiSite.id, reportingYear);
  const thermal = fuelChange.preview.meters.find((meter) => meter.id === biodiesel.id)!;
  assert.equal(thermal.baselineSource!.id, solar.id);
  assert.equal(thermal.baselineSource!.endUse, 'heating');
  thermal.rows.filter((row) => row.variance !== null).forEach((row) => assert.ok(Math.abs(row.variance! - 7) < 1e-7));
  assert.equal(thermal.downloadable, true);
  const evidence = fuelChange.sources.find((source) => source.meterId === biodiesel.id)!.source;
  assert.equal(evidence.baseline.snapshot.definition.meterId, solar.id);
  assert.equal(evidence.baseline.snapshot.assembly.scope.meterId, solar.id);
  assert.ok(
    JSON.stringify(evidence.baseline.snapshot.assembly.evidence).includes(
      'same uploaded thermal end use in normalized kWh',
    ),
  );
  const generated = new ExcelJS.Workbook();
  await generated.xlsx.load(
    (await calculationWorkbook(evidence, 'Leeds')) as unknown as Parameters<typeof generated.xlsx.load>[0],
  );
  assert.ok(generated.getWorksheet('Generated evidence'));
  await db.siteDriverClassification.create({
    data: {
      organisationId: f.orgId,
      siteId: apiSite.id,
      year: reportingYear - 1,
      heating: 'R',
      cooling: 'R',
      population: 'NR',
      operatingHours: 'N/A',
      daylighting: 'N/A',
      buildingSize: 'N/A',
      source: 'Uploaded classification',
      sourceRow: 2,
      authorId: f.owner.userId,
    },
  });
  for (const record of await db.consumptionRecord.findMany({
    where: { siteId: apiSite.id, meterId: { in: [solar.id, biodiesel.id] } },
  })) {
    await db.consumptionRecord.create({
      data: {
        ...record,
        id: crypto.randomUUID(),
        supersedesId: record.id,
        revision: record.revision + 1,
        correctionReason: 'Fixture historic upload provenance',
        importProvenance: { format: 'historic-consumption-v1', population: '100' },
        sourceProvenance: record.sourceProvenance ?? Prisma.DbNull,
        energyUseSnapshot: record.energyUseSnapshot ?? Prisma.DbNull,
      } as Prisma.ConsumptionRecordUncheckedCreateInput,
    });
  }
  const uploadedNra = await service.wastePreview(f.owner, f.orgId, apiSite.id, reportingYear, ['HDD', 'CDD']);
  const adjusted = uploadedNra.preview.meters.find((meter) => meter.id === biodiesel.id)!;
  assert.ok(adjusted.rows.some((row) => row.variance !== null));
  const uploadedMonths = adjusted.rows.filter((row) => row.actual !== null).map((row) => row.month);
  assert.ok(
    !adjusted.issues.some(
      (issue) => uploadedMonths.some((month) => issue.startsWith(month)) && issue.includes('Missing POPULATION'),
    ),
  );
  assert.ok(JSON.stringify(uploadedNra.sources).includes('uploaded-population:'));
  const extreme = await service.wastePreview(f.owner, f.orgId, apiSite.id, reportingYear, ['HDD', 'CDD']);
  const extremeMeter = extreme.preview.meters.find((meter) => meter.id === biodiesel.id)!;
  assert.notEqual(extremeMeter.rows[0].variance, null);
  assert.ok(extremeMeter.issues.some((issue) => issue.includes('HDD is outside the baseline weather range')));
  console.log(
    '✓ automatic NRA uses uploaded population evidence and flags weather extrapolation without blanking charts',
  );
  // Another reporting meter for the same use makes the comparison ambiguous; do not duplicate a baseline.
  const additional = await sites.saveMeter(f.owner, f.orgId, apiSite.id, {
    code: 'SECOND-HEAT',
    name: 'Additional heating',
    fuel: 'GAS',
    unit: 'kWh',
  });
  await energy.add(f.owner, f.orgId, apiSite.id, {
    meterId: additional.id,
    month: `${reportingYear}-01`,
    quantity: '10',
    endUse: 'Heating',
    estimated: false,
  });
  const ambiguous = await service.wastePreview(f.owner, f.orgId, apiSite.id, reportingYear);
  assert.ok(
    ambiguous.preview.meters.find((meter) => meter.id === biodiesel.id)!.rows.every((row) => row.variance === null),
  );
  console.log(
    '✓ fuel changes match one consistent thermal end use, retain original baseline evidence and reject ambiguous series',
  );
  console.log(
    '✓ automatic site geocoding, idempotent baseline/reporting fetches, current-year monthly weather and nonzero calculations',
  );
  console.log(
    '✓ automatic uploaded-data previews, single/multiple/NRA calculations, generated workbook, scoped access and no saved analysis writes',
  );
} finally {
  await cleanup();
}
