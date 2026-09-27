import { hashPassword } from '../../src/server/password';
import { actorFor } from '../../src/server/foundation';
import { AnalyticsReportService, reportFingerprint } from '../../src/server/analytics-reports';
import { ReportArchiveService } from '../../src/server/report-archives';
import { ReportScheduleService } from '../../src/server/report-schedules';
import { ReportDeliveryWorker } from '../../src/server/report-delivery-worker';
import type { PrismaClient } from '@prisma/client';
export async function seedReportSchedules(db: PrismaClient) {
  const [database] = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!database.name.startsWith('energiepad_test_')) throw Error('Report fixtures require a disposable test database');
  const email = `schedules-${crypto.randomUUID()}@example.test`;
  const password = 'ManualReport-Test123!';
  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { email, emailVerified: new Date() } });
  const sessionToken = crypto.randomUUID() + crypto.randomUUID();
  await db.session.create({ data: { userId: user.id, sessionToken, expires: new Date(Date.now() + 86400000) } });
  await db.passwordCredential.create({ data: { userId: user.id, passwordHash } });
  const org = await db.organisation.create({
    data: { name: 'Report schedules HTTP test', slug: crypto.randomUUID(), planKey: 'GROWTH' },
  });
  const member = await db.membership.create({ data: { organisationId: org.id, userId: user.id, role: 'OWNER' } });
  const viewerEmail = `report-viewer-${crypto.randomUUID()}@example.test`;
  const viewer = await db.user.create({ data: { email: viewerEmail, emailVerified: new Date() } });
  await db.passwordCredential.create({ data: { userId: viewer.id, passwordHash } });
  const viewerMembership = await db.membership.create({
    data: { organisationId: org.id, userId: viewer.id, role: 'VIEWER' },
  });
  const site = await db.site.create({ data: { organisationId: org.id, code: 'REPORT', name: 'Report site' } });
  const actor = actorFor(user.id),
    mail = {
      async send() {
        throw new Error('Fixture cannot send reports');
      },
    },
    url = 'http://localhost:3101';
  const reports = new AnalyticsReportService(db, mail, url);
  const definition = { family: 'energy', year: 2020 };
  const fingerprint = reportFingerprint(await reports.report(actor, org.id, site.id, definition));
  const archive = await new ReportArchiveService(db, mail, url).capture(actor, org.id, site.id, {
    definition,
    fingerprint,
    requestKey: crypto.randomUUID(),
  });
  const schedules = new ReportScheduleService(db, mail, url);
  const draft = await schedules.save(actor, org.id, site.id, {
    action: 'DRAFT',
    archiveId: archive.id,
    fingerprint,
    recipientMembershipIds: [member.id],
    timezone: 'UTC',
    requestKey: crypto.randomUUID(),
  });
  let now = new Date(Date.now() - 3600000);
  const job = await schedules.prepareOccurrence(actor, org.id, site.id, draft.scheduleId, {
    revisionId: draft.id,
    occurrenceAt: new Date(now.getTime() - 1000).toISOString(),
  });
  const worker = new ReportDeliveryWorker(db, mail, url, () => now);
  await worker.run(actor, org.id, site.id, job.id, crypto.randomUUID());
  const blocked = await worker.claim(actor, org.id, site.id, job.id, crypto.randomUUID());
  if (!blocked.claimed) throw Error('Expected fixture claim');
  await db.organisation.update({ where: { id: org.id }, data: { planKey: 'STARTER' } });
  await worker.complete(actor, org.id, site.id, job.id, blocked.check.token);
  await db.organisation.update({ where: { id: org.id }, data: { planKey: 'GROWTH' } });
  const interrupted = await worker.claim(actor, org.id, site.id, job.id, crypto.randomUUID());
  if (!interrupted.claimed) throw Error('Expected fixture claim');
  now = new Date(now.getTime() + 120001);
  await worker.complete(actor, org.id, site.id, job.id, interrupted.check.token);
  for (let i = 0; i < 24; i++) await worker.run(actor, org.id, site.id, job.id, crypto.randomUUID());
  await worker.claim(actor, org.id, site.id, job.id, crypto.randomUUID());
  await db.auditEvent.createMany({
    data: Array.from({ length: 105 }, () => ({
      organisationId: org.id,
      actorUserId: user.id,
      action: 'test.audit_history',
      targetId: site.id,
      correlationId: crypto.randomUUID(),
      metadata: {},
      createdAt: new Date('2020-01-01T00:00:00Z'),
    })),
  });
  await db.importBatch.createMany({
    data: [
      {
        organisationId: org.id,
        createdBy: user.id,
        fingerprint: crypto.randomUUID(),
        sheets: [],
        status: 'READY',
        createdAt: new Date('2020-01-01T00:00:00Z'),
      },
      {
        organisationId: org.id,
        createdBy: user.id,
        fingerprint: crypto.randomUUID(),
        sheets: [],
        status: 'INVALID',
        createdAt: new Date('2020-02-01T00:00:00Z'),
      },
      {
        organisationId: org.id,
        createdBy: user.id,
        fingerprint: crypto.randomUUID(),
        sheets: [],
        status: 'READY',
        createdAt: new Date('2020-01-01T00:00:00Z'),
        committedAt: new Date('2020-01-02T00:00:00Z'),
      },
    ],
  });
  await db.importBatch.createMany({
    data: Array.from({ length: 50 }, () => ({
      organisationId: org.id,
      createdBy: user.id,
      fingerprint: crypto.randomUUID(),
      sheets: [],
      status: 'COMMITTED',
      createdAt: new Date('2019-01-01T00:00:00Z'),
    })),
  });
  return {
    sessionToken,
    email,
    password,
    viewerEmail,
    viewerMembershipId: viewerMembership.id,
    archiveId: archive.id,
    organisationId: org.id,
    siteId: site.id,
    membershipId: member.id,
    checkScheduleId: draft.scheduleId,
    checkJobId: job.id,
  };
}
