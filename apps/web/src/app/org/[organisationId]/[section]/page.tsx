import { PortfolioEnergy } from '@/components/portfolio-energy';
import { AIEvidence } from '@/components/ai-evidence';
import { Opportunities } from '@/components/opportunities';
import { AnalyticsReports } from '@/components/analytics-reports';
import { CarbonTrends } from '@/components/carbon-trends';
import { MonthlyPlans } from '@/components/monthly-plans';
import { SitePerformance } from '@/components/site-performance';
import { WasteSavings } from '@/components/waste-savings';
import { Overview } from '@/components/overview';
import Link from 'next/link';
import { PortfolioCarbon } from '@/components/portfolio-carbon';
import { CarbonWorkspace } from '@/components/carbon-workspace';
import { EmissionFactorWorkspace } from '@/components/emission-factor-workspace';
import { emissionFactorService } from '@/server/services';
import { notFound } from 'next/navigation';
import {
  Check,
  ShieldCheck,
  BarChart3,
  Zap,
  Leaf,
  Lightbulb,
  Sparkles,
  CreditCard,
  FileText,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { pageActor, accessible } from '@/server/page-auth';
import { foundation, siteService, analysisService } from '@/server/services';
import { can, canManageRole, roleLabels } from '@/domain/policy';
import { InviteForm, MemberActions, OrganisationForm, RevokeInvite } from '@/components/forms';
import { SitesWorkspace, PortfoliosWorkspace } from '@/components/sites-workspace';
import { ImportWorkspace } from '@/components/import-workspace';
import { Button } from '@/components/ui/button';
import { AnalysisWorkspace } from '@/components/analysis-workspace';
import { EnergyWorkspace } from '@/components/energy-workspace';

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string; section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  if (section === 'ai-analyst')
    return (
      <AIEvidence organisationId={org.id} sites={await accessible(() => analysisService.historySites(actor, org.id))} />
    );
  if (section === 'opportunities') {
    const query = await searchParams;
    const available = await accessible(() => analysisService.historySites(actor, org.id));
    const site = typeof query.site === 'string' ? query.site : undefined;
    if (site && !available.some((s) => s.id === site)) notFound();
    return (
      <Opportunities
        organisationId={org.id}
        sites={available}
        canApprove={can(membership.role, 'analysis:approve')}
        canWrite={can(membership.role, 'analysis:write')}
        initialSite={site}
        initialRun={typeof query.run === 'string' ? query.run : undefined}
        initialCarbon={typeof query.carbon === 'string' ? query.carbon : undefined}
      />
    );
  }
  if (section === 'carbon-trends')
    return <CarbonTrends actor={actor} organisationId={org.id} query={await searchParams} />;
  if (section === 'targets')
    return (
      <MonthlyPlans
        organisationId={org.id}
        sites={await accessible(() => analysisService.historySites(actor, org.id))}
        canWrite={can(membership.role, 'analysis:write')}
      />
    );
  if (section === 'site-performance')
    return <SitePerformance actor={actor} organisationId={org.id} currency={org.currency} query={await searchParams} />;
  if (section === 'waste-savings')
    return <WasteSavings actor={actor} organisationId={org.id} query={await searchParams} />;
  if (section === 'reports')
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">REPORTS AND EXPORTS</span>
            <h1>Reports</h1>
            <p>Preview and export energy, savings, baseline and carbon evidence.</p>
          </div>
        </div>
        <section className="panel stack-form">
          <h2>Carbon reports</h2>
          <p>
            Choose a site or portfolio, check its year, geography and reporting basis, then download CSV or JSON from
            the result. Exports recheck your access and the latest coverage.
          </p>
          <p>
            CSV includes coverage and monthly evidence rows. JSON preserves exact decimal strings and complete saved run
            evidence. Incomplete totals remain unavailable in both formats.
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Link href={`${base}/carbon`}>
              Open site carbon reports <ArrowRight size={14} />
            </Link>
            <Link href={`${base}/portfolio`}>
              Open portfolio carbon reports <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <AnalyticsReports
          organisationId={org.id}
          sites={await accessible(() => analysisService.historySites(actor, org.id))}
        />
      </>
    );
  if (section === 'carbon') {
    const factors = await accessible(() => emissionFactorService.list(actor, org.id));
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">CARBON DATA</span>
            <h1>Carbon</h1>
            <p>Calculate emissions from versioned consumption and factors, and preserve their history.</p>
          </div>
        </div>
        <p className="page-note">
          <Link href={`${base}/carbon-trends`}>
            Compare monthly and annual carbon trends <ArrowRight size={14} />
          </Link>
        </p>
        <CarbonWorkspace
          orgId={org.id}
          sites={await accessible(() => analysisService.historySites(actor, org.id))}
          manage={can(membership.role, 'analysis:write')}
          canFactors={can(membership.role, 'organisation:update')}
        />
        <EmissionFactorWorkspace
          orgId={org.id}
          manage={can(membership.role, 'organisation:update')}
          records={factors.map((f) => ({
            ...f,
            factor: f.factor.toString(),
            validFrom: f.validFrom.toISOString(),
            validUntil: f.validUntil.toISOString(),
            createdAt: f.createdAt.toISOString(),
          }))}
        />
      </>
    );
  }
  if (section === 'analysis')
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">ENERGY INSIGHTS</span>
            <h1>Advanced Analysis</h1>
            <p>Check monthly inputs, preserve a baseline and explore reporting results.</p>
          </div>
        </div>
        <AnalysisWorkspace
          orgId={org.id}
          sites={await accessible(() => analysisService.historySites(actor, org.id))}
          manage={can(membership.role, 'analysis:write')}
          approve={can(membership.role, 'analysis:approve')}
          actorId={actor.userId}
        />
      </>
    );
  if (section === 'energy')
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">ENERGY DATA</span>
            <h1>Energy</h1>
            <p>Record monthly consumption and check the completeness of your meter data.</p>
          </div>
        </div>
        <EnergyWorkspace orgId={org.id} sites={sites} manage={manage} />
        <p className="page-note">
          <Link href={`${base}/analysis`}>
            Advanced Analysis <ArrowRight size={14} />
          </Link>
        </p>
      </>
    );
  if (section === 'overview')
    return <Overview actor={actor} organisationId={org.id} sites={sites} query={await searchParams} />;
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
    const portfolios = await siteService.portfolios(actor, org.id);
    return (
      <>
        <Heading
          eyebrow="YOUR SITES"
          title="Sites"
          text="Manage locations, meters and effective-dated site attributes."
        />
        <SitesWorkspace orgId={org.id} sites={sites} portfolios={portfolios} manage={manage} />
      </>
    );
  }
  if (section === 'portfolio') {
    const portfolios = await siteService.portfolios(actor, org.id);
    return (
      <>
        <Heading
          eyebrow="YOUR PORTFOLIOS"
          title="Portfolio"
          text="Compare portfolio energy, cost and carbon coverage across active sites and meters."
        />
        <p className="page-note">
          <Link href={`${base}/carbon-trends${portfolios[0] ? `?scope=portfolio:${portfolios[0].id}` : ''}`}>
            Compare site and portfolio carbon trends <ArrowRight size={14} />
          </Link>
        </p>
        <PortfolioEnergy orgId={org.id} portfolios={portfolios} />
        <PortfolioCarbon orgId={org.id} portfolios={portfolios} />
        <PortfoliosWorkspace orgId={org.id} portfolios={portfolios} manage={manage} />
      </>
    );
  }
  if (section === 'data') {
    if (!manage)
      return (
        <>
          <Heading eyebrow="YOUR DATA" title="Data" text="Ask an owner or admin to import your site workbook." />
        </>
      );
    const batches = await siteService.imports(actor, org.id);
    return (
      <>
        <Heading eyebrow="SITE IMPORT" title="Data" text="Upload, map, validate and import your sites." />
        <ImportWorkspace orgId={org.id} batches={batches} />
      </>
    );
  }
  if (section === 'billing' && !can(membership.role, 'billing:manage')) notFound();
  const future = {
    energy: {
      icon: <Zap size={32} />,
      title: 'Energy',
      headline: 'Understand your energy use',
      text: 'Consumption trends, weather insights and waste and savings will become available as your energy data tools are released.',
    },
    carbon: {
      icon: <Leaf size={32} />,
      title: 'Carbon',
      headline: 'Understand your carbon footprint',
      text: 'Carbon reporting will connect energy use to versioned emission factors, with clear sources and site comparisons.',
    },
    opportunities: {
      icon: <Lightbulb size={32} />,
      title: 'Opportunities',
      headline: 'Turn insights into action',
      text: 'Track potential savings, assign actions and verify results when opportunity management becomes available.',
    },
    'ai-analyst': {
      icon: <Sparkles size={32} />,
      title: 'AI Analyst',
      headline: 'Explore the story behind your energy',
      text: 'Ask questions and investigate performance using verified analytical results when the AI Analyst becomes available.',
    },
    billing: {
      icon: <CreditCard size={32} />,
      title: 'Billing',
      headline: 'Manage your subscription',
      text: 'Plan selection, trials, payments and subscription management are not available yet. Your current plan does not represent an active paid subscription.',
    },
    analysis: {
      icon: <BarChart3 size={32} />,
      title: 'Advanced Analysis',
      headline: 'Turn energy data into understanding',
      text: 'Baseline models, routine adjustments and performance insights will be available after site and data foundations are in place.',
    },
    reports: {
      icon: <FileText size={32} />,
      title: 'Reports',
      headline: 'A clearer story of your performance',
      text: 'Shareable reports will bring your verified energy results together. Reporting tools are planned for a later release.',
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
      {section === 'energy' && (
        <Button asChild variant="secondary">
          <Link href={`${base}/analysis`}>
            Advanced Analysis <ArrowRight size={17} />
          </Link>
        </Button>
      )}
      <EmptyState icon={future.icon} title={future.headline} text={future.text} label="Coming in a later release" />
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
  'site.created': 'Site created',
  'site.updated': 'Site updated',
  'site.archived': 'Site archived',
  'site.attributes_added': 'Site history added',
  'portfolio.created': 'Portfolio created',
  'portfolio.updated': 'Portfolio updated',
  'portfolio.archived': 'Portfolio archived',
  'meter.created': 'Meter created',
  'meter.updated': 'Meter updated',
  'meter.archived': 'Meter archived',
  'import.uploaded': 'Site workbook staged',
  'import.committed': 'Sites imported',
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
