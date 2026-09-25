import Link from 'next/link';
import { carbonService, siteService, foundation } from '@/server/services';
import type { Actor } from '@/server/foundation';
import { accessible } from '@/server/page-auth';
import { carbonTrendInput, trendChange } from '@/domain/carbon-trends';
import { factorBases } from '@/domain/emission-factors';
import { Button } from './ui/button';
type Result = Awaited<ReturnType<typeof carbonService.trends>>;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function TrendChart({ series }: { series: Result['series'] }) {
  const values = series.flatMap((s) => s.months.flatMap((m) => (m.kgCO2e === null ? [] : [Number(m.kgCO2e)])));
  if (!values.length) return <p>No months with complete current coverage. The tables below show what is missing.</p>;
  const max = Math.max(1, ...values);
  const x = (i: number) => 65 + i * 54;
  const y = (v: string) => 245 - (Number(v) / max) * 210;
  const colors = ['#aa5716', '#23634c'];
  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox="0 0 720 290"
        role="img"
        aria-label="Monthly carbon comparison chart in kgCO2e"
        style={{ width: '100%', minWidth: 300 }}
      >
        <title>Monthly carbon emissions. Gaps indicate unavailable totals, not zero.</title>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line x1="65" x2="660" y1={245 - fraction * 210} y2={245 - fraction * 210} stroke="#d8e0d8" />
            <text x="58" y={249 - fraction * 210} fontSize="11" textAnchor="end">
              {(max * fraction).toPrecision(3)}
            </text>
          </g>
        ))}
        {monthNames.map((m, i) => (
          <text key={m} x={x(i)} y="269" textAnchor="middle" fontSize="12">
            {m}
          </text>
        ))}
        {series.map((s, j) => (
          <g key={s.year} stroke={colors[j]} fill={colors[j]}>
            {s.months.map((m, i) =>
              m.kgCO2e === null ? null : (
                <g key={i}>
                  {i > 0 && s.months[i - 1].kgCO2e !== null && (
                    <line
                      x1={x(i - 1)}
                      y1={y(s.months[i - 1].kgCO2e!)}
                      x2={x(i)}
                      y2={y(m.kgCO2e)}
                      strokeWidth="2"
                      strokeDasharray={j === 0 ? '5 3' : undefined}
                    />
                  )}
                  <circle cx={x(i)} cy={y(m.kgCO2e)} r={j === 0 ? 5 : 3}>
                    <title>{`${s.year} ${monthNames[i]}: ${m.kgCO2e} kgCO2e`}</title>
                  </circle>
                </g>
              ),
            )}
          </g>
        ))}
      </svg>
      <figcaption>
        {series[0].year}: orange dashed line · {series[1].year}: green solid line. Missing months break the lines. Exact
        values and coverage follow.
      </figcaption>
    </figure>
  );
}
export async function CarbonTrends({
  actor,
  organisationId,
  query,
}: {
  actor: Actor;
  organisationId: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const [sites, portfolios] = await Promise.all([
    foundation.listSites(actor, organisationId),
    siteService.portfolios(actor, organisationId),
  ]);
  const text = (key: string, fallback = '') => (typeof query[key] === 'string' ? (query[key] as string) : fallback);
  const scope = text('scope', sites[0] ? `site:${sites[0].id}` : portfolios[0] ? `portfolio:${portfolios[0].id}` : '');
  const [kind, id] = scope.split(':');
  const year = Number(text('year', String(new Date().getUTCFullYear())));
  const input = carbonTrendInput.safeParse({
    kind,
    id,
    year,
    comparisonYear: Number(text('comparisonYear', String(year === 1900 ? 1901 : year - 1))),
    geography: text('geography', 'GB'),
    basis: text('basis', 'LOCATION_BASED'),
  });
  const result = input.success ? await accessible(() => carbonService.trends(actor, organisationId, input.data)) : null;
  const base = `/org/${organisationId}`;
  const value = (v: string | null) => (v === null ? 'Unavailable' : `${v} kgCO2e`);
  return (
    <div className="waste-savings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CARBON COMPARISONS</span>
          <h1>Carbon trends</h1>
          <p>
            Compare monthly emissions and annual totals across two years with consistent scope and visible evidence.
          </p>
        </div>
      </div>
      <form method="get" className="panel stack-form" aria-label="Carbon trend filters">
        <div className="form-grid">
          <label>
            Trend scope
            <select name="scope" defaultValue={scope} required>
              <optgroup label="Sites">
                {sites.map((s) => (
                  <option key={s.id} value={`site:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Portfolios">
                {portfolios.map((p) => (
                  <option key={p.id} value={`portfolio:${p.id}`}>
                    {p.name} (portfolio)
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label>
            Reporting year
            <input name="year" type="number" min="1900" max="2199" defaultValue={year} required />
          </label>
          <label>
            Comparison year
            <input
              name="comparisonYear"
              type="number"
              min="1900"
              max="2199"
              defaultValue={text('comparisonYear', String(year === 1900 ? 1901 : year - 1))}
              required
            />
          </label>
          <label>
            Trend geography
            <input name="geography" required pattern="[A-Za-z0-9_-]{2,40}" defaultValue={text('geography', 'GB')} />
          </label>
          <label>
            Trend reporting basis
            <select name="basis" defaultValue={text('basis', 'LOCATION_BASED')}>
              {factorBases.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
        </div>
        <Button type="submit">Compare carbon trends</Button>
      </form>
      {!sites.length && !portfolios.length ? (
        <p>No accessible sites or portfolios. Add a site to begin.</p>
      ) : (
        !input.success && (
          <p role="alert">Select a scope, two different years from 1900 to 2199, geography and reporting basis.</p>
        )
      )}
      {result && (
        <>
          <section className="panel stack-form" aria-label="Carbon trend summary">
            <h2>{result.name}</h2>
            <p>
              {result.scope} · {result.definition.geography} · {result.definition.basis} · checked {result.checkedAt}
            </p>
            <p>
              Both years use the same current active sites and meters, including current portfolio membership and your
              access scope. This is not a reconstruction of historical portfolio membership. Main/submeter overlap is
              not deducted; totals describe registered meters, not a net inventory.
            </p>
            <p>
              Each month uses the latest matching saved run per meter. Usable months from incomplete annual runs remain
              visible; missing, blocked or outdated monthly inputs create gaps. Annual totals and changes require all
              twelve months. Changes reflect both energy and emission factors, not verified savings.
            </p>
            <div className="stat-grid overview-kpis">
              {result.series.map((s) => (
                <div className="stat-card" key={s.year}>
                  <span>{s.year} annual emissions</span>
                  <strong>{value(s.totalKgCO2e)}</strong>
                  <small>{s.months.filter((m) => m.kgCO2e !== null).length}/12 complete months</small>
                </div>
              ))}
              <div className="stat-card">
                <span>
                  {result.definition.year} minus {result.definition.comparisonYear}
                </span>
                <strong>{value(result.change.difference)}</strong>
                <small>
                  {result.change.percent === null
                    ? 'Percentage unavailable (missing data or zero comparison total).'
                    : `${Number(result.change.percent).toPrecision(6)}% change`}
                </small>
              </div>
            </div>
            <TrendChart series={result.series} />
          </section>
          <section className="panel stack-form">
            <h2>Monthly comparison</h2>
            <div className="analysis-table" role="region" aria-label="Monthly carbon trends" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    {result.series.map((s) => (
                      <th key={s.year}>{s.year} kgCO2e / coverage</th>
                    ))}
                    <th>Difference kgCO2e</th>
                  </tr>
                </thead>
                <tbody>
                  {monthNames.map((m, i) => (
                    <tr key={m}>
                      <th>{m}</th>
                      {result.series.map((s) => (
                        <td key={s.year}>
                          {value(s.months[i].kgCO2e)}
                          <p>
                            {s.months[i].readySites}/{s.months[i].expectedSites} sites ready · {s.months[i].readyMeters}
                            /{s.months[i].expectedMeters} meters ready · {s.months[i].estimated} estimated readings in
                            ready data
                          </p>
                        </td>
                      ))}
                      <td>
                        {value(
                          trendChange(result.series[1].months[i].kgCO2e, result.series[0].months[i].kgCO2e).difference,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel stack-form">
            <h2>Site comparison</h2>
            <div className="analysis-table" role="region" aria-label="Carbon trends by site" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    {result.series.map((s) => (
                      <th key={s.year}>{s.year} total / complete months</th>
                    ))}
                    <th>Difference kgCO2e</th>
                  </tr>
                </thead>
                <tbody>
                  {result.series[0].sites.map((site, i) => (
                    <tr key={site.id}>
                      <th>
                        <Link
                          href={`${base}/carbon-trends?scope=site:${site.id}&year=${year}&comparisonYear=${result.definition.comparisonYear}&geography=${result.definition.geography}&basis=${result.definition.basis}`}
                        >
                          {site.name}
                        </Link>
                      </th>
                      {result.series.map((s) => (
                        <td key={s.year}>
                          {value(s.sites[i].totalKgCO2e)} ·{' '}
                          {s.sites[i].months.filter((m) => m.status === 'COMPLETE').length}/12
                        </td>
                      ))}
                      <td>{value(trendChange(result.series[1].sites[i].totalKgCO2e, site.totalKgCO2e).difference)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel stack-form">
            <h2>Coverage and saved evidence</h2>
            <p>
              View each month’s status and immutable source versions. Historical evidence remains unchanged after
              corrections; stale values are excluded from current trend totals. Trend method: {result.version}.
            </p>
            {result.series.map((s) => (
              <details key={s.year}>
                <summary>{s.year} evidence</summary>
                {s.sites.map((site) => (
                  <details key={site.id}>
                    <summary>{site.name}</summary>
                    {site.months.map((m) => (
                      <details key={m.month}>
                        <summary>
                          {m.month} · {m.status} · {value(m.kgCO2e)}
                        </summary>
                        {!m.meters.length && <p>No active meters in this site.</p>}
                        {m.meters.map((meter) => (
                          <div key={meter.meterId}>
                            <strong>
                              {meter.name} · {meter.status}
                            </strong>
                            <p>{meter.issue}</p>
                            <p>
                              Run {meter.runId ?? 'Unavailable'} · {meter.calculatedAt} · {meter.algorithm}
                            </p>
                            {meter.evidence && (
                              <p>
                                Reading {meter.evidence.readingId ?? 'Unavailable'} · revision{' '}
                                {meter.evidence.readingRevision} · conversion {meter.evidence.conversionVersion} ·{' '}
                                {meter.evidence.estimated ? 'Estimated' : 'Not marked estimated'}
                                <br />
                                Factor {meter.evidence.factorId ?? 'Unavailable'} · revision{' '}
                                {meter.evidence.factorRevision} · {meter.evidence.factor} kgCO2e/kWh ·{' '}
                                {meter.evidence.source}
                                <br />
                                Saved monthly result: {value(meter.evidence.kgCO2e ?? null)}
                              </p>
                            )}
                          </div>
                        ))}
                      </details>
                    ))}
                  </details>
                ))}
              </details>
            ))}
            <Link href={`${base}/carbon`}>Open carbon calculations and exports</Link>
          </section>
        </>
      )}
    </div>
  );
}
