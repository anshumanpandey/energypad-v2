import { BillingService } from '../src/server/billing';
import assert from 'node:assert/strict';
import { testDatabase } from './test-database';
import { actorFor, FoundationService, hashToken } from '../src/server/foundation';
import { DomainError } from '../src/domain/policy';

const { db, cleanup } = await testDatabase();
const mail: { to: string; text: string }[] = [];
const service = new FoundationService(
  db,
  {
    async send(message) {
      mail.push(message);
    },
  },
  'http://localhost:3100',
);
let count = 0;
async function check(name: string, work: () => Promise<void>) {
  await work();
  console.log(`✓ ${name}`);
  count++;
}
async function denied(work: Promise<unknown>, code?: string) {
  await assert.rejects(work, (error: unknown) => error instanceof DomainError && (!code || error.code === code));
}
const input = (name: string) => ({ name, currency: 'GBP', timezone: 'Europe/London' });
async function user(email: string, verified = true) {
  return actorFor((await db.user.create({ data: { email, emailVerified: verified ? new Date() : null } })).id);
}
function token() {
  const match = mail.at(-1)?.text.match(/\/invite\/([a-f0-9]{64})/);
  assert.ok(match);
  return match[1];
}
try {
  const owner = await user('owner@example.test'),
    stranger = await user('stranger@example.test');
  const admin = await user('admin@example.test'),
    manager = await user('manager@example.test');
  const analyst = await user('analyst@example.test'),
    viewer = await user('viewer@example.test');
  const org = await service.createOrganisation(owner, input('Northstar'));
  const other = await service.createOrganisation(stranger, input('Other organisation'));
  const ownerMember = await db.membership.findUniqueOrThrow({
    where: { organisationId_userId: { organisationId: org.id, userId: owner.userId } },
  });
  for (const [actor, role] of [
    [admin, 'ADMIN'],
    [manager, 'SITE_MANAGER'],
    [analyst, 'ANALYST'],
    [viewer, 'VIEWER'],
  ] as const)
    await db.membership.create({ data: { userId: actor.userId, organisationId: org.id, role } });
  const siteA = await db.site.create({ data: { organisationId: org.id, code: 'A', name: 'Assigned site' } });
  const siteB = await db.site.create({ data: { organisationId: org.id, code: 'B', name: 'Unassigned site' } });
  await check('owner-only billing overview, active capacity, plan changes and revoked access', async () => {
    const billing = new BillingService(db, { async send() {} }, 'http://localhost:3100');
    const initial = await billing.overview(owner, org.id);
    assert.equal(initial.subscription.status, 'NOT_CONNECTED');
    assert.deepEqual(initial.sites, { active: 2, limit: 5, remaining: 3, overLimit: false });
    assert.equal(initial.features.find((feature) => feature.key === 'ai')!.included, false);
    for (const actor of [admin, manager, analyst, viewer]) await denied(billing.overview(actor, org.id), 'FORBIDDEN');
    await denied(billing.overview(stranger, org.id), 'NOT_FOUND');
    await denied(billing.overview(owner, other.id), 'NOT_FOUND');
    await db.site.update({ where: { id: siteB.id }, data: { archivedAt: new Date() } });
    assert.equal((await billing.overview(owner, org.id)).sites.active, 1);
    await db.site.update({ where: { id: siteB.id }, data: { archivedAt: null } });
    await db.plan.update({ where: { key: 'STARTER' }, data: { siteLimit: 1 } });
    assert.deepEqual((await billing.overview(owner, org.id)).sites, {
      active: 2,
      limit: 1,
      remaining: 0,
      overLimit: true,
    });
    await db.plan.update({ where: { key: 'STARTER' }, data: { siteLimit: 5 } });
    await db.organisation.update({ where: { id: org.id }, data: { planKey: 'ENTERPRISE' } });
    const enterprise = await billing.overview(owner, org.id);
    assert.deepEqual(enterprise.sites, { active: 2, limit: null, remaining: null, overLimit: false });
    assert.equal(enterprise.features.find((feature) => feature.key === 'ai')!.included, true);
    await db.organisation.update({ where: { id: org.id }, data: { planKey: 'STARTER' } });
    await db.membership.update({ where: { id: ownerMember.id }, data: { revokedAt: new Date() } });
    await denied(billing.overview(owner, org.id), 'NOT_FOUND');
    await db.membership.update({ where: { id: ownerMember.id }, data: { revokedAt: null } });
  });

  const foreignSite = await db.site.create({
    data: { organisationId: other.id, code: 'X', name: 'Other tenant site' },
  });
  const managerMember = await db.membership.findUniqueOrThrow({
    where: { organisationId_userId: { organisationId: org.id, userId: manager.userId } },
  });
  await check('verified identity required; owner onboarding is atomic', async () => {
    const unverified = await user('unverified@example.test', false);
    await denied(service.createOrganisation(unverified, input('Denied')), 'UNAUTHENTICATED');
    assert.equal(ownerMember.role, 'OWNER');
    assert.equal(org.planKey, 'STARTER');
    assert.equal((await service.listAudit(owner, org.id)).filter((e) => e.action === 'organisation.created').length, 1);
  });
  await check('every tenant read and mutation rejects foreign membership', async () => {
    await Promise.all(
      [
        service.getWorkspace(stranger, org.id),
        service.listSites(stranger, org.id),
        service.listMembers(stranger, org.id),
        service.listAudit(stranger, org.id),
        service.listInvitations(stranger, org.id),
        service.updateOrganisation(stranger, org.id, input('Hijack')),
        service.invite(stranger, org.id, { email: 'x@example.test', role: 'OWNER' }),
        service.changeMember(stranger, org.id, ownerMember.id, { role: 'VIEWER' }),
      ].map((work) => denied(work, 'NOT_FOUND')),
    );
    await denied(service.getSite(owner, org.id, foreignSite.id), 'NOT_FOUND');
    assert.deepEqual(
      (await service.listOrganisations(owner)).map((m) => m.organisation.id),
      [org.id],
    );
  });
  await check('site managers see only assigned sites; analyst/viewer read but cannot administer', async () => {
    assert.equal((await service.listSites(manager, org.id)).length, 0);
    await service.assignSites(owner, org.id, managerMember.id, { siteIds: [siteA.id] });
    assert.deepEqual(
      (await service.listSites(manager, org.id)).map((s) => s.id),
      [siteA.id],
    );
    await denied(service.getSite(manager, org.id, siteB.id), 'NOT_FOUND');
    for (const actor of [analyst, viewer]) {
      assert.equal((await service.listSites(actor, org.id)).length, 2);
      await denied(service.listMembers(actor, org.id), 'FORBIDDEN');
      await denied(service.updateOrganisation(actor, org.id, input('Denied')), 'FORBIDDEN');
    }
    await denied(service.assignSites(owner, org.id, managerMember.id, { siteIds: [foreignSite.id] }), 'NOT_FOUND');
    await assert.rejects(
      db.siteAssignment.create({
        data: { organisationId: org.id, membershipId: managerMember.id, siteId: foreignSite.id },
      }),
    );
  });
  await check('admins cannot grant, modify or remove owners', async () => {
    await denied(service.changeMember(admin, org.id, ownerMember.id, { role: 'VIEWER' }), 'FORBIDDEN');
    await denied(service.changeMember(admin, org.id, managerMember.id, { role: 'OWNER' }), 'FORBIDDEN');
    await denied(service.changeMember(admin, org.id, ownerMember.id, {}, true), 'FORBIDDEN');
    await denied(service.invite(admin, org.id, { email: 'bad@example.test', role: 'OWNER' }), 'FORBIDDEN');
  });
  await check('invitations are hashed, email-bound, single use and tenant scoped', async () => {
    const invited = await user('invitee@example.test');
    const invitation = await service.invite(owner, org.id, {
      email: ' INVITEE@example.test ',
      role: 'SITE_MANAGER',
      siteIds: [siteA.id],
    });
    const raw = token();
    const stored = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    assert.equal(stored.tokenHash, hashToken(raw));
    assert.ok(!JSON.stringify(invitation).includes(raw));
    await denied(service.acceptInvitation(stranger, { token: raw }), 'INVALID_INVITATION');
    await denied(service.revokeInvitation(stranger, other.id, invitation.id), 'NOT_FOUND');
    const results = await Promise.allSettled([
      service.acceptInvitation(invited, { token: raw }),
      service.acceptInvitation(invited, { token: raw }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.deepEqual(
      (await service.listSites(invited, org.id)).map((s) => s.id),
      [siteA.id],
    );
    await denied(service.acceptInvitation(invited, { token: raw }));
    assert.ok(!JSON.stringify(await service.listAudit(owner, org.id)).includes(raw));
  });
  await check('revoked, expired and demoted-issuer invitations cannot grant access', async () => {
    const invited = await user('pending@example.test');
    const revoked = await service.invite(owner, org.id, { email: 'pending@example.test', role: 'VIEWER' });
    const rawRevoked = token();
    await service.revokeInvitation(owner, org.id, revoked.id);
    await denied(service.acceptInvitation(invited, { token: rawRevoked }));
    const expired = await service.invite(owner, org.id, { email: 'pending@example.test', role: 'VIEWER' });
    const rawExpired = token();
    await db.invitation.update({
      where: { id: expired.id },
      data: { createdAt: new Date(Date.now() - 20000), expiresAt: new Date(Date.now() - 10000) },
    });
    await denied(service.acceptInvitation(invited, { token: rawExpired }));
    await service.invite(admin, org.id, { email: 'pending@example.test', role: 'ADMIN' });
    const rawAdmin = token();
    const adminMember = await db.membership.findUniqueOrThrow({
      where: { organisationId_userId: { organisationId: org.id, userId: admin.userId } },
    });
    await service.changeMember(owner, org.id, adminMember.id, { role: 'VIEWER' });
    await denied(service.acceptInvitation(invited, { token: rawAdmin }), 'INVALID_INVITATION');
    await denied(service.listAudit(admin, org.id), 'FORBIDDEN');
  });
  await check(
    'failed mail revokes invitation; role transitions and revocation clear site grants immediately',
    async () => {
      const failing = new FoundationService(
        db,
        {
          async send() {
            throw new Error('provider unavailable');
          },
        },
        'http://localhost:3100',
      );
      await denied(
        failing.invite(owner, org.id, { email: 'failure@example.test', role: 'VIEWER' }),
        'MAIL_UNAVAILABLE',
      );
      assert.ok((await db.invitation.findFirstOrThrow({ where: { email: 'failure@example.test' } })).revokedAt);
      await service.changeMember(owner, org.id, managerMember.id, { role: 'ANALYST' });
      await service.changeMember(owner, org.id, managerMember.id, { role: 'SITE_MANAGER' });
      assert.equal((await service.listSites(manager, org.id)).length, 0);
      await service.changeMember(owner, org.id, managerMember.id, {}, true);
      await denied(service.getWorkspace(manager, org.id), 'NOT_FOUND');
    },
  );
  await check('last-owner protection survives concurrent self-demotions', async () => {
    const second = await user('owner2@example.test');
    const member = await db.membership.create({
      data: { organisationId: org.id, userId: second.userId, role: 'OWNER' },
    });
    const results = await Promise.allSettled([
      service.changeMember(owner, org.id, ownerMember.id, { role: 'VIEWER' }),
      service.changeMember(second, org.id, member.id, { role: 'VIEWER' }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(await db.membership.count({ where: { organisationId: org.id, role: 'OWNER', revokedAt: null } }), 1);
  });
  await check('audit update, delete and truncate are rejected by PostgreSQL', async () => {
    const audit = await db.auditEvent.findFirstOrThrow({ where: { organisationId: org.id } });
    await assert.rejects(db.auditEvent.update({ where: { id: audit.id }, data: { action: 'tampered' } }));
    await assert.rejects(db.auditEvent.delete({ where: { id: audit.id } }));
    await assert.rejects(db.$executeRawUnsafe('TRUNCATE "AuditEvent"'));
  });
  await check('platform administrators do not bypass organisation membership', async () => {
    await db.user.update({ where: { id: stranger.userId }, data: { platformRole: 'PLATFORM_ADMIN' } });
    await denied(service.getWorkspace(stranger, org.id), 'NOT_FOUND');
  });
  console.log(`\n${count} PostgreSQL integration scenarios passed.`);
} finally {
  await cleanup();
}
