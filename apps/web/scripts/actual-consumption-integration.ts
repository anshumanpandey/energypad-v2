import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { testDatabase } from './test-database';
import { SiteService } from '../src/server/sites';
import { EnergyService } from '../src/server/energy';
import { actorFor } from '../src/server/foundation';
const { db, databaseUrl, cleanup } = await testDatabase();
const sql = new Client({ connectionString: databaseUrl });
try {
  await sql.connect();
  const mail = { async send() {} },
    url = 'http://localhost:3100';
  const sites = new SiteService(db, mail, url),
    energy = new EnergyService(db, mail, url);
  const actor = actorFor(
    (await db.user.create({ data: { email: 'actual@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(actor, { name: 'Actual readings test', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(actor, org.id, { code: 'ACTUAL', name: 'Actual site' });
  const meter = await sites.saveMeter(actor, org.id, site.id, {
    code: 'GRID',
    name: 'Grid',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const row = await energy.add(actor, org.id, site.id, {
    meterId: meter.id,
    month: '2020-01',
    quantity: '12',
    estimated: true,
  });
  assert.equal(row.estimated, false);
  assert.ok(!(row.qualityFlags as string[]).includes('Estimated reading'));
  // Recreate the pre-migration state in this disposable database, including a legacy quality flag.
  await sql.query('ALTER TABLE "ConsumptionRecord" DROP CONSTRAINT "ConsumptionRecord_actual_only"');
  await sql.query('ALTER TABLE "ConsumptionRecord" DISABLE TRIGGER reading_immutable');
  await sql.query('UPDATE "ConsumptionRecord" SET estimated=true, "qualityFlags"=$1::jsonb WHERE id=$2', [
    JSON.stringify(['Estimated reading', 'Missing population']),
    row.id,
  ]);
  await sql.query('ALTER TABLE "ConsumptionRecord" ENABLE TRIGGER reading_immutable');
  await sql.query(await readFile('prisma/migrations/202610030001_actual_consumption_only/migration.sql', 'utf8'));
  const migrated = await db.consumptionRecord.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(migrated.estimated, false);
  assert.deepEqual(migrated.qualityFlags, ['Missing population']);
  assert.equal(migrated.normalizedKwh.toString(), row.normalizedKwh.toString());
  await assert.rejects(sql.query('UPDATE "ConsumptionRecord" SET estimated=true WHERE id=$1', [row.id]), /immutable/i);
  await sql.query('ALTER TABLE "ConsumptionRecord" DISABLE TRIGGER reading_immutable');
  await assert.rejects(sql.query('UPDATE "ConsumptionRecord" SET estimated=true WHERE id=$1', [row.id]), /actual_only/);
  await sql.query('ALTER TABLE "ConsumptionRecord" ENABLE TRIGGER reading_immutable');
  console.log(
    '✓ Actual-only writes, existing-record migration, preserved values/other flags, immutable trigger and database constraint',
  );
} finally {
  await sql.end();
  await cleanup();
}
