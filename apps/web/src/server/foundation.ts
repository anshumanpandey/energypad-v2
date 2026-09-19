import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  DomainError,
  can,
  canManageRole,
  organisationInput,
  invitationInput,
  memberInput,
  assignmentInput,
  tokenInput,
  uuid,
  type Permission,
} from '../domain/policy';

type Tx = Prisma.TransactionClient;
export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}
export type Actor = { userId: string; correlationId: string };
const notFound = () => new DomainError('NOT_FOUND', 'This resource is not available.', 404);
const forbidden = () => new DomainError('FORBIDDEN', 'Your role does not allow this action.', 403);
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class FoundationService {
  constructor(
    protected db: PrismaClient,
    private mail: Mailer,
    private appUrl: string,
  ) {}

  private async verifiedUser(actor: Actor, tx: Tx = this.db) {
    const user = await tx.user.findFirst({ where: { id: uuid.parse(actor.userId), emailVerified: { not: null } } });
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Sign in with a verified email to continue.', 401);
    return user;
  }

  protected async membership(actor: Actor, organisationId: string, permission?: Permission, tx: Tx = this.db) {
    const member = await tx.membership.findFirst({
      where: {
        organisationId: uuid.parse(organisationId),
        userId: uuid.parse(actor.userId),
        revokedAt: null,
        user: { emailVerified: { not: null } },
      },
    });
    if (!member) throw notFound();
    if (permission && !can(member.role, permission)) throw forbidden();
    return member;
  }

  protected async lock(tx: Tx, organisationId: string) {
    uuid.parse(organisationId);
    await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id = ${organisationId}::uuid FOR UPDATE`;
  }

  protected async audit(
    tx: Tx,
    actor: Actor,
    organisationId: string,
    action: string,
    targetId: string,
    metadata: Prisma.InputJsonObject = {},
  ) {
    await tx.auditEvent.create({
      data: {
        organisationId,
        actorUserId: actor.userId,
        action,
        targetId,
        correlationId: actor.correlationId,
        metadata,
      },
    });
  }

  async listOrganisations(actor: Actor) {
    await this.verifiedUser(actor);
    return this.db.membership.findMany({
      where: { userId: actor.userId, revokedAt: null },
      select: { role: true, organisation: { select: { id: true, name: true, planKey: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createOrganisation(actor: Actor, input: unknown) {
    const data = organisationInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.verifiedUser(actor, tx);
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.userId}::uuid FOR UPDATE`;
      const count = await tx.membership.count({ where: { userId: actor.userId, role: 'OWNER', revokedAt: null } });
      if (count >= 10) throw new DomainError('LIMIT_REACHED', 'Contact support to create more organisations.', 409);
      const slug =
        data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 50) || 'organisation';
      const org = await tx.organisation.create({
        data: {
          ...data,
          slug: `${slug}-${randomBytes(4).toString('hex')}`,
          memberships: { create: { userId: actor.userId, role: 'OWNER' } },
        },
      });
      await this.audit(tx, actor, org.id, 'organisation.created', org.id, { name: org.name, plan: org.planKey });
      return org;
    });
  }

  async getWorkspace(actor: Actor, organisationId: string) {
    const membership = await this.membership(actor, organisationId);
    const organisation = await this.db.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      include: { plan: true },
    });
    const sites = await this.listSites(actor, organisationId);
    return { organisation, membership, sites };
  }

  async updateOrganisation(actor: Actor, organisationId: string, input: unknown) {
    const data = organisationInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, organisationId);
      await this.membership(actor, organisationId, 'organisation:update', tx);
      const org = await tx.organisation.update({ where: { id: organisationId }, data });
      await this.audit(tx, actor, organisationId, 'organisation.updated', org.id, { fields: Object.keys(data) });
      return org;
    });
  }

  async listSites(actor: Actor, organisationId: string) {
    const member = await this.membership(actor, organisationId);
    return this.db.site.findMany({
      where: {
        organisationId,
        archivedAt: null,
        ...(member.role === 'SITE_MANAGER'
          ? { assignments: { some: { membershipId: member.id, organisationId } } }
          : {}),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSite(actor: Actor, organisationId: string, siteId: string) {
    uuid.parse(siteId);
    const sites = await this.listSites(actor, organisationId);
    const site = sites.find((s) => s.id === siteId);
    if (!site) throw notFound();
    return site;
  }

  async listMembers(actor: Actor, organisationId: string) {
    await this.membership(actor, organisationId, 'members:manage');
    return this.db.membership.findMany({
      where: { organisationId, revokedAt: null },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        siteAssignments: { select: { siteId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listInvitations(actor: Actor, organisationId: string) {
    await this.membership(actor, organisationId, 'members:manage');
    return this.db.invitation.findMany({
      where: { organisationId, revokedAt: null, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invite(actor: Actor, organisationId: string, input: unknown) {
    const data = invitationInput.parse(input);
    const token = randomBytes(32).toString('hex');
    const invite = await this.db.$transaction(async (tx) => {
      await this.lock(tx, organisationId);
      const member = await this.membership(actor, organisationId, 'members:manage', tx);
      if (!canManageRole(member.role, data.role)) throw forbidden();
      const recent = await tx.invitation.count({
        where: { organisationId, invitedBy: actor.userId, createdAt: { gt: new Date(Date.now() - 3600_000) } },
      });
      if (recent >= 20) throw new DomainError('RATE_LIMIT', 'Please wait before sending more invitations.', 429);
      const existing = await tx.membership.findFirst({
        where: { organisationId, revokedAt: null, user: { email: data.email } },
      });
      if (existing) throw new DomainError('ALREADY_MEMBER', 'This person is already a member.', 409);
      const siteIds = [...new Set(data.siteIds)];
      if (
        (await tx.site.count({ where: { id: { in: siteIds }, organisationId, archivedAt: null } })) !== siteIds.length
      )
        throw notFound();
      await tx.invitation.updateMany({
        where: { organisationId, email: data.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const created = await tx.invitation.create({
        data: {
          organisationId,
          email: data.email,
          role: data.role,
          tokenHash: hashToken(token),
          invitedBy: actor.userId,
          expiresAt: new Date(Date.now() + 7 * 86400_000),
        },
        include: { organisation: { select: { name: true } } },
      });
      if (siteIds.length)
        await tx.invitationSite.createMany({
          data: siteIds.map((siteId) => ({ invitationId: created.id, siteId, organisationId })),
        });
      await this.audit(tx, actor, organisationId, 'invitation.created', created.id, {
        role: data.role,
        siteCount: siteIds.length,
      });
      return created;
    });
    try {
      await this.mail.send({
        to: invite.email,
        subject: `Join ${invite.organisation.name} on EnergiePad`,
        text: `You have been invited to ${invite.organisation.name}. Sign in with this email address, then accept your invitation:\n\n${this.appUrl}/invite/${token}\n\nThis invitation expires in 7 days. If you did not expect it, you can ignore this message.`,
      });
    } catch {
      await this.db.$transaction(async (tx) => {
        await this.lock(tx, organisationId);
        await tx.invitation.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
        await this.audit(tx, actor, organisationId, 'invitation.delivery_failed', invite.id);
      });
      throw new DomainError('MAIL_UNAVAILABLE', 'The invitation could not be delivered. Please try again.', 503);
    }
    return { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
  }

  async revokeInvitation(actor: Actor, organisationId: string, invitationId: string) {
    uuid.parse(invitationId);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, organisationId);
      const member = await this.membership(actor, organisationId, 'members:manage', tx);
      const invite = await tx.invitation.findFirst({
        where: { id: invitationId, organisationId, revokedAt: null, acceptedAt: null },
      });
      if (!invite) throw notFound();
      if (!canManageRole(member.role, invite.role)) throw forbidden();
      await tx.invitation.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
      await this.audit(tx, actor, organisationId, 'invitation.revoked', invite.id);
      return { success: true };
    });
  }

  async getInvitation(actor: Actor, input: unknown) {
    const { token } = tokenInput.parse(input);
    const user = await this.verifiedUser(actor);
    const invite = await this.db.invitation.findFirst({
      where: {
        tokenHash: hashToken(token),
        email: user.email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { organisationId: true, role: true, organisation: { select: { name: true } } },
    });
    if (!invite)
      throw new DomainError(
        'INVALID_INVITATION',
        'This invitation is unavailable. Sign in with the invited email or ask for a new invitation.',
        404,
      );
    return invite;
  }

  async acceptInvitation(actor: Actor, input: unknown) {
    const { token } = tokenInput.parse(input);
    const candidate = await this.getInvitation(actor, { token });
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, candidate.organisationId);
      const user = await this.verifiedUser(actor, tx);
      const invite = await tx.invitation.findFirst({
        where: {
          tokenHash: hashToken(token),
          email: user.email,
          revokedAt: null,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { sites: true },
      });
      if (!invite) throw notFound();
      // A revoked/demoted issuer must not leave behind grants they can no longer issue.
      const issuer = await tx.membership.findFirst({
        where: { userId: invite.invitedBy, organisationId: invite.organisationId, revokedAt: null },
      });
      if (!issuer || !canManageRole(issuer.role, invite.role))
        throw new DomainError('INVALID_INVITATION', 'Ask an organisation admin for a new invitation.', 409);
      const existing = await tx.membership.findUnique({
        where: { organisationId_userId: { organisationId: invite.organisationId, userId: actor.userId } },
      });
      if (existing && !existing.revokedAt)
        throw new DomainError('ALREADY_MEMBER', 'You already belong to this organisation.', 409);
      const member = await tx.membership.upsert({
        where: { organisationId_userId: { organisationId: invite.organisationId, userId: actor.userId } },
        create: { organisationId: invite.organisationId, userId: actor.userId, role: invite.role },
        update: { revokedAt: null, role: invite.role },
      });
      await tx.siteAssignment.deleteMany({ where: { membershipId: member.id, organisationId: invite.organisationId } });
      if (invite.sites.length)
        await tx.siteAssignment.createMany({
          data: invite.sites.map((s) => ({
            organisationId: invite.organisationId,
            membershipId: member.id,
            siteId: s.siteId,
          })),
        });
      await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      await this.audit(tx, actor, invite.organisationId, 'invitation.accepted', member.id, { role: member.role });
      return { organisationId: invite.organisationId };
    });
  }

  async changeMember(actor: Actor, organisationId: string, membershipId: string, input: unknown, revoke = false) {
    uuid.parse(membershipId);
    const data = revoke ? null : memberInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, organisationId);
      const actorMember = await this.membership(actor, organisationId, 'members:manage', tx);
      const target = await tx.membership.findFirst({ where: { id: membershipId, organisationId, revokedAt: null } });
      if (!target) throw notFound();
      if (!canManageRole(actorMember.role, target.role) || (data && !canManageRole(actorMember.role, data.role)))
        throw forbidden();
      if (target.role === 'OWNER' && (revoke || data?.role !== 'OWNER')) {
        const owners = await tx.membership.count({ where: { organisationId, role: 'OWNER', revokedAt: null } });
        if (owners <= 1) throw new DomainError('LAST_OWNER', 'An organisation must keep at least one owner.', 409);
      }
      await tx.membership.update({
        where: { id: target.id },
        data: revoke ? { revokedAt: new Date() } : { role: data!.role },
      });
      // Clear stale grants on role transitions, especially when demoting to Site Manager.
      if (revoke || data?.role !== target.role)
        await tx.siteAssignment.deleteMany({ where: { membershipId: target.id, organisationId } });
      await this.audit(
        tx,
        actor,
        organisationId,
        revoke ? 'membership.revoked' : 'membership.role_changed',
        target.id,
        { previousRole: target.role, ...(data ? { role: data.role } : {}) },
      );
      return { success: true };
    });
  }

  async assignSites(actor: Actor, organisationId: string, membershipId: string, input: unknown) {
    uuid.parse(membershipId);
    const { siteIds: values } = assignmentInput.parse(input);
    const siteIds = [...new Set(values)];
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, organisationId);
      await this.membership(actor, organisationId, 'members:manage', tx);
      const target = await tx.membership.findFirst({
        where: { id: membershipId, organisationId, revokedAt: null, role: 'SITE_MANAGER' },
      });
      if (!target) throw notFound();
      if (
        (await tx.site.count({ where: { id: { in: siteIds }, organisationId, archivedAt: null } })) !== siteIds.length
      )
        throw notFound();
      await tx.siteAssignment.deleteMany({ where: { membershipId, organisationId } });
      if (siteIds.length)
        await tx.siteAssignment.createMany({
          data: siteIds.map((siteId) => ({ organisationId, membershipId, siteId })),
        });
      await this.audit(tx, actor, organisationId, 'membership.sites_changed', membershipId, { siteIds });
      return { success: true };
    });
  }

  async listAudit(actor: Actor, organisationId: string) {
    await this.membership(actor, organisationId, 'audit:read');
    return this.db.auditEvent.findMany({
      where: { organisationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }
}

export function actorFor(userId: string): Actor {
  return { userId, correlationId: randomUUID() };
}
