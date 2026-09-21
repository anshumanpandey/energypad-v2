import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { actorFor } from '../src/server/foundation';
import { SiteService } from '../src/server/sites';
import { WeatherJobs } from '../src/server/weather/jobs';
import { OpenMeteoProvider } from '../src/server/weather/provider';
import { testDatabase } from './test-database';
import { syntheticWeather } from '../tests/fixtures/weather';
const { db, cleanup } = await testDatabase();
const mail = { async send() {} };
let calls = 0,
  fail = false,
  forbidden = false,
  hook: (() => Promise<void>) | undefined;
const provider = new OpenMeteoProvider({
  fetch: async (url) => {
    calls++;
    if (hook) await hook();
    if (forbidden) return new Response('private-provider-body', { status: 403 });
    if (fail) return new Response('private-provider-body', { status: 503 });
    return Response.json(syntheticWeather(Number(new URL(String(url)).searchParams.get('start_date')!.slice(0, 4))));
  },
});
const jobs = new WeatherJobs(db, mail, 'http://localhost:3100', provider);
const sites = new SiteService(db, mail, 'http://localhost:3100');
const settings = {
  latitude: '51.5',
  longitude: '-0.12',
  timezone: 'Europe/London',
  heatingBase: '15',
  coolingBase: '20',
  source: 'Synthetic queue test',
};
const get = (id: string) => db.weatherJob.findUniqueOrThrow({ where: { id } });
const due = (id: string) => db.weatherJob.update({ where: { id }, data: { availableAt: new Date(0) } });
try {
  const owner = actorFor(
    (await db.user.create({ data: { email: 'queue@example.test', emailVerified: new Date() } })).id,
  );
  const other = actorFor(
    (await db.user.create({ data: { email: 'other-queue@example.test', emailVerified: new Date() } })).id,
  );
  const org = await sites.createOrganisation(owner, { name: 'Queue', currency: 'GBP', timezone: 'UTC' });
  const otherOrg = await sites.createOrganisation(other, { name: 'Other', currency: 'GBP', timezone: 'UTC' });
  const site = await sites.createSite(owner, org.id, { code: 'Q', name: 'Queue site' });
  const config = await jobs.configure(owner, org.id, site.id, settings);
  const input = (year: number) => ({ configurationId: config.id, year });
  await assert.rejects(jobs.enqueue(other, otherOrg.id, site.id, input(2020)));
  const [one, two] = await Promise.all([
    jobs.enqueue(owner, org.id, site.id, input(2020)),
    jobs.enqueue(owner, org.id, site.id, input(2020)),
  ]);
  assert.equal(one.id, two.id);
  assert.equal(calls, 0);
  await Promise.all([jobs.processOne(), jobs.processOne()]);
  assert.equal(calls, 1);
  assert.equal((await get(one.id)).status, 'SUCCEEDED');
  assert.equal(await db.weatherYear.count(), 1);
  assert.equal(await db.auditEvent.count({ where: { action: 'weather.job_succeeded' } }), 1);
  await jobs.enqueue(owner, org.id, site.id, input(2020));
  assert.equal(await jobs.processOne(), false);
  console.log('✓ durable enqueue, tenant checks, concurrent deduplication and one provider execution/result');
  fail = true;
  const failing = await jobs.enqueue(owner, org.id, site.id, input(2021));
  await jobs.processOne();
  let state = await get(failing.id);
  assert.equal(state.status, 'RETRY_WAIT');
  assert.equal(state.attempts, 1);
  assert.ok(+state.availableAt > Date.now());
  assert.equal(await jobs.processOne(), false);
  await due(failing.id);
  await jobs.processOne();
  state = await get(failing.id);
  assert.equal(state.status, 'RETRY_WAIT');
  assert.equal(state.attempts, 2);
  await due(failing.id);
  await jobs.processOne();
  state = await get(failing.id);
  assert.equal(state.status, 'FAILED');
  assert.equal(state.attempts, 3);
  assert.equal(await db.weatherYear.count({ where: { year: 2021 } }), 0);
  assert.ok(!JSON.stringify(state).includes('private-provider-body'));
  await assert.rejects(jobs.retry(other, otherOrg.id, site.id, failing.id));
  fail = false;
  await jobs.retry(owner, org.id, site.id, failing.id);
  assert.equal((await get(failing.id)).attempts, 0);
  await jobs.processOne();
  state = await get(failing.id);
  assert.equal(state.status, 'SUCCEEDED');
  assert.equal(state.totalAttempts, 4);
  console.log('✓ bounded automatic backoff, exhausted retries, safe errors and explicit retry recovery');
  const crashed = await jobs.enqueue(owner, org.id, site.id, input(2022));
  await db.weatherJob.update({
    where: { id: crashed.id },
    data: { status: 'RUNNING', attempts: 1, totalAttempts: 1, leaseToken: randomUUID(), leaseUntil: new Date(0) },
  });
  // A fresh service instance represents a restarted worker; state lives in PostgreSQL.
  await new WeatherJobs(db, mail, 'http://localhost:3100', provider).processOne();
  assert.equal((await get(crashed.id)).status, 'SUCCEEDED');
  assert.equal((await get(crashed.id)).attempts, 2);
  const expired = await jobs.enqueue(owner, org.id, site.id, input(2023));
  await db.weatherJob.update({
    where: { id: expired.id },
    data: { status: 'RUNNING', attempts: 3, totalAttempts: 3, leaseToken: randomUUID(), leaseUntil: new Date(0) },
  });
  const beforeExpiry = calls;
  await jobs.processOne();
  assert.equal(calls, beforeExpiry);
  assert.equal((await get(expired.id)).status, 'FAILED');
  console.log('✓ worker restart recovery and bounded crash attempts');
  const fenced = await jobs.enqueue(owner, org.id, site.id, input(2019));
  let started!: () => void, release!: () => void;
  const startedPromise = new Promise<void>((r) => {
    started = r;
  });
  const gate = new Promise<void>((r) => {
    release = r;
  });
  hook = async () => {
    started();
    await gate;
  };
  const oldWorker = jobs.processOne();
  await startedPromise;
  await db.weatherJob.update({ where: { id: fenced.id }, data: { leaseUntil: new Date(0) } });
  hook = undefined;
  await jobs.processOne();
  release();
  await oldWorker;
  assert.equal((await get(fenced.id)).status, 'SUCCEEDED');
  assert.equal(await db.weatherYear.count({ where: { year: 2019 } }), 1);
  assert.equal(await db.auditEvent.count({ where: { action: 'weather.job_succeeded', targetId: fenced.id } }), 1);
  console.log('✓ stale workers cannot overwrite reclaimed jobs or duplicate results');
  forbidden = true;
  const denied = await jobs.enqueue(owner, org.id, site.id, input(2018));
  await jobs.processOne();
  assert.equal((await get(denied.id)).status, 'FAILED');
  assert.equal((await get(denied.id)).attempts, 1);
  forbidden = false;
  const admin = actorFor(
    (await db.user.create({ data: { email: 'queue-admin@example.test', emailVerified: new Date() } })).id,
  );
  const member = await db.membership.create({ data: { organisationId: org.id, userId: admin.userId, role: 'ADMIN' } });
  const revoked = await jobs.enqueue(admin, org.id, site.id, input(2017));
  await db.membership.update({ where: { id: member.id }, data: { role: 'VIEWER' } });
  const prior = calls;
  await jobs.processOne();
  assert.equal(calls, prior);
  assert.equal((await get(revoked.id)).status, 'FAILED');
  await jobs.retry(owner, org.id, site.id, revoked.id);
  hook = async () => {
    await sites.archiveSite(owner, org.id, site.id);
  };
  await jobs.processOne();
  hook = undefined;
  assert.equal((await get(revoked.id)).status, 'FAILED');
  assert.equal(await db.weatherYear.count({ where: { year: 2017 } }), 0);
  console.log('✓ permanent provider errors, revoked execution rights and archive-before-commit rejection');
} finally {
  await cleanup();
}
