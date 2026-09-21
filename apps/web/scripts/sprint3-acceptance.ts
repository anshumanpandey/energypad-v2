import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { EnergyImportService } from '../src/server/energy-import';
import { DriverService } from '../src/server/drivers';
import { WeatherJobs } from '../src/server/weather/jobs';
import { OpenMeteoProvider } from '../src/server/weather/provider';
import { syntheticWeather } from '../tests/fixtures/weather';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const mail = { async send() {} };
const sites = new SiteService(db, mail, 'http://localhost:3100');
const energy = new EnergyImportService(db, mail, 'http://localhost:3100');
const drivers = new DriverService(db, mail, 'http://localhost:3100');
let fail = true;
const provider = new OpenMeteoProvider({
  fetch: async () => (fail ? new Response('Synthetic outage', { status: 503 }) : Response.json(syntheticWeather(2020))),
});
const jobs = new WeatherJobs(db, mail, 'http://localhost:3100', provider);
async function workbook(headers: string[], rows: (string | number)[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Data');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return new Uint8Array(await book.xlsx.writeBuffer());
}
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'acceptance@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Acceptance', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'ACCEPT', name: 'Synthetic acceptance site' });
  const meter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const months = Array.from({ length: 12 }, (_, i) => `2020-${String(i + 1).padStart(2, '0')}`);
  const bytes = await workbook(
    ['month', 'quantity', 'unit'],
    months.map((month) => [month, 100, 'kWh']),
  );
  const batch = await energy.upload(actor, org.id, site.id, meter.id, bytes);
  await energy.map(actor, org.id, site.id, batch.id, {
    sheet: 0,
    columns: { month: 0, quantity: 1, unit: 2 },
    defaults: { estimated: 'actual', netCost: '15', currency: 'GBP', vatPercent: '20' },
    confirmed: true,
  });
  await energy.commit(actor, org.id, site.id, batch.id);
  const readings = await energy.records(actor, org.id, site.id, 2020);
  assert.equal(readings.coverage[0].missing.length, 0);
  assert.equal(
    readings.records.reduce((sum, r) => sum + Number(r.normalizedKwh), 0),
    1200,
  );
  assert.equal(
    readings.records.reduce((sum, r) => sum + Number(r.grossCost), 0),
    216,
  );
  assert.equal((await drivers.list(actor, org.id, site.id, 2020)).coverage[0].missing.length, 12);
  const driverBatch = await drivers.upload(
    actor,
    org.id,
    site.id,
    await workbook(
      ['month', 'driver', 'value', 'source'],
      months.flatMap((month) => [
        [month, 'POPULATION', '0', 'Synthetic attendance'],
        [month, 'OPERATING_HOURS', '160', 'Synthetic operations'],
      ]),
    ),
  );
  await drivers.commit(actor, org.id, site.id, driverBatch.id);
  assert.ok((await drivers.list(actor, org.id, site.id, 2020)).coverage.every((c) => !c.missing.length));
  const config = await jobs.configure(actor, org.id, site.id, {
    latitude: '51.5',
    longitude: '-0.12',
    timezone: 'Europe/London',
    heatingBase: '15',
    coolingBase: '20',
    source: 'Synthetic acceptance policy',
  });
  const job = await jobs.enqueue(actor, org.id, site.id, { configurationId: config.id, year: 2020 });
  await jobs.processOne();
  const waiting = await jobs.list(actor, org.id, site.id, 2020);
  assert.equal(waiting.jobs.find((j) => j.id === job.id)?.status, 'RETRY_WAIT');
  assert.equal(waiting.results.length, 0);
  assert.equal(await db.weatherYear.count(), 0);
  fail = false;
  // Advance only this isolated test job's retry time; exercise recovery with a fresh worker instance.
  await db.weatherJob.update({ where: { id: job.id }, data: { availableAt: new Date(0) } });
  await new WeatherJobs(db, mail, 'http://localhost:3100', provider).processOne();
  const complete = await jobs.list(actor, org.id, site.id, 2020);
  assert.equal(complete.jobs.find((j) => j.id === job.id)?.status, 'SUCCEEDED');
  assert.equal(complete.results.length, 1);
  const persistedWeather = await db.weatherYear.findUniqueOrThrow({ where: { id: complete.results[0].id } });
  assert.equal((persistedWeather.daily as unknown[]).length, 366);
  const weatherMonths = (complete.results[0].monthly as { month: string }[]).map((m) => m.month);
  assert.deepEqual(weatherMonths, months);
  await energy.commit(actor, org.id, site.id, batch.id);
  await drivers.commit(actor, org.id, site.id, driverBatch.id);
  await jobs.enqueue(actor, org.id, site.id, { configurationId: config.id, year: 2020 });
  assert.equal(await jobs.processOne(), false);
  assert.deepEqual((await energy.records(actor, org.id, site.id, 2020)).records, readings.records);
  assert.equal(await db.driverObservation.count(), 24);
  assert.equal(await db.weatherYear.count(), 1);
  console.log(
    '✓ combined 12-month consumption/driver imports, visible weather failure, fresh-worker recovery, complete leap-year enrichment and idempotency',
  );
} finally {
  await cleanup();
}
