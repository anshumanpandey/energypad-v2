import assert from 'node:assert/strict';
import { actorFor } from '../src/server/foundation';
import { EmissionFactorService } from '../src/server/emission-factors';
import { testDatabase } from './test-database';
const { db, cleanup } = await testDatabase();
const service = new EmissionFactorService(db, { async send() {} }, 'http://localhost:3100');
try {
  const actor = actorFor(
    (await db.user.create({ data: { email: 'factor@example.test', emailVerified: new Date() } })).id,
  );
  const stranger = actorFor(
    (await db.user.create({ data: { email: 'factor-other@example.test', emailVerified: new Date() } })).id,
  );
  const viewer = actorFor(
    (await db.user.create({ data: { email: 'factor-viewer@example.test', emailVerified: new Date() } })).id,
  );
  const org = await service.createOrganisation(actor, { name: 'Factors', currency: 'GBP', timezone: 'UTC' });
  const other = await service.createOrganisation(stranger, { name: 'Other Factors', currency: 'GBP', timezone: 'UTC' });
  await db.membership.create({ data: { organisationId: org.id, userId: viewer.userId, role: 'VIEWER' } });
  const input = {
    fuel: 'ELECTRICITY',
    geography: 'gb',
    basis: 'LOCATION_BASED',
    unit: 'kgCO2e/kWh',
    factor: '0.123456789',
    source: 'Synthetic test reference only',
    firstDay: '2020-01-01',
    lastDay: '2020-12-31',
  };
  const races = await Promise.allSettled([service.add(actor, org.id, input), service.add(actor, org.id, input)]);
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  const original = (await service.list(actor, org.id))[0];
  assert.equal(original.factor.toString(), '0.123456789');
  assert.equal(original.geography, 'GB');
  assert.equal(original.validUntil.toISOString().slice(0, 10), '2021-01-01');
  await assert.rejects(service.list(stranger, org.id));
  await assert.rejects(service.add(viewer, org.id, input));
  assert.equal((await service.list(viewer, org.id)).length, 1);
  await assert.rejects(service.correct(stranger, other.id, original.id, { factor: input, reason: 'Wrong tenant' }));
  await assert.rejects(
    service.correct(actor, org.id, original.id, { factor: { ...input, fuel: 'GAS' }, reason: 'Wrong identity' }),
  );
  const corrected = await service.correct(actor, org.id, original.id, {
    factor: { ...input, factor: '0' },
    reason: 'Correct synthetic example',
  });
  assert.equal(corrected.revision, 2);
  assert.equal(corrected.supersedesId, original.id);
  await assert.rejects(service.correct(actor, org.id, original.id, { factor: input, reason: 'Stale correction' }));
  assert.equal(
    (await db.emissionFactorVersion.findUniqueOrThrow({ where: { id: original.id } })).factor.toString(),
    '0.123456789',
  );
  await service.add(actor, org.id, { ...input, firstDay: '2021-01-01', lastDay: '2021-12-31' });
  await service.add(actor, org.id, { ...input, basis: 'MARKET_BASED' });
  await assert.rejects(service.add(actor, org.id, { ...input, firstDay: '2020-02-30' }));
  await assert.rejects(service.add(actor, org.id, { ...input, factor: '-0.1' }));
  await assert.rejects(
    db.emissionFactorVersion.update({ where: { id: original.id }, data: { source: 'Alter history' } }),
  );
  await assert.rejects(db.emissionFactorVersion.delete({ where: { id: original.id } }));
  assert.equal(await db.auditEvent.count({ where: { organisationId: org.id, action: 'carbon.factor_corrected' } }), 1);
  console.log(
    '✓ factors: precision, date boundaries, concurrent overlap, corrections, immutable history, tenant isolation, viewer permissions and audit',
  );
} finally {
  await cleanup();
}
