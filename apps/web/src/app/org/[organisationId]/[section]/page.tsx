import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  Building2,
  Check,
  Users,
  ShieldCheck,
  BarChart3,
  FileText,
  Layers3,
  CircleDashed,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { pageActor, accessible } from '@/server/page-auth';
import { foundation } from '@/server/services';
import { can, canManageRole, roleLabels, hasFeature } from '@/domain/policy';
import { InviteForm, MemberActions, OrganisationForm, RevokeInvite } from '@/components/forms';
import { Button } from '@/components/ui/button';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ organisationId: string; section: string }>;
}) {
  const { organisationId, section } = await params;
  const { actor } = await pageActor();
  const {
    organisation: org,
    membership,
    sites,
  } = await accessible(() => foundation.getWorkspace(actor, organisationId));
  const base = `/org/${org.id}`;
  const manage = can(membership.role, 'members:manage');
  if (section === 'overview') {
    const members = manage ? await foundation.listMembers(actor, org.id) : null;
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR ENERGY WORKSPACE</span>
            <h1>A better view starts here.</h1>
            <p>Welcome to {org.name}. Let’s build your energy workspace.</p>
          </div>
          <span className="tag">{org.plan.name} plan</span>
        </div>
        <section className="welcome-banner">
          <div>
            <span className="eyebrow">CONNECTED PEOPLE. SMARTER PLACES.</span>
            <h2>
              Good energy starts
              <br />
              with a great team.
            </h2>
            <p>
              Your workspace is ready. Bring the right people together
              <br className="desktop-only" /> and lay the groundwork for better performance.
            </p>
            {manage ? (
              <Button asChild>
                <Link href={`${base}/members`}>
                  Build your team <ArrowUpRight size={17} />
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={`${base}/sites`}>
                  Explore your sites <ArrowUpRight size={17} />
                </Link>
              </Button>
            )}
          </div>
          <div className="energy-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-building">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <span className="art-node node-one">
              <Building2 size={22} />
            </span>
            <span className="art-node node-two">
              <Users size={22} />
            </span>
            <span className="art-node node-three">
              <ShieldCheck size={23} />
            </span>
            <span className="art-caption">
              <span /> A connected workspace
            </span>
          </div>
        </section>
        <section className="stat-grid" aria-label="Workspace summary">
          <div className="stat-card">
            <span className="stat-icon">
              <Building2 size={20} />
            </span>
            <span>{membership.role === 'SITE_MANAGER' ? 'Assigned sites' : 'Connected sites'}</span>
            <strong>{sites.length.toString().padStart(2, '0')}</strong>
            <small>{sites.length ? 'Available in your workspace' : 'Your site portfolio starts here'}</small>
          </div>
          <div className="stat-card">
            <span className="stat-icon">
              <Users size={20} />
            </span>
            <span>{members ? 'Team members' : 'Your role'}</span>
            <strong className={members ? '' : 'stat-word'}>
              {members ? members.length.toString().padStart(2, '0') : roleLabels[membership.role]}
            </strong>
            <small>{members ? 'People with workspace access' : 'Access follows your organisation role'}</small>
          </div>
          <div className="stat-card">
            <span className="stat-icon">
              <ShieldCheck size={20} />
            </span>
            <span>Workspace plan</span>
            <strong className="stat-word">{org.plan.name}</strong>
            <small>
              {org.plan.siteLimit ? `Up to ${org.plan.siteLimit} sites` : 'Custom site allowance'} · {org.currency}{' '}
              reporting
            </small>
          </div>
        </section>
        <div className="overview-grid">
          <section className="panel setup-panel">
            <div className="section-heading">
              <h2>Make yourself at home</h2>
              <span className="tag subtle">Getting started</span>
            </div>
            <p className="muted">A few small steps toward a connected workspace.</p>
            <div className="setup-row">
              <span className="step-circle complete">
                <Check size={17} />
              </span>
              <div>
                <strong>Workspace created</strong>
                <p>{org.name} is ready to go.</p>
              </div>
              <span className="mini-label">Done</span>
            </div>
            <div className="setup-row">
              <span className={`step-circle ${members && members.length > 1 ? 'complete' : ''}`}>
                {members && members.length > 1 ? <Check size={17} /> : '2'}
              </span>
              <div>
                <strong>Bring your team on board</strong>
                <p>Give each person the right level of access.</p>
              </div>
              {manage && (
                <Link href={`${base}/members`} aria-label="Manage your team">
                  <ArrowRight size={18} />
                </Link>
              )}
            </div>
            <div className="setup-row">
              <span className="step-circle">3</span>
              <div>
                <strong>Connect your first site</strong>
                <p>Site setup will be available in the next release.</p>
              </div>
              <span className="mini-label">Coming next</span>
            </div>
          </section>
          <section className="panel foundation-panel">
            <span className="large-icon">
              <CircleDashed size={25} />
            </span>
            <span className="eyebrow">A SOLID FOUNDATION</span>
            <h2>Ready for what’s next.</h2>
            <p>
              This release brings your organisation, team and access controls together. Sites, energy analysis and
              reporting follow in the next stages.
            </p>
            <Link href={`${base}/sites`} className="text-link">
              Explore your workspace <ArrowUpRight size={15} />
            </Link>
          </section>
        </div>
      </>
    );
  }
  if (section === 'members') {
    const members = await accessible(() => foundation.listMembers(actor, org.id));
    const invitations = await foundation.listInvitations(actor, org.id);
    return (
      <>
        <Heading
          eyebrow="WORK BETTER TOGETHER"
          title="Team members"
          text="Invite your team and give everyone the right access."
        />
        <InviteForm organisationId={org.id} role={membership.role} sites={sites} />
        <section className="panel">
          <div className="section-heading">
            <h2>
              Workspace members <span className="count">{members.length}</span>
            </h2>
            <span className="muted">Roles apply to this organisation</span>
          </div>
          <div className="member-list">
            {members.map((member) => (
              <div className="member-row" key={member.id}>
                <span className="avatar light">
                  {(member.user.name ?? member.user.email).slice(0, 1).toUpperCase()}
                </span>
                <div className="member-identity">
                  <strong>
                    {member.user.name ?? member.user.email}
                    {member.userId === actor.userId && <span className="you-label">You</span>}
                  </strong>
                  <small>
                    {member.user.name
                      ? member.user.email
                      : member.role === 'SITE_MANAGER'
                        ? `${member.siteAssignments.length} assigned sites`
                        : 'Organisation-wide access'}
                  </small>
                </div>
                <span className="role-badge">{roleLabels[member.role]}</span>
                <MemberActions organisationId={org.id} member={member} actorRole={membership.role} sites={sites} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>
              Pending invitations <span className="count">{invitations.length}</span>
            </h2>
          </div>
          {invitations.length ? (
            invitations.map((inv) => (
              <div className="invitation-row" key={inv.id}>
                <div>
                  <strong>{inv.email}</strong>
                  <small>
                    {roleLabels[inv.role]} · Expires {formatDate(inv.expiresAt, org.timezone)}
                  </small>
                </div>
                {canManageRole(membership.role, inv.role) && <RevokeInvite organisationId={org.id} id={inv.id} />}
              </div>
            ))
          ) : (
            <p className="empty-inline">No pending invitations. Invite a colleague to get started.</p>
          )}
        </section>
        <p className="page-note">
          <ShieldCheck size={16} /> Owners manage all access. Admins manage members below Owner. Site managers only see
          their assigned sites.
        </p>
      </>
    );
  }
  if (section === 'settings') {
    if (!can(membership.role, 'organisation:update')) notFound();
    return (
      <>
        <Heading
          eyebrow="MAKE IT YOURS"
          title="Workspace settings"
          text="Manage the details that shape your organisation’s workspace."
        />
        <div className="settings-grid">
          <section className="panel">
            <div className="section-heading">
              <h2>Organisation details</h2>
              <Settings size={19} />
            </div>
            <OrganisationForm organisation={org} />
          </section>
          <section className="panel plan-summary">
            <span className="tag">Current plan</span>
            <h2>{org.plan.name}</h2>
            <p>
              {org.plan.siteLimit
                ? `A foundation for up to ${org.plan.siteLimit} sites.`
                : 'A flexible foundation for your organisation.'}
            </p>
            <ul>
              <li>
                <Check size={16} /> Organisation workspace
              </li>
              <li>
                <Check size={16} /> Role-based team access
              </li>
              <li>
                <Check size={16} /> Core energy tools as they launch
              </li>
            </ul>
            <div className="notice">Billing and plan changes arrive in a later release.</div>
          </section>
        </div>
      </>
    );
  }
  if (section === 'audit') {
    const events = await accessible(() => foundation.listAudit(actor, org.id));
    return (
      <>
        <Heading
          eyebrow="A CLEAR RECORD"
          title="Activity log"
          text="A permanent record of changes to your organisation and team."
        />
        <section className="panel">
          <div className="section-heading">
            <h2>Recent activity</h2>
            <span className="muted">Latest 100 events · {org.timezone}</span>
          </div>
          <div className="audit-list">
            {events.map((event) => (
              <details className="audit-row" key={event.id}>
                <summary>
                  <span className="audit-dot" />
                  <div>
                    <strong>{eventLabels[event.action] ?? event.action}</strong>
                    <small>{formatDate(event.createdAt, org.timezone, true)}</small>
                  </div>
                  <span className="mini-label">Details</span>
                </summary>
                <dl>
                  <dt>Actor ID</dt>
                  <dd>{event.actorUserId}</dd>
                  <dt>Target ID</dt>
                  <dd>{event.targetId}</dd>
                  <dt>Request ID</dt>
                  <dd>{event.correlationId}</dd>
                  <dt>Changes</dt>
                  <dd>
                    <code>{JSON.stringify(event.metadata)}</code>
                  </dd>
                </dl>
              </details>
            ))}
            {!events.length && <p className="empty-inline">No activity recorded yet.</p>}
          </div>
        </section>
        <p className="page-note">
          <ShieldCheck size={16} /> Activity records cannot be edited or removed through the application.
        </p>
      </>
    );
  }
  if (section === 'sites') {
    return (
      <>
        <Heading
          eyebrow="YOUR PLACES, CONNECTED"
          title="Sites"
          text={
            membership.role === 'SITE_MANAGER'
              ? 'The sites assigned to you by your organisation.'
              : 'Your organisation’s buildings and energy locations.'
          }
        />
        {sites.length ? (
          <div className="site-grid">
            {sites.map((site) => (
              <section className="panel" key={site.id}>
                <span className="large-icon">
                  <Building2 />
                </span>
                <h2>{site.name}</h2>
                <p className="muted">{site.code}</p>
                <span className="tag subtle">Site details coming next</span>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Building2 size={32} />}
            title={membership.role === 'SITE_MANAGER' ? 'No sites assigned yet' : 'Your portfolio starts here'}
            text={
              membership.role === 'SITE_MANAGER'
                ? 'Ask your organisation owner or admin to assign sites to you. Only assigned sites will appear here.'
                : 'Your sites will bring your energy performance into focus. Site and meter setup arrives in the next release.'
            }
            label="Site setup · Coming next"
          />
        )}
      </>
    );
  }
  const future = {
    analysis: {
      icon: <BarChart3 size={32} />,
      title: 'Analysis',
      headline: 'Turn energy data into understanding',
      text: 'Baseline models, routine adjustments and performance insights will be available after site and data foundations are in place.',
    },
    reports: {
      icon: <FileText size={32} />,
      title: 'Reports',
      headline: 'A clearer story of your performance',
      text: 'Shareable reports will bring your verified energy results together. Reporting tools are planned for a later release.',
    },
    portfolio: {
      icon: <Layers3 size={32} />,
      title: 'Portfolio',
      headline: 'See the bigger picture',
      text: 'Compare sites and understand performance across your organisation. Portfolio tools are planned for a later release.',
    },
  }[section];
  if (!future) notFound();
  return (
    <>
      <Heading
        eyebrow="BUILDING WHAT’S NEXT"
        title={future.title}
        text="Your energy workspace is growing, one foundation at a time."
      />
      <EmptyState
        icon={future.icon}
        title={future.headline}
        text={future.text}
        label={
          section === 'portfolio' && !hasFeature(org.planKey, 'portfolio')
            ? 'Planned for Growth and above'
            : 'Coming in a later release'
        }
      />
    </>
  );
}
function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
function EmptyState({
  icon,
  title,
  text,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  label: string;
}) {
  return (
    <section className="panel empty-state">
      <span className="empty-art">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <span className="tag subtle">{label}</span>
    </section>
  );
}
function formatDate(value: Date, timeZone: string, time = false) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    ...(time ? { timeStyle: 'short' as const } : {}),
    timeZone,
  }).format(value);
}
const eventLabels: Record<string, string> = {
  'organisation.created': 'Workspace created',
  'organisation.updated': 'Organisation details updated',
  'invitation.created': 'Team invitation created',
  'invitation.accepted': 'Invitation accepted',
  'invitation.revoked': 'Invitation revoked',
  'invitation.delivery_failed': 'Invitation delivery failed',
  'membership.role_changed': 'Member role changed',
  'membership.revoked': 'Member access removed',
  'membership.sites_changed': 'Site access updated',
};
