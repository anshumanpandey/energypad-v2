import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { actorFor } from '../src/server/foundation';
import { AnalyticsReportService, reportFingerprint } from '../src/server/analytics-reports';
import { ReportArchiveService } from '../src/server/report-archives';
import { ReportScheduleService } from '../src/server/report-schedules';
const { db, cleanup } = await testDatabase();
try {
  const org = await db.organisation.create({
    data: { name: 'Schedules', slug: crypto.randomUUID(), planKey: 'GROWTH' },
  });
  const owner = await db.user.create({ data: { email: 'schedule-owner@example.test', emailVerified: new Date() } });
  const reader = await db.user.create({ data: { email: 'schedule-reader@example.test', emailVerified: new Date() } });
  const ownerMember = await db.membership.create({ data: { organisationId: org.id, userId: owner.id, role: 'OWNER' } });
  const readerMember = await db.membership.create({
    data: { organisationId: org.id, userId: reader.id, role: 'ANALYST' },
  });
  const foreignOrg = await db.organisation.create({
    data: { name: 'Foreign', slug: crypto.randomUUID(), planKey: 'GROWTH' },
  });
  const foreignMember = await db.membership.create({
    data: { organisationId: foreignOrg.id, userId: reader.id, role: 'OWNER' },
  });
  const site = await db.site.create({ data: { organisationId: org.id, code: 'A', name: 'Site' } });
  const otherSite = await db.site.create({ data: { organisationId: org.id, code: 'B', name: 'Other' } });
  const actor = actorFor(owner.id);
  const mail = {
    async send() {
      throw new Error('Draft schedules must never send mail');
    },
  };
  const archives = new ReportArchiveService(db, mail, 'http://localhost');
  const reports = new AnalyticsReportService(db, mail, 'http://localhost');
  const schedules = new ReportScheduleService(db, mail, 'http://localhost');
  const definition = { family: 'energy', year: 2020 };
  const fingerprint = reportFingerprint(await reports.report(actor, org.id, site.id, definition));
  const archive = await archives.capture(actor, org.id, site.id, {
    definition,
    fingerprint,
    requestKey: crypto.randomUUID(),
  });
  const input = {
    action: 'DRAFT',
    archiveId: archive.id,
    fingerprint,
    timezone: 'Europe/London',
    recipientMembershipIds: [readerMember.id, ownerMember.id],
    requestKey: crypto.randomUUID(),
  };
  const save = (value: unknown) => schedules.save(actor, org.id, site.id, value);
  const [first, duplicate] = await Promise.all([save(input), save(input)]);
  assert.equal(first.id, duplicate.id);
  assert.equal(first.state, 'DRAFT');
  assert.equal(await db.reportSchedule.count(), 1);
  assert.equal(await db.auditEvent.count({ where: { action: 'report.schedule_revised' } }), 1);
  assert.equal(
    (await save({ ...input, recipientMembershipIds: [...input.recipientMembershipIds].reverse() })).id,
    first.id,
  );
  await assert.rejects(save({ ...input, timezone: 'UTC' }), { code: 'REQUEST_CONFLICT' });
  await assert.rejects(save({ ...input, requestKey: crypto.randomUUID(), timezone: 'Not/AZone' }));
  await assert.rejects(
    save({ ...input, requestKey: crypto.randomUUID(), recipientMembershipIds: [foreignMember.id] }),
    { code: 'REPORT_RECIPIENT_ACCESS' },
  );
  await assert.rejects(schedules.save(actor, org.id, otherSite.id, { ...input, requestKey: crypto.randomUUID() }), {
    status: 404,
  });
  const occurrence = { revisionId: first.id, occurrenceAt: '2026-10-25T01:30:00.000Z' };
  const prepare = (value: unknown = occurrence) =>
    schedules.prepareOccurrence(actor, org.id, site.id, first.scheduleId, value);
  const [job, sameJob] = await Promise.all([prepare(), prepare()]);
  assert.equal(job.id, sameJob.id);
  assert.equal(job.status, 'HELD');
  assert.equal(await db.auditEvent.count({ where: { action: 'report.occurrence_prepared' } }), 1);
  // The two London fall-back instants stay distinct; no ambiguous local-time conversion occurs.
  const earlier = await prepare({ ...occurrence, occurrenceAt: '2026-10-25T00:30:00.000Z' });
  assert.notEqual(earlier.id, job.id);
  await assert.rejects(prepare({ ...occurrence, occurrenceAt: '2026-10-25T01:30:00' }));
  await assert.rejects(
    schedules.prepareOccurrence(actorFor(reader.id), org.id, site.id, first.scheduleId, occurrence),
    { status: 404 },
  );
  await assert.rejects(
    schedules.prepareOccurrence(actorFor(reader.id), foreignOrg.id, site.id, first.scheduleId, occurrence),
    { status: 404 },
  );
  await db.membership.update({ where: { id: readerMember.id }, data: { revokedAt: new Date() } });
  await assert.rejects(prepare(), { code: 'REPORT_RECIPIENT_ACCESS' });
  await db.membership.update({ where: { id: readerMember.id }, data: { revokedAt: null } });
  const edit = {
    ...input,
    scheduleId: first.scheduleId,
    expectedRevisionId: first.id,
    requestKey: crypto.randomUUID(),
    timezone: 'UTC',
  };
  const races = await Promise.allSettled([
    save(edit),
    save({ ...edit, requestKey: crypto.randomUUID(), timezone: 'America/Bogota' }),
  ]);
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = races.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.code, 'SCHEDULE_CHANGED');
  const latest = await db.reportScheduleRevision.findFirstOrThrow({
    where: { scheduleId: first.scheduleId },
    orderBy: { revision: 'desc' },
  });
  assert.equal(latest.revision, 2);
  assert.equal(await db.reportDeliveryJob.count({ where: { status: 'CANCELLED' } }), 2);
  await assert.rejects(prepare(), { code: 'SCHEDULE_CHANGED' });
  const held = await prepare({ ...occurrence, revisionId: latest.id });
  // Failure to audit must roll back both the new revision and cancellation of its held job.
  await db.$executeRawUnsafe(
    `CREATE FUNCTION reject_schedule_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('report.schedule_revised', 'report.occurrence_prepared') THEN RAISE EXCEPTION 'Test audit failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER reject_schedule_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION reject_schedule_audit()`,
  );
  try {
    await assert.rejects(save({ ...edit, expectedRevisionId: latest.id, requestKey: crypto.randomUUID() }));
    assert.equal(await db.reportScheduleRevision.count(), 2);
    assert.equal((await db.reportDeliveryJob.findUniqueOrThrow({ where: { id: held.id } })).status, 'HELD');
    await assert.rejects(prepare({ revisionId: latest.id, occurrenceAt: '2026-11-01T00:00:00.000Z' }));
    assert.equal(await db.reportDeliveryJob.count(), 3);
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER reject_schedule_audit ON "AuditEvent"');
    await db.$executeRawUnsafe('DROP FUNCTION reject_schedule_audit()');
  }
  // Database-only bypass attempts: immutable identity/evidence, invalid lineage, tenant and state references.
  await assert.rejects(
    db.reportSchedule.update({ where: { id: first.scheduleId }, data: { ownerMembershipId: readerMember.id } }),
  );
  await assert.rejects(db.reportScheduleRevision.update({ where: { id: first.id }, data: { timezone: 'UTC' } }));
  await assert.rejects(db.reportDeliveryJob.update({ where: { id: held.id }, data: { status: 'RUNNING' } }));
  await assert.rejects(db.reportDeliveryJob.update({ where: { id: held.id }, data: { occurrenceAt: new Date() } }));
  await assert.rejects(
    db.reportDeliveryJob.create({
      data: {
        organisationId: org.id,
        siteId: site.id,
        scheduleId: first.scheduleId,
        revisionId: first.id,
        occurrenceAt: new Date(),
      },
    }),
  );
  await assert.rejects(
    db.reportDeliveryJob.create({
      data: {
        organisationId: foreignOrg.id,
        siteId: site.id,
        scheduleId: first.scheduleId,
        revisionId: latest.id,
        occurrenceAt: new Date(),
      },
    }),
  );
  const { id: _id, ...copy } = latest;
  void _id;
  await assert.rejects(
    db.reportScheduleRevision.create({
      data: { ...copy, revision: 5, previousId: latest.id, requestKey: crypto.randomUUID() },
    }),
  );
  await assert.rejects(
    db.reportScheduleRevision.create({
      data: {
        ...copy,
        revision: 3,
        previousId: latest.id,
        recipientMembershipIds: [foreignMember.id],
        requestKey: crypto.randomUUID(),
      },
    }),
  );
  await assert.rejects(
    db.reportScheduleRevision.create({
      data: {
        ...copy,
        revision: 3,
        previousId: latest.id,
        fingerprint: '0'.repeat(64),
        requestKey: crypto.randomUUID(),
      },
    }),
  );
  await assert.rejects(db.$executeRaw`
    INSERT INTO "ReportScheduleRevision" (id, "scheduleId", "organisationId", "siteId", revision, "previousId", state, "archiveId", fingerprint, "recipientMembershipIds", timezone, "requestKey", "requestHash")
    SELECT ${crypto.randomUUID()}::uuid, "scheduleId", "organisationId", "siteId", 3, id, state, "archiveId", fingerprint, NULL::uuid[], timezone, ${crypto.randomUUID()}::uuid, "requestHash"
    FROM "ReportScheduleRevision" WHERE id = ${latest.id}::uuid
  `);
  // Cancellation remains possible after loss of plan, recipient access, site activity and writer role.
  await db.organisation.update({ where: { id: org.id }, data: { planKey: 'STARTER' } });
  await db.site.update({ where: { id: site.id }, data: { archivedAt: new Date() } });
  await db.membership.update({ where: { id: readerMember.id }, data: { revokedAt: new Date() } });
  await db.membership.update({ where: { id: ownerMember.id }, data: { role: 'VIEWER' } });
  const cancelInput = {
    action: 'CANCEL',
    scheduleId: first.scheduleId,
    expectedRevisionId: latest.id,
    requestKey: crypto.randomUUID(),
  };
  const cancelled = await save(cancelInput);
  assert.equal(cancelled.state, 'CANCELLED');
  assert.equal((await save(cancelInput)).id, cancelled.id);
  assert.equal(await db.reportDeliveryJob.count({ where: { status: 'HELD' } }), 0);
  await assert.rejects(save({ ...cancelInput, expectedRevisionId: cancelled.id, requestKey: crypto.randomUUID() }), {
    code: 'SCHEDULE_CANCELLED',
  });
  await assert.rejects(db.reportDeliveryJob.delete({ where: { id: held.id } }));
  await assert.rejects(db.reportScheduleRevision.delete({ where: { id: first.id } }));
  await assert.rejects(db.$executeRawUnsafe('TRUNCATE TABLE "ReportSchedule" CASCADE'));
  // Reads remain available for managing cancellation after demotion/downgrade.
  assert.equal((await schedules.detail(actor, org.id, site.id, first.scheduleId)).latest.state, 'CANCELLED');
  assert.equal((await schedules.list(actor, org.id, site.id)).items.length, 1);
  await db.organisation.update({ where: { id: org.id }, data: { planKey: 'GROWTH' } });
  await db.site.update({ where: { id: site.id }, data: { archivedAt: null } });
  await db.membership.update({ where: { id: ownerMember.id }, data: { role: 'OWNER' } });
  await db.membership.update({ where: { id: readerMember.id }, data: { revokedAt: null } });
  let pageDraft = await save({ ...input, requestKey: crypto.randomUUID() });
  const pageScheduleId = pageDraft.scheduleId;
  for (let i = 0; i < 26; i++) {
    await schedules.prepareOccurrence(actor, org.id, site.id, pageScheduleId, {
      ...occurrence,
      revisionId: pageDraft.id,
    });
    pageDraft = await save({
      ...input,
      scheduleId: pageScheduleId,
      expectedRevisionId: pageDraft.id,
      requestKey: crypto.randomUUID(),
    });
    if (i < 25) await save({ ...input, requestKey: crypto.randomUUID() });
  }
  const privateDraft = await schedules.save(actorFor(reader.id), org.id, site.id, {
    ...input,
    requestKey: crypto.randomUUID(),
  });
  const page1 = await schedules.list(actor, org.id, site.id);
  const page2 = await schedules.list(actor, org.id, site.id, page1.nextCursor!);
  assert.equal(page1.items.length, 25);
  assert.equal(page2.items.length, 2);
  assert.equal(page2.nextCursor, null);
  assert.equal(new Set([...page1.items, ...page2.items].map((r) => r.id)).size, 27);
  assert.ok(![...page1.items, ...page2.items].some((r) => r.id === privateDraft.scheduleId));
  const revisions1 = await schedules.history(actor, org.id, site.id, pageScheduleId);
  const revisions2 = await schedules.history(actor, org.id, site.id, pageScheduleId, revisions1.nextCursor!);
  assert.deepEqual(
    [...revisions1.items, ...revisions2.items].map((r) => r.revision),
    Array.from({ length: 27 }, (_, i) => 27 - i),
  );
  const jobs1 = await schedules.jobs(actor, org.id, site.id, pageScheduleId);
  const jobs2 = await schedules.jobs(actor, org.id, site.id, pageScheduleId, jobs1.nextCursor!);
  assert.equal(new Set([...jobs1.items, ...jobs2.items].map((r) => r.id)).size, 26);
  assert.equal(jobs2.nextCursor, null);
  assert.ok([...jobs1.items, ...jobs2.items].every((j) => j.status === 'CANCELLED'));
  assert.ok(!JSON.stringify(revisions1).includes('requestHash'));
  assert.ok(!JSON.stringify(page1).includes('requestKey'));
  await assert.rejects(schedules.list(actor, org.id, site.id, privateDraft.scheduleId), { status: 404 });
  await assert.rejects(schedules.list(actor, org.id, otherSite.id, pageScheduleId), { status: 404 });
  await assert.rejects(schedules.history(actor, org.id, site.id, pageScheduleId, first.id), { status: 404 });
  await assert.rejects(schedules.jobs(actor, org.id, site.id, pageScheduleId, job.id), { status: 404 });
  await assert.rejects(schedules.detail(actorFor(reader.id), org.id, site.id, pageScheduleId), { status: 404 });
  await assert.rejects(schedules.history(actorFor(reader.id), org.id, site.id, pageScheduleId), { status: 404 });
  await assert.rejects(schedules.jobs(actorFor(reader.id), org.id, site.id, pageScheduleId), { status: 404 });
  await db.membership.update({ where: { id: ownerMember.id }, data: { revokedAt: new Date() } });
  await assert.rejects(schedules.list(actor, org.id, site.id), { status: 404 });
  await assert.rejects(schedules.detail(actor, org.id, site.id, pageScheduleId), { status: 404 });
  await assert.rejects(schedules.history(actor, org.id, site.id, pageScheduleId), { status: 404 });
  await assert.rejects(schedules.jobs(actor, org.id, site.id, pageScheduleId), { status: 404 });
  console.log(
    '✓ report schedule drafts: concurrent idempotency, revision races, UTC occurrences, stale-job cancellation, tenant/recipient checks, audit rollback, database guards, private paginated reads and scoped cursors',
  );
} finally {
  await cleanup();
}
