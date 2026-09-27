import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { actorFor } from '../src/server/foundation';
import { AnalyticsReportService, reportFingerprint } from '../src/server/analytics-reports';
import { ReportArchiveService } from '../src/server/report-archives';
import { ReportDeliveryEligibilityService } from '../src/server/report-delivery-eligibility';
const { db, cleanup } = await testDatabase();
try {
  const org = await db.organisation.create({
    data: { name: 'Delivery', slug: crypto.randomUUID(), planKey: 'GROWTH' },
  });
  const otherOrg = await db.organisation.create({
    data: { name: 'Other', slug: crypto.randomUUID(), planKey: 'GROWTH' },
  });
  const owner = await db.user.create({ data: { email: 'owner@example.test', emailVerified: new Date() } });
  const viewer = await db.user.create({ data: { email: 'viewer@example.test', emailVerified: new Date() } });
  const manager = await db.user.create({ data: { email: 'manager@example.test', emailVerified: new Date() } });
  const ownerMember = await db.membership.create({ data: { organisationId: org.id, userId: owner.id, role: 'OWNER' } });
  const viewerMember = await db.membership.create({
    data: { organisationId: org.id, userId: viewer.id, role: 'VIEWER' },
  });
  const managerMember = await db.membership.create({
    data: { organisationId: org.id, userId: manager.id, role: 'SITE_MANAGER' },
  });
  const foreign = await db.membership.create({
    data: { organisationId: otherOrg.id, userId: viewer.id, role: 'OWNER' },
  });
  const site = await db.site.create({ data: { organisationId: org.id, code: 'A', name: 'Site' } });
  const otherSite = await db.site.create({ data: { organisationId: org.id, code: 'B', name: 'Other site' } });
  const actor = actorFor(owner.id);
  const mail = {
    async send() {
      throw new Error('Preflight must not send mail');
    },
  };
  const reports = new AnalyticsReportService(db, mail, 'http://localhost');
  const archives = new ReportArchiveService(db, mail, 'http://localhost');
  const eligibility = new ReportDeliveryEligibilityService(db, mail, 'http://localhost');
  const definition = { family: 'energy', year: 2020 };
  const report = await reports.report(actor, org.id, site.id, definition);
  const fingerprint = reportFingerprint(report);
  const archive = await archives.capture(actor, org.id, site.id, {
    definition,
    fingerprint,
    requestKey: crypto.randomUUID(),
  });
  const input = { archiveId: archive.id, fingerprint, recipientMembershipIds: [viewerMember.id] };
  const check = (value: unknown = input) => eligibility.check(actor, org.id, site.id, value);
  const auditCount = await db.auditEvent.count();
  assert.equal((await check()).eligibility, 'ELIGIBLE_NOW');
  assert.equal((await check()).delivery, 'DISABLED');
  assert.ok(!JSON.stringify(await check()).includes(viewer.email));
  await assert.rejects(check({ ...input, email: viewer.email }));
  await assert.rejects(check({ ...input, recipientMembershipIds: [] }));
  await assert.rejects(check({ ...input, recipientMembershipIds: Array(101).fill(viewerMember.id) }));
  await assert.rejects(check({ ...input, recipientMembershipIds: [viewerMember.id, viewerMember.id] }));
  await assert.rejects(check({ ...input, fingerprint: '0'.repeat(64) }), { code: 'REPORT_CHANGED' });
  await assert.rejects(check({ ...input, recipientMembershipIds: [viewerMember.id, foreign.id] }), {
    code: 'REPORT_RECIPIENT_ACCESS',
  });
  await assert.rejects(eligibility.check(actor, org.id, otherSite.id, input), { status: 404 });
  await assert.rejects(eligibility.check(actorFor(viewer.id), otherOrg.id, otherSite.id, input), { status: 404 });
  await assert.rejects(eligibility.check(actorFor(viewer.id), org.id, site.id, input), { status: 403 });
  const managerInput = { ...input, recipientMembershipIds: [managerMember.id] };
  await assert.rejects(check(managerInput), { code: 'REPORT_RECIPIENT_ACCESS' });
  await db.siteAssignment.create({ data: { organisationId: org.id, membershipId: managerMember.id, siteId: site.id } });
  assert.equal((await check(managerInput)).eligibility, 'ELIGIBLE_NOW');
  await db.siteAssignment.deleteMany({ where: { membershipId: managerMember.id } });
  await assert.rejects(check(managerInput), { code: 'REPORT_RECIPIENT_ACCESS' });
  await db.membership.update({ where: { id: viewerMember.id }, data: { revokedAt: new Date() } });
  await assert.rejects(check(), { code: 'REPORT_RECIPIENT_ACCESS' });
  await db.membership.update({ where: { id: viewerMember.id }, data: { revokedAt: null } });
  await db.user.update({ where: { id: viewer.id }, data: { emailVerified: null } });
  await assert.rejects(check(), { code: 'REPORT_RECIPIENT_ACCESS' });
  // Preserve password-only authentication support; this is not email-deliverability approval.
  await db.passwordCredential.create({
    data: { userId: viewer.id, passwordHash: 'test-placeholder-never-used-for-login' },
  });
  assert.equal((await check()).eligibility, 'ELIGIBLE_NOW');
  await db.membership.update({ where: { id: ownerMember.id }, data: { role: 'VIEWER' } });
  await assert.rejects(check(), { status: 403 });
  await db.membership.update({ where: { id: ownerMember.id }, data: { role: 'OWNER', revokedAt: new Date() } });
  await assert.rejects(check(), { status: 404 });
  await db.membership.update({ where: { id: ownerMember.id }, data: { revokedAt: null } });
  await db.organisation.update({ where: { id: org.id }, data: { planKey: 'STARTER' } });
  await assert.rejects(check(), { code: 'REPORT_PLAN' });
  // Historical reports remain readable after a plan downgrade.
  assert.deepEqual(await archives.read(actor, org.id, site.id, archive.id), report);
  await db.organisation.update({ where: { id: org.id }, data: { planKey: 'GROWTH' } });
  await db.site.update({ where: { id: site.id }, data: { archivedAt: new Date() } });
  await assert.rejects(check(), { status: 404 });
  assert.equal(await db.auditEvent.count(), auditCount + 1); // Only the explicit archive download audited.
  console.log(
    '✓ report delivery eligibility: plan, owner, tenant/site, pinned archive, recipient revocation/assignment, password login, no mail or preflight writes',
  );
} finally {
  await cleanup();
}
