import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { actorFor } from '../src/server/foundation';
import { AnalyticsReportService, reportFingerprint } from '../src/server/analytics-reports';
import { ReportArchiveService } from '../src/server/report-archives';
import { ReportScheduleService } from '../src/server/report-schedules';
import { ReportDeliveryWorker } from '../src/server/report-delivery-worker';
const { db, cleanup } = await testDatabase();
try {
  const org = await db.organisation.create({ data: { name: 'Worker', slug: crypto.randomUUID(), planKey: 'GROWTH' } });
  const user = await db.user.create({ data: { email: 'worker@example.test', emailVerified: new Date() } });
  const reader = await db.user.create({ data: { email: 'recipient@example.test', emailVerified: new Date() } });
  const member = await db.membership.create({ data: { organisationId: org.id, userId: user.id, role: 'OWNER' } });
  const recipient = await db.membership.create({ data: { organisationId: org.id, userId: reader.id, role: 'VIEWER' } });
  const site = await db.site.create({ data: { organisationId: org.id, code: 'A', name: 'A' } });
  const actor = actorFor(user.id);
  let now = new Date();
  const mail = {
    async send() {
      throw new Error('No worker test may send mail');
    },
  };
  const url = 'http://localhost';
  const schedules = new ReportScheduleService(db, mail, url);
  const reports = new AnalyticsReportService(db, mail, url);
  const archives = new ReportArchiveService(db, mail, url);
  const worker = new ReportDeliveryWorker(db, mail, url, () => now);
  const definition = { family: 'energy', year: 2020 };
  const fingerprint = reportFingerprint(await reports.report(actor, org.id, site.id, definition));
  const archive = await archives.capture(actor, org.id, site.id, {
    definition,
    fingerprint,
    requestKey: crypto.randomUUID(),
  });
  const draft = await schedules.save(actor, org.id, site.id, {
    action: 'DRAFT',
    archiveId: archive.id,
    fingerprint,
    recipientMembershipIds: [recipient.id],
    timezone: 'UTC',
    requestKey: crypto.randomUUID(),
  });
  const job = await schedules.prepareOccurrence(actor, org.id, site.id, draft.scheduleId, {
    revisionId: draft.id,
    occurrenceAt: new Date(now.getTime() - 1000).toISOString(),
  });
  const future = await schedules.prepareOccurrence(actor, org.id, site.id, draft.scheduleId, {
    revisionId: draft.id,
    occurrenceAt: new Date(now.getTime() + 3600000).toISOString(),
  });
  const claim = (key = crypto.randomUUID()) => worker.claim(actor, org.id, site.id, job.id, key);
  const finish = (token: string) => worker.complete(actor, org.id, site.id, job.id, token);
  assert.equal((await worker.claim(actor, org.id, site.id, future.id, crypto.randomUUID())).reason, 'NOT_DUE');
  const pair = await Promise.all([claim(), claim()]);
  assert.equal(pair.filter((r) => r.claimed).length, 1);
  const first = pair.find((r) => r.claimed)!;
  assert.ok(first.check);
  const ready = await finish(first.check.token);
  assert.equal(ready.status, 'READY_NO_SEND');
  assert.equal(ready.delivery, 'DISABLED');
  assert.equal((await claim(first.check.requestKey)).check?.id, first.check.id);
  assert.equal((await finish(first.check.token)).status, 'STALE_CLAIM');
  assert.equal((await db.reportDeliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status, 'HELD');
  const abandoned = await claim();
  assert.ok(abandoned.claimed);
  now = new Date(now.getTime() + 120001);
  const replacement = await claim();
  assert.ok(replacement.claimed);
  assert.equal(
    (await db.reportDeliveryCheck.findUniqueOrThrow({ where: { id: abandoned.check.id } })).status,
    'INTERRUPTED',
  );
  assert.equal((await finish(abandoned.check.token)).status, 'STALE_CLAIM');
  await db.membership.update({ where: { id: recipient.id }, data: { revokedAt: new Date() } });
  assert.equal((await finish(replacement.check.token)).status, 'BLOCKED');
  await db.membership.update({ where: { id: recipient.id }, data: { revokedAt: null } });
  const ownerRevoked = await claim();
  assert.ok(ownerRevoked.claimed);
  await db.membership.update({ where: { id: member.id }, data: { revokedAt: new Date() } });
  assert.equal((await finish(ownerRevoked.check.token)).status, 'BLOCKED');
  await assert.rejects(claim(), { status: 404 });
  await db.membership.update({ where: { id: member.id }, data: { revokedAt: null } });
  await assert.rejects(worker.complete(actorFor(reader.id), org.id, site.id, job.id, first.check.token), {
    status: 404,
  });
  await assert.rejects(worker.complete(actor, org.id, site.id, future.id, first.check.token), { status: 404 });
  const downgrade = await claim();
  assert.ok(downgrade.claimed);
  await db.organisation.update({ where: { id: org.id }, data: { planKey: 'STARTER' } });
  assert.equal((await finish(downgrade.check.token)).code, 'REPORT_PLAN');
  await db.organisation.update({ where: { id: org.id }, data: { planKey: 'GROWTH' } });
  const expiredCompletion = await claim();
  assert.ok(expiredCompletion.claimed);
  now = new Date(now.getTime() + 120001);
  assert.equal((await finish(expiredCompletion.check.token)).status, 'INTERRUPTED');
  // A failing audit cannot finalize the check; it remains recoverable.
  const rollback = await claim();
  assert.ok(rollback.claimed);
  await db.$executeRawUnsafe(
    `CREATE FUNCTION fail_check_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'report.delivery_check_finished' THEN RAISE EXCEPTION 'Test failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    'CREATE TRIGGER fail_check_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION fail_check_audit()',
  );
  try {
    await assert.rejects(finish(rollback.check.token));
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER fail_check_audit ON "AuditEvent"');
    await db.$executeRawUnsafe('DROP FUNCTION fail_check_audit()');
  }
  assert.equal(
    (await db.reportDeliveryCheck.findUniqueOrThrow({ where: { id: rollback.check.id } })).status,
    'CHECKING',
  );
  await schedules.save(actor, org.id, site.id, {
    action: 'CANCEL',
    scheduleId: draft.scheduleId,
    expectedRevisionId: draft.id,
    requestKey: crypto.randomUUID(),
  });
  assert.equal((await finish(rollback.check.token)).code, 'SCHEDULE_CHANGED');
  assert.equal((await claim()).reason, 'JOB_CANCELLED');
  await assert.rejects(
    db.reportDeliveryCheck.update({
      where: { id: first.check.id },
      data: { status: 'CHECKING', finishedAt: null, code: null },
    }),
  );
  await assert.rejects(db.reportDeliveryCheck.delete({ where: { id: first.check.id } }));
  await assert.rejects(db.$executeRawUnsafe('TRUNCATE TABLE "ReportDeliveryCheck"'));
  assert.equal(await db.auditEvent.count({ where: { action: 'report.delivery_check_interrupted' } }), 1);
  const cancelledResult = await worker.execute(actor, org.id, site.id, draft.scheduleId, job.id, {
    requestKey: crypto.randomUUID(),
  });
  assert.equal(cancelledResult.status, 'JOB_CANCELLED');
  assert.ok(!JSON.stringify(cancelledResult).includes('token'));
  await assert.rejects(
    worker.execute(actor, org.id, site.id, crypto.randomUUID(), job.id, { requestKey: crypto.randomUUID() }),
    { status: 404 },
  );
  await assert.rejects(
    worker.execute(actor, org.id, site.id, draft.scheduleId, job.id, {
      requestKey: crypto.randomUUID(),
      token: crypto.randomUUID(),
    }),
  );
  await db.membership.update({ where: { id: recipient.id }, data: { role: 'ANALYST' } });
  await assert.rejects(
    worker.execute(actorFor(reader.id), org.id, site.id, draft.scheduleId, job.id, { requestKey: crypto.randomUUID() }),
    { status: 404 },
  );
  const history = await schedules.checks(actor, org.id, site.id, draft.scheduleId, job.id);
  assert.equal(history.delivery, 'DISABLED');
  assert.equal(history.items.length, await db.reportDeliveryCheck.count({ where: { jobId: job.id } }));
  const serialized = JSON.stringify(history);
  assert.ok(!serialized.includes('token'));
  assert.ok(!serialized.includes('requestKey'));
  assert.ok(!serialized.includes(first.check.token));
  await assert.rejects(schedules.checks(actorFor(reader.id), org.id, site.id, draft.scheduleId, job.id), {
    status: 404,
  });
  await assert.rejects(schedules.checks(actor, org.id, site.id, draft.scheduleId, future.id, first.check.id), {
    status: 404,
  });
  await assert.rejects(schedules.checks(actor, org.id, site.id, crypto.randomUUID(), job.id), { status: 404 });
  await assert.rejects(schedules.checks(actor, org.id, crypto.randomUUID(), draft.scheduleId, job.id), { status: 404 });
  await assert.rejects(schedules.checks(actor, crypto.randomUUID(), site.id, draft.scheduleId, job.id), {
    status: 404,
  });
  await db.membership.update({ where: { id: member.id }, data: { revokedAt: new Date() } });
  await assert.rejects(schedules.checks(actor, org.id, site.id, draft.scheduleId, job.id), { status: 404 });
  console.log(
    '✓ delivery readiness worker: single claims, due times, durable outcomes, lease recovery, stale tokens, revocation, plan changes, cancellation, audit rollback and no sends',
  );
} finally {
  await cleanup();
}
