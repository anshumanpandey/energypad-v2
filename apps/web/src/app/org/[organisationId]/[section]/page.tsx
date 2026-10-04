import { Graphs } from '@/components/graphs';
import { UtilityGraphs } from '@/components/utility-graphs';
import { utilityGraphService } from '@/server/services';
import { ImportRetention } from '@/components/import-retention';
import { BillingOverview } from '@/components/billing-overview';
import { auditFilters, auditHistoryUrl } from '@/domain/audit-history';
import { billingService } from '@/server/services';
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
  FileText,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { pageActor, accessible } from '@/server/page-auth';
import { foundation, siteService, analysisService } from '@/server/services';
import { can, canManageRole, roleLabels, hasFeature } from '@/domain/policy';
import { InviteForm, MemberActions, OrganisationForm, RevokeInvite } from '@/components/forms';
import { SitesWorkspace, PortfoliosWorkspace } from '@/components/sites-workspace';
import { DataImportWorkspace, HistoricImport } from '@/components/data-import-workspace';
import { Button } from '@/components/ui/button';
import { AnalysisWorkspace } from '@/components/analysis-workspace';
import { EnergyYearProvider } from '@/components/energy-year';
import { EnergyWorkspace } from '@/components/energy-workspace';
import { AllConsumption } from '@/components/all-consumption';

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

  if (section === 'consumption' || section === 'emissions')
    return (
      <UtilityGraphs
        key={section}
        rows={await accessible(() => utilityGraphService.records(actor, org.id))}
        targets={await accessible(() => utilityGraphService.targets(actor, org.id))}
        sites={sites}
        kind={section}
      />
    );

  if (section === 'graphs')
    return <Graphs actor={actor} organisationId={org.id} sites={sites} query={await searchParams} />;

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
          canArchive={can(membership.role, 'analysis:write')}
          scheduleSettings={{
            canWrite: can(membership.role, 'analysis:write') && hasFeature(org.planKey, 'scheduledReports'),
            selfId: membership.id,
            timezone: org.timezone,
            recipients: manage
              ? (await accessible(() => foundation.listMembers(actor, org.id))).map((m) => ({
                  id: m.id,
                  label: m.user.name ?? m.user.email,
                  siteIds: m.role === 'SITE_MANAGER' ? m.siteAssignments.map((a) => a.siteId) : null,
                }))
              : [{ id: membership.id, label: 'Me', siteIds: null }],
          }}
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
            <h1>Upload</h1>
            <p>Upload emissions, targets and drivers, then import your monthly consumption.</p>
          </div>
        </div>
        {manage && <DataImportWorkspace orgId={org.id} batches={[]} workflow />}
        {manage && <HistoricImport orgId={org.id} workbookLabel="Latest consumption workbook" />}
        <AllConsumption orgId={org.id} sites={sites} />
        <EnergyYearProvider>
          <EnergyWorkspace orgId={org.id} sites={sites} manage={manage} />
          <section className="waste-report stack-form" aria-labelledby="waste-report-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">EXPECTED VS ACTUAL CONSUMPTION</span>
                <h2 id="waste-report-title">Waste Report</h2>
                <p>Build a baseline, compare a reporting period and review potential waste or savings.</p>
              </div>
            </div>
            <AnalysisWorkspace
              wizard
              orgId={org.id}
              sites={await accessible(() => analysisService.historySites(actor, org.id))}
              manage={can(membership.role, 'analysis:write')}
              approve={can(membership.role, 'analysis:approve')}
              actorId={actor.userId}
            />
          </section>
        </EnergyYearProvider>
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
  if (section === 'import-retention') {
    if (!can(membership.role, 'retention:read')) notFound();
    return (
      <>
        <Heading
          eyebrow="DATA MANAGEMENT"
          title="Import retention"
          text="Review stored import batches before defining retention rules."
        />
        <ImportRetention actor={actor} orgId={org.id} query={await searchParams} />
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
            <p>
              <Link href={`${base}/import-retention`}>Review import retention</Link>
            </p>
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
    const query = await searchParams;
    const cursor = query.cursor;
    if (Array.isArray(cursor)) notFound();
    const filters = await accessible(async () =>
      auditFilters.parse({ action: query.action, requestId: query.requestId }),
    );
    const history = await accessible(() => foundation.auditHistory(actor, org.id, cursor, filters));
    const events = history.items;
    const exportQuery = new URLSearchParams(auditHistoryUrl(org.id, filters, cursor).split('?')[1]);
    const exportUrl = (format: 'csv' | 'json') => {
      const query = new URLSearchParams(exportQuery);
      query.set('format', format);
      return `/api/v1/organisations/${org.id}/audit/export?${query}`;
    };
    return (
      <>
        <Heading
          eyebrow="A CLEAR RECORD"
          title="Activity log"
          text="A permanent record of changes to your organisation and team."
        />
        <form
          key={JSON.stringify(filters)}
          action={`/org/${org.id}/audit`}
          method="get"
          className="panel stack-form"
          aria-label="Filter activity"
        >
          <h2>Find activity</h2>
          <p className="muted">
            Match an exact action code or request ID from an event’s details. Both filters apply when supplied.
          </p>
          <label>
            Action code
            <input
              name="action"
              defaultValue={filters.action ?? ''}
              maxLength={100}
              pattern={'[a-z][a-z0-9_.\\-]*'}
              title="Use the exact lowercase action code shown in an event."
              placeholder="e.g. organisation.updated"
            />
          </label>
          <label>
            Request ID
            <input
              name="requestId"
              defaultValue={filters.requestId ?? ''}
              maxLength={36}
              pattern="[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
              title="Enter the UUID shown as Request ID in an event."
              placeholder="UUID from event details"
            />
          </label>
          <div className="button-row">
            <Button type="submit">Apply filters</Button>
            <Button asChild variant="secondary">
              <Link href={`/org/${org.id}/audit`} prefetch={false}>
                Clear filters
              </Link>
            </Button>
          </div>
        </form>
        <section className="panel">
          <div className="section-heading">
            <h2>{query.cursor ? 'Earlier activity' : 'Recent activity'}</h2>
            <span className="muted">
              {events.length} events · {org.timezone}
            </span>
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
                  <dt>Action code</dt>
                  <dd>{event.action}</dd>
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
            {!events.length && (
              <p className="empty-inline">
                {filters.action || filters.requestId
                  ? 'No activity matches these filters.'
                  : 'No activity recorded yet.'}
              </p>
            )}
          </div>
          <nav className="button-row" aria-label="Activity history pages">
            {query.cursor && (
              <Link href={auditHistoryUrl(org.id, filters)} prefetch={false}>
                Latest activity
              </Link>
            )}
            {history.nextCursor && (
              <Link href={auditHistoryUrl(org.id, filters, history.nextCursor)} prefetch={false}>
                Older activity
              </Link>
            )}
          </nav>
          <div className="stack-form">
            <p className="muted">
              Export this page: up to 100 matching events at download time, including filters and the next-page cursor.
              Each export is recorded in the Activity log.
            </p>
            <div className="button-row">
              <a href={exportUrl('csv')} download>
                Export this page (CSV)
              </a>
              <a href={exportUrl('json')} download>
                Export this page (JSON)
              </a>
            </div>
          </div>
        </section>
        <p className="page-note">
          <ShieldCheck size={16} /> Activity records cannot be edited or removed through the application.
        </p>
      </>
    );
  }
  if (section === 'sites') {
    const tableSites = await siteService.siteTable(actor, org.id);
    const batches = manage ? await siteService.imports(actor, org.id) : [];
    return (
      <>
        <Heading
          eyebrow="YOUR SITES"
          title="Sites"
          text="Manage locations, meters and effective-dated site attributes."
        />
        <SitesWorkspace orgId={org.id} sites={tableSites} batches={batches} manage={manage} />
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
          <Heading eyebrow="YOUR DATA" title="Data" text="Ask an owner or admin to import your workbook." />
        </>
      );
    const batches = await siteService.imports(actor, org.id);
    return (
      <>
        <Heading
          eyebrow="IMPORT DATA"
          title="Data"
          text="Import sites, consumption, emissions and driver classifications from Excel."
        />
        <p className="data-retention-link">
          <Link href={`${base}/import-retention`}>
            Import history &amp; retention <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </p>
        <DataImportWorkspace orgId={org.id} batches={batches} />
      </>
    );
  }
  if (section === 'billing') {
    if (!can(membership.role, 'billing:manage')) notFound();
    return <BillingOverview data={await accessible(() => billingService.overview(actor, org.id))} />;
  }
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
