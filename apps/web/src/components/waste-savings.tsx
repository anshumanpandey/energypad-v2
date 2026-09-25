import type { CarbonSnapshot } from '@/domain/carbon';
import { DomainError } from '@/domain/policy';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { analysisService, carbonService } from '@/server/services';
import type { Actor } from '@/server/foundation';
import { accessible } from '@/server/page-auth';
import { Button } from './ui/button';

export async function WasteSavings({
  actor,
  organisationId,
  query,
}: {
  actor: Actor;
  organisationId: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const base = `/org/${organisationId}`;
  const text = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : undefined);
  const sites = await accessible(() => analysisService.historySites(actor, organisationId));
  const siteId = text('site') ?? sites[0]?.id;
  if (siteId && !sites.some((s) => s.id === siteId)) notFound();
  const page = siteId
    ? await accessible(() =>
        analysisService.wasteRuns(actor, organisationId, siteId, { cursor: text('cursor'), limit: 20 }),
      )
    : null;
  const runId = text('run') ?? page?.items[0]?.id;
  let report: Awaited<ReturnType<typeof analysisService.wasteSummary>> | null = null;
  let impactError: string | null = null;
  if (siteId && runId) {
    try {
      report = await accessible(() =>
        analysisService.wasteSummary(actor, organisationId, siteId, runId, text('carbon') || undefined),
      );
    } catch (error) {
      if (error instanceof DomainError && error.status === 400) impactError = error.message;
      else throw error;
    }
  }
  const carbonRuns = siteId ? await accessible(() => carbonService.history(actor, organisationId, siteId)) : [];
  const carbonOptions = carbonRuns.map((run) => ({ id: run.id, snapshot: run.snapshot as unknown as CarbonSnapshot }));
  const value = (v: string | number | null, unit = '') => (v === null ? 'Unavailable' : `${v} ${unit}`);
  return (
    <div className="waste-savings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPECTED VERSUS ACTUAL</span>
          <h1>Waste &amp; Savings</h1>
          <p>Inspect one saved reporting run and the evidence behind its impacts.</p>
        </div>
      </div>
      <section className="panel stack-form">
        <strong>Experimental · not verified savings</strong>
        <p>
          Positive variance indicates saving; negative variance indicates waste. Methodology approval remains open.
          Monthly significance follows the saved run’s policy; it does not validate savings or establish statistical
          significance for the total.
        </p>
        <Link href={`${base}/analysis`}>Open Advanced Analysis to create or review a run</Link>
      </section>
      {!sites.length ? (
        <section className="panel">
          <p>Add a site and save an analysis run to begin.</p>
          <Link href={`${base}/sites`}>Manage sites</Link>
        </section>
      ) : (
        <>
          <form className="panel stack-form" method="get">
            <label>
              Analysis site
              <select name="site" defaultValue={siteId}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">Choose site</Button>
          </form>
          <form className="panel stack-form" method="get" aria-label="Saved impact evidence">
            <input type="hidden" name="site" value={siteId} />
            {text('cursor') && <input type="hidden" name="cursor" value={text('cursor')} />}
            <label>
              Saved analysis run
              <input
                name="run"
                list="waste-runs"
                required
                defaultValue={runId}
                placeholder="Select or paste a saved run ID"
              />
            </label>
            <datalist id="waste-runs">
              {page?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.createdAt.toISOString()} · meter {r.meterId} · baseline {r.baselineId}
                </option>
              ))}
            </datalist>
            <label>
              Saved carbon run (optional)
              <input
                name="carbon"
                list="waste-carbon-runs"
                defaultValue={text('carbon')}
                placeholder="Select or paste a carbon run ID"
              />
            </label>
            <datalist id="waste-carbon-runs">
              {carbonOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.snapshot.meter.name} · {r.snapshot.definition.year} · {r.snapshot.definition.geography} ·{' '}
                  {r.snapshot.definition.basis}
                </option>
              ))}
            </datalist>
            <p>
              Carbon suggestions contain the latest 50 site runs. Any accessible saved ID can be pasted. Select the same
              meter and matching reading revisions; unmatched months remain unavailable. No current factor is silently
              substituted.
            </p>
            <Button type="submit">Show impacts</Button>
          </form>
          <section className="panel stack-form">
            <h2>Saved runs</h2>
            {!page?.items.length && <p>No saved analysis runs for this site.</p>}
            <ul>
              {page?.items.map((r) => (
                <li key={r.id}>
                  <Link href={`${base}/waste-savings?site=${siteId}&run=${r.id}`}>
                    {r.createdAt.toISOString()} · {r.id}
                  </Link>
                  <small>
                    {' '}
                    · meter {r.meterId} · {r.compatibility}
                  </small>
                </li>
              ))}
            </ul>
            {page?.nextCursor && (
              <Link href={`${base}/waste-savings?site=${siteId}&cursor=${page.nextCursor}`}>Older saved runs</Link>
            )}
            {text('cursor') && <Link href={`${base}/waste-savings?site=${siteId}`}>Newest saved runs</Link>}
          </section>
          {impactError && <p role="alert">{impactError}</p>}
          {report && (
            <>
              <section className="panel stack-form" aria-label="Impact summary">
                <h2>Saved period summary</h2>
                <Link
                  href={`${base}/opportunities?site=${siteId}&run=${report.runId}${report.carbonRunId ? `&carbon=${report.carbonRunId}` : ''}`}
                >
                  Create an investigation from this evidence
                </Link>
                <p>
                  {report.output.status !== 'BLOCKED'
                    ? `${report.output.inputSnapshot.period.firstMonth} – ${report.output.inputSnapshot.period.lastMonth}`
                    : 'Blocked result'}{' '}
                  · {report.compatibility}
                </p>
                <div className="stat-grid overview-kpis">
                  <div className="stat-card">
                    <span>Energy variance · before / after NRA</span>
                    <strong>{value(report.impact.preKwh, 'kWh')}</strong>
                    <strong>{value(report.impact.postKwh, 'kWh')}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Estimated financial impact · before / after NRA</span>
                    <strong>{value(report.impact.preCost, report.impact.currency ?? '')}</strong>
                    <strong>{value(report.impact.postCost, report.impact.currency ?? '')}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Estimated carbon impact · before / after NRA</span>
                    <strong>{value(report.impact.preCarbon, 'kgCO2e')}</strong>
                    <strong>{value(report.impact.postCarbon, 'kgCO2e')}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Significant months</span>
                    <strong>{report.impact.significantMonths}</strong>
                    <small>
                      Uses each month’s saved significance basis and threshold. Blocked/undefined months are not counted
                      as significant.
                    </small>
                  </div>
                </div>
                <p>
                  Financial estimates multiply signed variance by the original reading’s net cost ÷ normalised kWh. VAT
                  is excluded. This average rate can include fixed charges and is not a marginal tariff or a bill
                  saving. Zero consumption, missing costs and mixed currencies suppress financial totals.
                </p>
                <p>
                  Carbon estimates multiply signed variance by the factor pinned in the selected carbon run. Missing or
                  different reading revisions suppress affected values. These are historical scenario estimates, not a
                  current inventory. Totals require every month; blocked months never count as zero.
                </p>
                {report.carbonDefinition && (
                  <p>
                    Carbon scope: {report.carbonDefinition.year} · {report.carbonDefinition.geography} ·{' '}
                    {report.carbonDefinition.basis}
                  </p>
                )}
              </section>
              <section className="panel stack-form">
                <h2>Monthly waste and saving</h2>
                <div
                  className="analysis-table"
                  tabIndex={0}
                  role="region"
                  aria-label="Waste and savings monthly results"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Actual kWh</th>
                        <th>Expected kWh</th>
                        <th>Adjusted expected kWh</th>
                        <th>Pre-NRA variance kWh</th>
                        <th>Post-NRA variance kWh</th>
                        <th>Direction</th>
                        <th>Significance</th>
                        <th>Financial impact pre / post</th>
                        <th>Carbon impact pre / post</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.impact.rows.map((r) =>
                        r.status === 'BLOCKED' ? (
                          <tr key={r.month}>
                            <th>{r.month}</th>
                            <td colSpan={9}>Blocked: {r.issues.map((i) => i.message).join('; ')}</td>
                          </tr>
                        ) : (
                          <tr key={r.month}>
                            <th>{r.month}</th>
                            <td>{r.actualKwh}</td>
                            <td>{r.expectedKwh}</td>
                            <td>{r.adjustedExpectedKwh}</td>
                            <td>{r.preNraVarianceKwh}</td>
                            <td>{r.postNraVarianceKwh}</td>
                            <td>{r.direction.replace('_', ' ')}</td>
                            <td>
                              {r.significance.significant === null
                                ? 'Undefined'
                                : r.significance.significant
                                  ? 'Significant'
                                  : 'Not significant'}{' '}
                              · {r.significance.basis} · threshold {r.significance.thresholdKwh} kWh
                            </td>
                            <td>
                              {value(r.preCost, r.currency ?? '')} / {value(r.postCost, r.currency ?? '')}
                            </td>
                            <td>
                              {value(r.preCarbon, 'kgCO2e')} / {value(r.postCarbon, 'kgCO2e')}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                {report.output.issues.map((i, n) => (
                  <p key={n}>
                    {i.month}: {i.message}
                  </p>
                ))}
              </section>
              <section className="panel stack-form">
                <h2>Immutable evidence and assumptions</h2>
                <p>
                  Run {report.runId} · baseline {report.baselineId} · meter {report.meterId} · saved {report.createdAt}
                </p>
                <p>Input hash: {report.inputHash}</p>
                <p>
                  Reporting algorithm: {report.output.algorithm} · impact method: {report.impact.version} · carbon run:{' '}
                  {report.carbonRunId ?? 'Not selected'} · carbon algorithm: {report.carbonAlgorithm ?? 'Not selected'}
                </p>
                {report.impact.rows.map(
                  (r) =>
                    r.status === 'CALCULATED' && (
                      <details key={r.month}>
                        <summary>
                          {r.month} source evidence{r.reading?.estimated ? ' · estimated reading' : ''}
                        </summary>
                        <p>
                          Reading {r.consumptionId} · revision {r.reading?.revision ?? 'Unavailable'} · conversion{' '}
                          {r.reading?.conversionVersion ?? 'Unavailable'}
                        </p>
                        <p>Net cost rate: {value(r.rate, `${r.currency ?? ''}/kWh`)}</p>
                        <p>
                          Factor {r.factor?.factorId ?? 'Unavailable'} · revision{' '}
                          {r.factor?.factorRevision ?? 'Unavailable'} · {r.factor?.factor ?? 'Unavailable'} kgCO2e/kWh ·
                          source {r.factor?.source ?? 'Unavailable'}
                        </p>
                        <p>
                          NRA multiplier {r.nraMultiplier}; warnings: {r.warnings.join('; ') || 'None'}
                        </p>
                        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {JSON.stringify(r.adjustments, null, 2)}
                        </pre>
                      </details>
                    ),
                )}
                <details>
                  <summary>Saved model and reporting policy</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {JSON.stringify(
                      {
                        model: report.model,
                        policy: report.output.status !== 'BLOCKED' ? report.output.inputSnapshot.policy : null,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
