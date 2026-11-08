import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMonth } from '@/domain/format-month';
import { calculateMonthlyPerformance } from '@/domain/analysis/monthly-performance';
import type { RegressionResult } from '@/domain/analysis/regression';
import type { ReportingResult } from '@/domain/analysis/reporting';
import type { Actor } from '@/server/foundation';
import { accessible } from '@/server/page-auth';
import { analysisService } from '@/server/services';
import { formatEnergyValue } from './format-energy-value';

const energy = (value: number | null) => (value === null ? 'Unavailable' : `${formatEnergyValue(value)} kWh`);

function modelLabel(model: 'HDD' | 'CDD' | 'HDD_AND_CDD' | 'UNSUPPORTED') {
  if (model === 'HDD_AND_CDD') return 'HDD + CDD';
  if (model === 'UNSUPPORTED') return 'Outside guide scope';
  return model;
}

export async function Performance({
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
  const text = (name: string) => (typeof query[name] === 'string' ? query[name] : undefined);
  const siteId = text('site') ?? sites[0]?.id;
  if (siteId && !sites.some((site) => site.id === siteId)) notFound();
  const site = sites.find((item) => item.id === siteId);
  const runs = siteId
    ? await accessible(() => analysisService.wasteRuns(actor, organisationId, siteId, { limit: 100 }))
    : null;
  const runId = text('run') ?? runs?.items[0]?.id;
  const run =
    runId && siteId ? await accessible(() => analysisService.readRun(actor, organisationId, siteId, runId)) : null;
  const report = (run?.result?.output as unknown as ReportingResult | undefined) ?? null;
  const fit = (run?.baseline.fit as unknown as RegressionResult | undefined) ?? null;
  const rows = report && fit ? calculateMonthlyPerformance(fit, report) : [];
  const calculated = rows.filter((row) => row.performanceKwh !== null);
  const savings = calculated.filter((row) => row.performanceKwh! > 0).length;
  const waste = calculated.filter((row) => row.performanceKwh! < 0).length;
  const flagged = calculated.filter((row) => row.significant).length;

  return (
    <div className="performance-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MONTHLY PERFORMANCE</span>
          <h1>Performance</h1>
          <p>Apply the developer-guide equations to a saved baseline and reporting run.</p>
        </div>
      </div>

      {!sites.length ? (
        <section className="panel performance-next-steps">
          <h2>Add a site and calculation</h2>
          <p>Performance needs a site, monthly consumption, weather inputs and a saved reporting run.</p>
          <Link className="button button-primary" href={`/org/${organisationId}/sites`}>
            Manage sites
          </Link>
        </section>
      ) : (
        <>
          <section className="panel performance-selection" aria-labelledby="performance-selection-title">
            <h2 id="performance-selection-title">Calculation selection</h2>
            <form method="get" className="stack-form" aria-label="Performance site">
              <label>
                Site
                <select name="site" defaultValue={siteId}>
                  {sites.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button-secondary" type="submit">
                Choose site
              </button>
            </form>
            {runs?.items.length ? (
              <form method="get" className="stack-form" aria-label="Performance reporting run">
                <input type="hidden" name="site" value={siteId} />
                <label>
                  Saved reporting run
                  <select name="run" defaultValue={runId}>
                    {runs.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id.slice(0, 8)} · {item.createdAt.toLocaleDateString('en-GB')} · {item.compatibility}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button button-primary" type="submit">
                  Load calculation
                </button>
              </form>
            ) : (
              <p>
                No saved reporting runs are available for {site?.name}. Create one in Advanced Analysis to calculate
                monthly performance.
              </p>
            )}
          </section>

          {run && report && fit?.status === 'FITTED' && (
            <>
              <section className="performance-summary" aria-label="Performance calculation summary">
                <div>
                  <span>Baseline coefficient c</span>
                  <strong>{energy(fit.intercept)}</strong>
                </div>
                <div>
                  <span>Residual standard error</span>
                  <strong>{energy(fit.residualStandardError)}</strong>
                </div>
                <div>
                  <span>Calculated months</span>
                  <strong>{calculated.length}</strong>
                </div>
                <div>
                  <span>Saving / waste months</span>
                  <strong>
                    {savings} / {waste}
                  </strong>
                </div>
                <div>
                  <span>Months flagged</span>
                  <strong>{flagged}</strong>
                </div>
              </section>

              <section className="panel performance-results" aria-labelledby="monthly-performance-results-title">
                <h2 id="monthly-performance-results-title">Calculated monthly performance</h2>
                <p>
                  Expected consumption and performance are recalculated from the saved baseline coefficients and the
                  reporting month&apos;s HDD/CDD inputs. Positive performance is a saving; negative performance is
                  waste.
                </p>
                <div
                  className="analysis-table performance-table"
                  role="region"
                  aria-label="Calculated performance results"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Model</th>
                        <th scope="col">Actual</th>
                        <th scope="col">Heating component</th>
                        <th scope="col">Cooling component</th>
                        <th scope="col">Expected</th>
                        <th scope="col">
                          Performance
                          <br />
                          (expected − actual)
                        </th>
                        <th scope="col">Baseline baseload</th>
                        <th scope="col">Implied baseload</th>
                        <th scope="col">Baseload anomaly</th>
                        <th scope="col">Significance flag</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.month}>
                          <th scope="row">{formatMonth(row.month)}</th>
                          <td>{modelLabel(row.model)}</td>
                          <td>{energy(row.actualKwh)}</td>
                          <td>{energy(row.heatingComponentKwh)}</td>
                          <td>{energy(row.coolingComponentKwh)}</td>
                          <td>{energy(row.expectedKwh)}</td>
                          <td>
                            {energy(row.performanceKwh)}
                            {row.performanceKwh !== null && (
                              <small
                                className={
                                  row.performanceKwh > 0
                                    ? 'performance-saving'
                                    : row.performanceKwh < 0
                                      ? 'performance-waste'
                                      : ''
                                }
                              >
                                {row.performanceKwh > 0 ? 'Saving' : row.performanceKwh < 0 ? 'Waste' : 'No change'}
                              </small>
                            )}
                          </td>
                          <td>{energy(row.baselineBaseloadKwh)}</td>
                          <td>{energy(row.impliedBaseloadKwh)}</td>
                          <td>{energy(row.baseloadAnomalyKwh)}</td>
                          <td>
                            {row.significant === null
                              ? 'Unavailable'
                              : `${row.significant ? 'Flagged' : 'Within threshold'} (${energy(row.significanceThresholdKwh)})`}
                          </td>
                          <td>{row.issues.length ? row.issues.join(' ') : 'Calculated'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">
                  A saved run remains experimental and unvalidated. This view does not alter its stored result,
                  compatibility or evidence.
                </p>
              </section>
            </>
          )}
        </>
      )}

      <section className="panel performance-introduction" aria-labelledby="performance-method-title">
        <h2 id="performance-method-title">Formula reference</h2>
        <p>
          Fixed baseline coefficients apply to every reporting month. Use the calculation only after the selected
          regression model passes its required R², coefficient p-value and model-error checks.
        </p>
        <div
          className="analysis-table performance-table"
          role="region"
          aria-label="Monthly performance model"
          tabIndex={0}
        >
          <table>
            <caption>Monthly space-conditioning performance model</caption>
            <thead>
              <tr>
                <th scope="col">Data item</th>
                <th scope="col">Heating-only model</th>
                <th scope="col">Cooling-only model</th>
                <th scope="col">Combined HDD + CDD model</th>
                <th scope="col">Interpretation and control</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Expected consumption</th>
                <td>c + b × HDD</td>
                <td>c + b × CDD</td>
                <td>b₀ + (b₁ × HDD) + (b₂ × CDD)</td>
                <td>The fixed baseline expectation for the reporting month, in kWh.</td>
              </tr>
              <tr>
                <th scope="row">Space-conditioning component</th>
                <td>b × HDD</td>
                <td>b × CDD</td>
                <td>Heating: b₁ × HDD; cooling: b₂ × CDD</td>
                <td>
                  Use a heating or cooling label only when the meter is dedicated to, or dominated by, that end use.
                </td>
              </tr>
              <tr>
                <th scope="row">Current implied baseload</th>
                <td>Actual − (b × HDD)</td>
                <td>Actual − (b × CDD)</td>
                <td>Actual − (b₁ × HDD) − (b₂ × CDD)</td>
                <td>The current non-weather portion of consumption.</td>
              </tr>
              <tr>
                <th scope="row">Baseload anomaly</th>
                <td>Current implied baseload − c</td>
                <td>Current implied baseload − c</td>
                <td>Current implied baseload − b₀</td>
                <td>
                  Positive means above baseline and negative means below baseline. It is diagnostic only and is never
                  added to saving or waste.
                </td>
              </tr>
              <tr>
                <th scope="row">Significance and boundary</th>
                <td colSpan={3}>Flag only when |saving/waste| ≥ 2 × SEreg.</td>
                <td>
                  A combined HDD + CDD meter has one total variance. Do not allocate it to heating, cooling or baseload
                  without suitable submeters or an agreed end-use method.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel performance-next-steps" aria-labelledby="performance-next-steps-title">
        <h2 id="performance-next-steps-title">Run a monthly calculation</h2>
        <p>
          Set up a baseline and reporting run with the relevant HDD and CDD inputs, then return here to inspect the
          results.
        </p>
        <div className="button-row">
          <Link className="button button-primary" href={`/org/${organisationId}/analysis`}>
            Open Advanced Analysis
          </Link>
          <Link className="button button-secondary" href={`/org/${organisationId}/waste-savings`}>
            View Waste &amp; Savings
          </Link>
        </div>
      </section>
    </div>
  );
}
