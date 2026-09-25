import Link from 'next/link';
import { benchmarkInput } from '@/domain/benchmarking';
import { fuels } from '@/domain/tariffs';
import { factorBases } from '@/domain/emission-factors';
import { carbonService } from '@/server/services';
import type { Actor } from '@/server/foundation';
import { accessible } from '@/server/page-auth';
import { Button } from './ui/button';
export async function SitePerformance({
  actor,
  organisationId,
  query,
  currency,
}: {
  actor: Actor;
  organisationId: string;
  currency: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const text = (key: string, fallback = '') => (typeof query[key] === 'string' ? (query[key] as string) : fallback);
  const input = benchmarkInput.safeParse({
    year: Number(text('year', String(new Date().getUTCFullYear()))),
    month: Number(text('month', '0')),
    fuel: text('fuel', 'ELECTRICITY'),
    currency: text('currency', currency),
    metric: text('metric', 'kwh'),
    order: text('order', 'asc'),
    geography: text('geography', 'GB'),
    basis: text('basis', 'LOCATION_BASED'),
    siteId: text('site') || undefined,
    siteType: text('type'),
  });
  const result = input.success
    ? await accessible(() => carbonService.benchmark(actor, organisationId, input.data))
    : null;
  const base = `/org/${organisationId}`;
  const value = (v: string | null, unit = '') => (v === null ? 'Unavailable' : `${v} ${unit}`);
  return (
    <div className="waste-savings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SITE COMPARISONS</span>
          <h1>Site Performance</h1>
          <p>Compare consumption, recorded cost and annual carbon targets across accessible sites.</p>
        </div>
      </div>
      <form method="get" className="panel stack-form" aria-label="Benchmark filters">
        <div className="form-grid">
          <label>
            Benchmark year
            <input
              name="year"
              type="number"
              min="1900"
              max="2199"
              required
              defaultValue={text('year', String(new Date().getUTCFullYear()))}
            />
          </label>
          <label>
            Period
            <select name="month" defaultValue={text('month', '0')}>
              <option value="0">Full calendar year</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(Date.UTC(2020, i)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fuel
            <select name="fuel" defaultValue={text('fuel', 'ELECTRICITY')}>
              {fuels.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Cost currency
            <input name="currency" required pattern="[A-Za-z]{3}" defaultValue={text('currency', currency)} />
          </label>
          <label>
            Rank by
            <select name="metric" defaultValue={text('metric', 'kwh')}>
              <option value="kwh">Consumption (kWh)</option>
              <option value="netCost">Recorded net cost</option>
            </select>
          </label>
          <label>
            Order
            <select name="order" defaultValue={text('order', 'asc')}>
              <option value="asc">Lowest first</option>
              <option value="desc">Highest first</option>
            </select>
          </label>
          <label>
            Site
            <select name="site" defaultValue={text('site')}>
              <option value="">All accessible sites</option>
              {result?.available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Site type
            <select name="type" defaultValue={text('type')}>
              <option value="">All site types</option>
              {[...new Set(result?.available.map((s) => s.type).filter((t): t is string => !!t))].sort().map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Carbon geography
            <input name="geography" required pattern="[A-Za-z0-9_-]{2,40}" defaultValue={text('geography', 'GB')} />
          </label>
          <label>
            Carbon basis
            <select name="basis" defaultValue={text('basis', 'LOCATION_BASED')}>
              {factorBases.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
        </div>
        <Button type="submit">Compare sites</Button>
      </form>
      {!input.success && <p role="alert">Choose a valid year, period, fuel, currency and carbon definition.</p>}
      {result && (
        <>
          <section className="panel stack-form">
            <h2>Comparison scope</h2>
            <p>
              {result.scope} · {result.definition.year}
              {result.definition.month ? `-${String(result.definition.month).padStart(2, '0')}` : ' full year'} ·{' '}
              {result.definition.fuel} · {result.rows.length} sites · checked {result.checkedAt}
            </p>
            <p>
              Ranks compare absolute registered-meter totals, not efficiency. Sites can differ in size, activity and
              meter coverage; use site type to narrow the comparison. Main meters and submeters may overlap. No weather,
              floor-area or occupancy normalisation is inferred.
            </p>
            <p>
              All ranked energy values require the same full months and fuel, normalised to kWh. Cost excludes VAT and
              requires complete costs in {result.definition.currency}; currencies are never converted or mixed. Missing
              values stay unranked at the end. Equal values share a rank, with site code and ID providing a stable
              order.
            </p>
            <p>
              Targets are current annual carbon limits for the same selected meters, geography and basis. Monthly
              targets are not prorated. Monthly consumption targets compare against the same site/fuel period. Missing
              months or alternative targets in multiple source units prevent a combined target. Monitoring plans are not
              counted as consumption targets. A negative carbon difference is below the target; a positive difference
              exceeds it. Comparison method: site-benchmark-v1.
            </p>
          </section>
          <section className="panel stack-form">
            <h2>Site rankings</h2>
            {!result.rows.length && <p>No accessible active sites match these filters.</p>}
            <div className="analysis-table" role="region" aria-label="Site rankings" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Site</th>
                    <th>Meters / complete months</th>
                    <th>Consumption kWh</th>
                    <th>Net cost {result.definition.currency}</th>
                    <th>Energy target kWh</th>
                    <th>Actual − energy target kWh</th>
                    <th>Annual target kgCO2e</th>
                    <th>Actual kgCO2e</th>
                    <th>Actual − target kgCO2e</th>
                    <th>Coverage / target status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.rank ?? 'Unranked'}</td>
                      <th>
                        <Link
                          href={`${base}/overview?site=${r.id}&year=${result.definition.year}&geography=${result.definition.geography}&basis=${result.definition.basis}`}
                        >
                          {r.name}
                        </Link>
                        <small>
                          {' '}
                          · {r.code}
                          {r.type ? ` · ${r.type}` : ''}
                        </small>
                      </th>
                      <td>
                        {r.meterCount} / {r.completeMonths} of {r.expectedMonths}
                      </td>
                      <td>{value(r.kwh)}</td>
                      <td>{value(r.netCost)}</td>
                      <td>{value(r.energyTarget)}</td>
                      <td>{value(r.energyTargetGap)}</td>
                      <td>{value(r.target)}</td>
                      <td>{value(r.actualCarbon)}</td>
                      <td>{value(r.carbonGap)}</td>
                      <td>
                        {r.energyIssue ?? 'Energy complete'}; {r.costIssue ?? 'Cost complete'}; {r.targetStatus};{' '}
                        {r.energyTargetIssue ?? 'Energy targets complete'}; {r.estimated} estimated readings
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel stack-form">
            <h2>Monthly comparisons and source evidence</h2>
            <p>
              Current source revisions are shown below. Corrections can change this live comparison; previously saved
              carbon runs and assessments remain immutable.
            </p>
            {result.rows.map((r) => (
              <details key={r.id}>
                <summary>{r.name} · monthly values and evidence</summary>
                <div className="analysis-table" role="region" aria-label={`${r.name} monthly comparison`} tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>kWh</th>
                        <th>Net cost</th>
                        <th>Estimates</th>
                        <th>Reading revisions / conversion versions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.months.map((m) => (
                        <tr key={m.month}>
                          <th>{m.month}</th>
                          <td>{value(m.kwh)}</td>
                          <td>{value(m.netCost, m.currency ?? '')}</td>
                          <td>{m.estimated}</td>
                          <td>
                            {m.evidence.map((e) => (
                              <p key={e.id}>
                                {e.id} · revision {e.revision} · meter {e.meterId} · {e.conversionVersion}
                              </p>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>Included meters: {r.meters.map((m) => `${m.name} (${m.id})`).join('; ') || 'None'}</p>
                <p>
                  Carbon scope: {result.definition.geography} · {result.definition.basis}
                </p>
                {r.energyTargets.map((t) => (
                  <p key={t.id}>
                    Energy target {t.id} · {t.month} · revision {t.revision} · {t.payload.energy} {t.payload.unit} ={' '}
                    {t.payload.normalizedKwh} kWh · factor {t.payload.conversionFactor} · {t.payload.source}
                  </p>
                ))}
                {r.targets.map((t) => (
                  <p key={t.id}>
                    Target {t.id} · revision {t.revision} · meter {t.meterId} · {t.limit} kgCO2e · {t.source}
                  </p>
                ))}
                {r.carbonMeters.map((m) => (
                  <p key={m.meterId}>
                    Meter {m.name} · {m.status} · saved run {m.runId ?? 'Unavailable'} ·{' '}
                    {m.issue ?? 'Current input versions'}
                  </p>
                ))}
                <Link href={`${base}/carbon`}>Inspect carbon calculations, factors and targets</Link>
              </details>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
