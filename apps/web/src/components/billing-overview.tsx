import type { BillingOverview as Overview } from '@/server/billing';

export function BillingOverview({ data }: { data: Overview }) {
  return (
    <div className="stack-form">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLAN AND USAGE</span>
          <h1>Billing</h1>
          <p>Review your organisation’s assigned plan and active-site capacity.</p>
        </div>
      </div>
      <section className="panel stack-form" aria-label="Current plan">
        <h2>{data.plan.name} plan</h2>
        <p>Billing is not connected. This assigned plan does not represent an active paid subscription.</p>
        <p>Checkout, invoices, trials and subscription changes are not available yet.</p>
      </section>
      <section className="panel stack-form" aria-label="Active-site usage">
        <h2>Active sites</h2>
        <strong>
          {data.sites.active} / {data.sites.limit ?? 'Unlimited'}
        </strong>
        <p>
          {data.sites.remaining === null
            ? 'No active-site cap on this plan.'
            : `${data.sites.remaining} site slots remaining.`}
        </p>
        <p>Archived sites do not count towards this limit.</p>
        {data.sites.overLimit && (
          <p role="status">Your active-site count exceeds the assigned plan limit. Adding sites is blocked.</p>
        )}
        {!data.sites.overLimit && data.sites.remaining === 0 && <p role="status">Your active-site limit is reached.</p>}
      </section>
      <section className="panel stack-form" aria-label="Plan entitlements">
        <h2>Plan entitlements</h2>
        <p>Inclusion describes your plan. Availability also depends on feature rollout, configuration and your role.</p>
        <dl>
          {data.features.map((feature) => (
            <div key={feature.key} className="flex items-start justify-between gap-4 border-b border-slate-200 py-3">
              <dt>{feature.name}</dt>
              <dd className="shrink-0 font-medium">{feature.included ? 'Included' : 'Not included'}</dd>
            </div>
          ))}
        </dl>
        <p>
          Live AI answers remain deferred. Scheduled reports, API subscriptions and single sign-on are not available
          yet.
        </p>
      </section>
    </div>
  );
}
