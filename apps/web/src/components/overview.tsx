import Link from 'next/link';
import { notFound } from 'next/navigation';
import { carbonService } from '@/server/services';
import { accessible } from '@/server/page-auth';
import type { Actor } from '@/server/foundation';
import { carbonSummaryInput } from '@/domain/carbon';
import { factorBases } from '@/domain/emission-factors';

export async function Overview({
  actor,
  organisationId,
  sites,
  query,
}: {
  actor: Actor;
  organisationId: string;
  sites: { id: string; name: string }[];
  query: Record<string, string | string[] | undefined>;
}) {
  const base = `/org/${organisationId}`;
  const active = sites;
  const siteId = typeof query.site === 'string' ? query.site : active[0]?.id;
  const site = active.find((s) => s.id === siteId);
  if (query.site !== undefined && !site) notFound();
  const definition = carbonSummaryInput.safeParse({
    year: query.year === undefined ? new Date().getUTCFullYear() : Number(query.year),
    geography: query.geography ?? 'GB',
    basis: query.basis ?? 'LOCATION_BASED',
  });
  const data =
    site && definition.success
      ? await accessible(() => carbonService.overview(actor, organisationId, site.id, definition.data))
      : null;
  const display = (value: string | null, unit: string) => (value === null ? 'Unavailable' : `${value} ${unit}`);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ENERGY PERFORMANCE</span>
          <h1>Overview</h1>
          <p>Annual performance and monthly coverage for your selected site.</p>
        </div>
      </div>
      {!active.length ? (
        <section className="panel">
          <h2>Add your first site</h2>
          <p>Energy, cost and carbon metrics will appear as records and calculations become available.</p>
          <Link href={`${base}/sites`}>Manage sites</Link>
        </section>
      ) : (
        <>
          <form method="get" className="panel stack-form" aria-label="Overview filters">
            <div className="form-grid">
              <label>
                Site
                <select name="site" defaultValue={siteId}>
                  {active.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Calendar year
                <input
                  type="number"
                  name="year"
                  min="1900"
                  max="2199"
                  required
                  defaultValue={typeof query.year === 'string' ? query.year : new Date().getUTCFullYear()}
                />
              </label>
              <label>
                Carbon geography
                <input
                  name="geography"
                  required
                  pattern="[A-Za-z0-9_-]{2,40}"
                  defaultValue={typeof query.geography === 'string' ? query.geography : 'GB'}
                />
              </label>
              <label>
                Carbon reporting basis
                <select name="basis" defaultValue={typeof query.basis === 'string' ? query.basis : 'LOCATION_BASED'}>
                  {factorBases.map((basis) => (
                    <option key={basis}>{basis}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="button">
              Update overview
            </button>
          </form>
          {!definition.success && (
            <p role="alert">Choose a year from 1900 to 2199, a valid geography and reporting basis.</p>
          )}
          {data && (
            <>
              <p className="page-note">
                {site?.name} · January–December {data.carbon.definition.year} · {data.carbon.meters.length} active
                meters · Checked {data.carbon.checkedAt}. Registered meter totals can include overlapping main meters
                and submeters; they are not a net site inventory.
              </p>
              <section className="stat-grid overview-kpis" aria-label="Performance summary">
                <div className="stat-card">
                  <span>Energy consumption</span>
                  <strong style={{ fontSize: '1.5rem', overflowWrap: 'anywhere' }}>
                    {display(data.energy.kwh, 'kWh')}
                  </strong>
                  <small>{data.energy.completeMonths}/12 months with complete active-meter coverage</small>
                  <Link href={`${base}/energy`}>Inspect consumption records</Link>
                </div>
                <div className="stat-card">
                  <span>Recorded cost · excluding VAT</span>
                  <strong style={{ fontSize: '1.5rem', overflowWrap: 'anywhere' }}>
                    {display(data.energy.netCost, data.energy.currency ?? '')}
                  </strong>
                  <small>
                    Requires all readings to have net cost in one currency. No currency conversion or tariff estimate.
                  </small>
                  <Link href={`${base}/energy`}>Inspect recorded costs</Link>
                </div>
                <div className="stat-card">
                  <span>Carbon emissions</span>
                  <strong style={{ fontSize: '1.5rem', overflowWrap: 'anywhere' }}>
                    {display(data.carbon.totalKgCO2e, 'kgCO2e')}
                  </strong>
                  <small>
                    {data.carbon.status} · {data.carbon.definition.geography} · {data.carbon.definition.basis}
                  </small>
                  <Link href={`${base}/carbon`}>Inspect carbon runs and factors</Link>
                </div>
                <div className="stat-card">
                  <span>Verified savings</span>
                  <strong style={{ fontSize: '1.5rem' }}>Unavailable</strong>
                  <small>
                    Analysis is currently unvalidated. Experimental expected-versus-actual results must not be presented
                    as verified savings.
                  </small>
                  <Link href={`${base}/waste-savings`}>Inspect experimental waste and savings</Link>
                </div>
              </section>
              <section className="panel stack-form">
                <h2>Monthly energy and cost</h2>
                <p>
                  Unavailable means incomplete coverage, missing cost or mixed currencies. Zero is a recorded value.
                  Estimates are included and counted below.
                </p>
                <div className="analysis-table" tabIndex={0} role="region" aria-label="Monthly overview">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Energy (kWh)</th>
                        <th>Net cost</th>
                        <th>Estimated readings</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.energy.months.map((month) => (
                        <tr key={month.month}>
                          <td>{month.month}</td>
                          <td>{month.kwh ?? 'Unavailable'}</td>
                          <td>{display(month.netCost, month.currency ?? '')}</td>
                          <td>{month.estimated}</td>
                          <td>
                            <details>
                              <summary>{month.evidence.length} source readings</summary>
                              <ul>
                                {month.evidence.map((r) => (
                                  <li key={r.id}>
                                    Reading {r.id} · revision {r.revision} · meter {r.meterId} · conversion{' '}
                                    {r.conversionVersion}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel stack-form">
                <h2>Carbon coverage and evidence</h2>
                <p>
                  Current readings and factors are checked against saved runs. Corrections leave historical runs intact
                  and make affected totals unavailable until recalculated.
                </p>
                {data.carbon.meters.length === 0 && <p>No active meters. Add a meter on the Sites page.</p>}
                {data.carbon.meters.map((m) => (
                  <div key={m.meterId}>
                    <strong>
                      {m.name} · {m.status}
                    </strong>
                    <p>
                      {display(m.kgCO2e, 'kgCO2e')} · {m.issue ?? 'Current saved calculation'}
                    </p>
                    {m.runId && (
                      <small>
                        Saved run {m.runId} · {m.calculatedAt}
                      </small>
                    )}
                  </div>
                ))}
                <Link href={`${base}/carbon`}>Open carbon evidence and exports</Link>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
