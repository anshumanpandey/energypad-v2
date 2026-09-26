import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { testDatabase } from './test-database';
import { actorFor } from '../src/server/foundation';
import { AnalyticsReportService, reportFingerprint } from '../src/server/analytics-reports';
import { ReportArchiveService } from '../src/server/report-archives';
const { db, cleanup } = await testDatabase();
try {
  const org = await db.organisation.create({ data: { name: 'Archives', slug: crypto.randomUUID() } });
  const user = await db.user.create({ data: { email: 'archive-owner@example.test', emailVerified: new Date() } });
  const actor = actorFor(user.id);
  const member = await db.membership.create({ data: { organisationId: org.id, userId: user.id, role: 'OWNER' } });
  const site = await db.site.create({ data: { organisationId: org.id, code: 'A', name: 'Original name' } });
  const other = await db.site.create({ data: { organisationId: org.id, code: 'B', name: 'Other site' } });
  const mail = { async send() {} };
  const reports = new AnalyticsReportService(db, mail, 'http://localhost');
  const archives = new ReportArchiveService(db, mail, 'http://localhost');
  const definition = { family: 'energy', year: 2020 };
  const original = await reports.report(actor, org.id, site.id, definition);
  const input = { definition, fingerprint: reportFingerprint(original), requestKey: crypto.randomUUID() };
  const pair = await Promise.all([
    archives.capture(actor, org.id, site.id, input),
    archives.capture(actor, org.id, site.id, input),
  ]);
  assert.equal(pair[0].id, pair[1].id);
  assert.equal(await db.auditEvent.count({ where: { action: 'report.archived', targetId: pair[0].id } }), 1);
  await db.site.update({ where: { id: site.id }, data: { name: 'Corrected name' } });
  assert.deepEqual(await archives.read(actor, org.id, site.id, pair[0].id), original);
  assert.equal((await archives.capture(actor, org.id, site.id, input)).id, pair[0].id);
  await assert.rejects(archives.capture(actor, org.id, site.id, { ...input, requestKey: crypto.randomUUID() }), {
    code: 'REPORT_CHANGED',
  });
  await assert.rejects(
    archives.capture(actor, org.id, site.id, { ...input, definition: { family: 'energy', year: 2021 } }),
    { code: 'REQUEST_CONFLICT' },
  );
  await assert.rejects(archives.read(actor, org.id, other.id, pair[0].id), { status: 404 });
  const saved = await db.reportArchive.findUniqueOrThrow({ where: { id: pair[0].id } });
  for (let i = 0; i < 26; i++) {
    const { id: _id, ...copy } = saved;
    void _id;
    await db.reportArchive.create({
      data: {
        ...copy,
        definition: copy.definition as Prisma.InputJsonValue,
        report: copy.report as Prisma.InputJsonValue,
        requestKey: crypto.randomUUID(),
      },
    });
  }
  const firstPage = await archives.history(actor, org.id, site.id);
  const secondPage = await archives.history(actor, org.id, site.id, firstPage.nextCursor!);
  assert.equal(new Set([...firstPage.items, ...secondPage.items].map((r) => r.id)).size, 27);
  await assert.rejects(archives.history(actor, org.id, other.id, firstPage.nextCursor!), { status: 404 });
  await db.membership.update({ where: { id: member.id }, data: { role: 'VIEWER' } });
  await assert.rejects(archives.capture(actor, org.id, site.id, input), { status: 403 });
  assert.deepEqual(await archives.read(actor, org.id, site.id, pair[0].id), original);
  await db.membership.update({ where: { id: member.id }, data: { role: 'SITE_MANAGER' } });
  await assert.rejects(archives.read(actor, org.id, site.id, pair[0].id), { status: 404 });
  await db.membership.update({ where: { id: member.id }, data: { role: 'OWNER' } });
  await db.site.update({ where: { id: site.id }, data: { archivedAt: new Date() } });
  assert.deepEqual(await archives.read(actor, org.id, site.id, pair[0].id), original);
  await db.membership.update({ where: { id: member.id }, data: { revokedAt: new Date() } });
  await assert.rejects(archives.read(actor, org.id, site.id, pair[0].id), { status: 404 });
  await db.membership.update({ where: { id: member.id }, data: { revokedAt: null } });
  const fresh = await reports.report(actor, org.id, site.id, definition);
  await db.$executeRawUnsafe(
    `CREATE FUNCTION fail_archive_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'report.archived' THEN RAISE EXCEPTION 'Test failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER test_archive_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION fail_archive_audit()`,
  );
  try {
    await assert.rejects(
      archives.capture(actor, org.id, site.id, {
        ...input,
        fingerprint: reportFingerprint(fresh),
        requestKey: crypto.randomUUID(),
      }),
    );
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER test_archive_audit ON "AuditEvent"');
    await db.$executeRawUnsafe('DROP FUNCTION fail_archive_audit()');
  }
  assert.equal(await db.reportArchive.count(), 27);
  await assert.rejects(db.reportArchive.update({ where: { id: pair[0].id }, data: { family: 'baseline' } }));
  await assert.rejects(db.reportArchive.delete({ where: { id: pair[0].id } }));
  await assert.rejects(db.$executeRawUnsafe('TRUNCATE TABLE "ReportArchive"'));
  console.log(
    '✓ report archives: exact snapshots, concurrent retry, changed preview, pagination, scoped and revoked access, archived sites, atomic audit and immutability',
  );
} finally {
  await cleanup();
}
