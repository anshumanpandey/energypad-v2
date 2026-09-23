'use client';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import type { AnalysisService } from '@/server/analysis/service';
import type { BaselineDefinition, ReadinessIssue } from '@/server/analysis/contract';
import type { RegressionResult } from '@/domain/analysis/regression';
import type { ReportingResult } from '@/domain/analysis/reporting';
type Options = Awaited<ReturnType<AnalysisService['options']>>;
type HistoryPage = Awaited<ReturnType<AnalysisService['history']>>;
type History = HistoryPage['items'];
type Baseline = {
  id: string;
  revision: number;
  inputHash: string;
  snapshot: { definition: BaselineDefinition; assembly: { warnings: ReadinessIssue[] } };
  fit: RegressionResult;
};
type SavedRun = {
  snapshot: { assembly: { warnings: ReadinessIssue[] } };
  id: string;
  inputHash: string;
  baseline: Baseline;
  result: { output: ReportingResult };
};
const labels = {
  HDD: 'Heating degree days',
  CDD: 'Cooling degree days',
  DAYLIGHT: 'Daylight hours',
  POPULATION: 'Population',
  OPERATING_HOURS: 'Operating hours',
};
function Issues({ issues }: { issues: ReadinessIssue[] }) {
  return issues.length ? (
    <ul className="analysis-issues">
      {issues.map((i, n) => (
        <li key={n}>
          <strong>{i.month ?? 'Baseline'}:</strong> {i.message}
        </li>
      ))}
    </ul>
  ) : null;
}
function warningLabel(code: string) {
  if (code.startsWith('EXTRAPOLATION:')) {
    const driver = code.split(':')[1];
    return `${labels[driver as keyof typeof labels] ?? driver} is outside the baseline range`;
  }
  if (code === 'NEGATIVE_PREDICTION') return 'Model predicts negative consumption';
  if (code === 'ZERO_SIGNIFICANCE_THRESHOLD') return 'Baseline error is zero; review significance policy';
  return code;
}
const number = (v: number | null) =>
  v === null ? 'Undefined' : v.toLocaleString(undefined, { maximumFractionDigits: 3 });
export function AnalysisWorkspace({
  orgId,
  sites,
  manage,
}: {
  orgId: string;
  sites: { id: string; name: string }[];
  manage: boolean;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  return (
    <div className="analysis-workspace stack-form">
      <div className="notice" role="note">
        <strong>Experimental analysis</strong>
        <span>
          Workbook and methodology review is still open. Results are unvalidated and are not verified savings.
        </span>
      </div>
      {!sites.length ? (
        <section className="panel">
          <h2>Add a site to get started</h2>
          <p>Record monthly consumption and drivers in Energy before creating a baseline.</p>
        </section>
      ) : (
        <>
          <label className="analysis-site">
            Analysis site
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <SiteAnalysis key={siteId} base={`organisations/${orgId}/sites/${siteId}/analysis`} manage={manage} />
        </>
      )}
    </div>
  );
}
function SiteAnalysis({ base, manage }: { base: string; manage: boolean }) {
  const m = useMutation();
  const [options, setOptions] = useState<Options | null>(null),
    [history, setHistory] = useState<History>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(''),
    [retry, setRetry] = useState(0);
  const [baseline, setBaseline] = useState<Baseline | null>(null),
    [run, setRun] = useState<SavedRun | null>(null);
  const [readiness, setReadiness] = useState<{
    ready: boolean;
    issues: ReadinessIssue[];
    warnings: ReadinessIssue[];
  } | null>(null);
  const [issues, setIssues] = useState<ReadinessIssue[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([request(`${base}/options`, 'GET'), request(`${base}/history`, 'GET')])
      .then(([o, h]) => {
        if (active) {
          setOptions(o);
          setHistory(h.items);
          setNextCursor(h.nextCursor);
          setLoadError('');
        }
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, retry]);
  async function refresh() {
    const page: HistoryPage = await request(`${base}/history`, 'GET');
    setHistory(page.items);
    setNextCursor(page.nextCursor);
  }
  if (loadError)
    return (
      <div className="notice error" role="alert">
        {loadError}
        <Button onClick={() => setRetry(retry + 1)}>Retry loading</Button>
      </div>
    );
  if (!options) return <p role="status">Loading analysis inputs…</p>;
  async function selectBaseline(id: string) {
    await m.run(async () => {
      setBaseline(await request(`${base}/baselines/${id}`, 'GET'));
      setRun(null);
      setIssues([]);
    }, 'Baseline loaded.');
  }
  return (
    <>
      {m.feedback}
      <section className="panel stack-form" aria-label="Baseline setup">
        <div>
          <span className="eyebrow">1 · BASELINE</span>
          <h2>Baseline setup</h2>
          <p>
            Select one to three drivers and a complete monthly period. Source revisions are preserved when you save.
          </p>
        </div>
        {!options.meters.length ? (
          <p>Add a meter and monthly consumption in Sites and Energy first.</p>
        ) : (
          <form
            aria-label="Baseline definition"
            className="stack-form"
            onChange={() => setReadiness(null)}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
              const drivers = f.getAll('drivers') as string[];
              const definition = {
                meterId: f.get('meterId'),
                energyUseId: f.get('energyUseId') || null,
                period: { firstMonth: f.get('firstMonth'), lastMonth: f.get('lastMonth') },
                drivers,
                weather: drivers.some((d) => ['HDD', 'CDD', 'DAYLIGHT'].includes(d))
                  ? { configurationId: f.get('weatherId'), methodology: 'daily-mean-degree-days-v1' }
                  : null,
                estimatedConsumption: f.get('estimatedConsumption'),
                supersedesId: f.get('supersedesId') || null,
                fitPolicy: { version: 'experimental-workflow-v1', relativeRankTolerance: 1e-10 },
              };
              void m.run(
                async () => {
                  setIssues([]);
                  if (action === 'check') {
                    setReadiness(await request(`${base}/readiness`, 'POST', definition));
                    return;
                  }
                  const result = await request(`${base}/baselines`, 'POST', definition);
                  if (result.status === 'BLOCKED') {
                    setIssues(result.issues);
                    throw new Error('Baseline could not be saved. Resolve the listed input issues.');
                  }
                  setBaseline(result.baseline);
                  setRun(null);
                  await refresh();
                },
                action === 'check' ? 'Readiness checked.' : 'Experimental baseline saved.',
              );
            }}
          >
            <fieldset className="form-grid" disabled={m.disabled}>
              <label>
                Meter
                <select name="meterId" required>
                  {options.meters.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} · {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Consumption end use
                <select name="energyUseId">
                  <option value="">Unassigned readings</option>
                  {options.uses.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} · {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Baseline first month
                <input type="month" name="firstMonth" required />
              </label>
              <label>
                Baseline last month
                <input type="month" name="lastMonth" required />
              </label>
              <label>
                Weather configuration
                <select name="weatherId">
                  <option value="">Select if using weather drivers</option>
                  {options.weather.map((w) => (
                    <option key={w.id} value={w.id}>
                      Version {w.version} · {w.source}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estimated consumption
                <select name="estimatedConsumption">
                  <option value="BLOCK">Block estimated readings</option>
                  <option value="ALLOW_WITH_WARNING">Allow with a warning</option>
                </select>
              </label>
              {manage && (
                <label>
                  Baseline to supersede (optional)
                  <select name="supersedesId">
                    <option value="">Create a new baseline</option>
                    {history.map((b) => (
                      <option key={b.id} value={b.id}>
                        Revision {b.revision} · {b.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
            <fieldset className="analysis-drivers" disabled={m.disabled}>
              <legend>Baseline drivers · select 1–3</legend>
              {Object.entries(labels).map(([code, label]) => (
                <label key={code}>
                  <input type="checkbox" name="drivers" value={code} />
                  {label}
                </label>
              ))}
            </fieldset>
            <p className="muted">
              Experimental fitting policy: relative rank tolerance 1 × 10⁻¹⁰. A ready baseline is not methodology
              approval.
            </p>
            <div className="analysis-actions">
              <Button type="submit" name="action" value="check" disabled={m.disabled}>
                Check readiness
              </Button>
              {manage && (
                <Button type="submit" name="action" value="save" disabled={m.disabled}>
                  Save experimental baseline
                </Button>
              )}
            </div>
          </form>
        )}
        {readiness && (
          <div role="status">
            <strong>{readiness.ready ? 'Inputs ready for experimental fitting' : 'Baseline needs attention'}</strong>
            <Issues issues={readiness.issues} />
            <Issues issues={readiness.warnings} />
          </div>
        )}
      </section>
      <Issues issues={issues} />
      <section className="panel stack-form" aria-label="Baseline and run history">
        <div>
          <span className="eyebrow">2 · SAVED EVIDENCE</span>
          <h2>Baseline and run history</h2>
        </div>
        {!history.length ? (
          <p>No saved baselines for this site yet.</p>
        ) : (
          <ul className="analysis-history">
            {history.map((b) => (
              <li key={b.id}>
                <div className="analysis-actions">
                  <Button variant="secondary" disabled={m.disabled} onClick={() => void selectBaseline(b.id)}>
                    Load baseline {b.id.slice(0, 8)}
                  </Button>
                  <span>
                    Revision {b.revision} · {new Date(b.createdAt).toLocaleDateString()} · Unvalidated
                  </span>
                </div>
                {b.supersedesId && <p>Supersedes {b.supersedesId.slice(0, 8)}</p>}
                {b.runs.map((r) => (
                  <Button
                    key={r.id}
                    variant="ghost"
                    disabled={m.disabled}
                    onClick={() =>
                      void m.run(async () => {
                        const saved = await request(`${base}/runs/${r.id}`, 'GET');
                        setRun(saved);
                        setBaseline(saved.baseline);
                        setIssues([]);
                      }, 'Saved run loaded without recalculation.')
                    }
                  >
                    View run {r.id.slice(0, 8)} · {new Date(r.createdAt).toLocaleDateString()}
                  </Button>
                ))}
                {b.nextRunCursor && (
                  <Button
                    variant="secondary"
                    disabled={m.disabled}
                    onClick={() =>
                      void m.run(async () => {
                        const page: Awaited<ReturnType<AnalysisService['runHistory']>> = await request(
                          `${base}/baselines/${b.id}/runs?cursor=${encodeURIComponent(b.nextRunCursor!)}`,
                          'GET',
                        );
                        setHistory((current) =>
                          current.map((item) =>
                            item.id !== b.id
                              ? item
                              : {
                                  ...item,
                                  runs: [
                                    ...item.runs,
                                    ...page.items.filter((r) => !item.runs.some((existing) => existing.id === r.id)),
                                  ],
                                  nextRunCursor: page.nextCursor,
                                },
                          ),
                        );
                      }, 'Older runs loaded.')
                    }
                  >
                    Load older runs for {b.id.slice(0, 8)}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {nextCursor && (
          <Button
            variant="secondary"
            disabled={m.disabled}
            onClick={() =>
              void m.run(async () => {
                const page: HistoryPage = await request(
                  `${base}/history?cursor=${encodeURIComponent(nextCursor)}`,
                  'GET',
                );
                setHistory((current) => [
                  ...current,
                  ...page.items.filter((item) => !current.some((existing) => existing.id === item.id)),
                ]);
                setNextCursor(page.nextCursor);
              }, 'Older baselines loaded.')
            }
          >
            Load older baselines
          </Button>
        )}
        <p className="muted">
          {history.length} baselines loaded. Newest entries appear first; saving refreshes the list to the latest
          entries.
        </p>
      </section>
      {baseline && (
        <>
          <section className="panel stack-form">
            <h2>Selected baseline · revision {baseline.revision}</h2>
            <p>
              {baseline.snapshot.definition.period.firstMonth} – {baseline.snapshot.definition.period.lastMonth} ·{' '}
              {baseline.snapshot.definition.drivers.map((d) => labels[d]).join(', ')}
            </p>
            {baseline.fit.status === 'FITTED' && (
              <div className="analysis-metrics">
                <div>
                  <span>R²</span>
                  <strong>{number(baseline.fit.rSquared)}</strong>
                </div>
                <div>
                  <span>Residual standard error</span>
                  <strong>{number(baseline.fit.residualStandardError)} kWh</strong>
                </div>
                <div>
                  <span>Observations</span>
                  <strong>{baseline.fit.rows.length}</strong>
                </div>
              </div>
            )}
            <details>
              <summary>Baseline provenance and diagnostics</summary>
              <p className="analysis-hash">Input hash: {baseline.inputHash}</p>
              <pre className="analysis-json">{JSON.stringify(baseline, null, 2)}</pre>
            </details>
          </section>
          {manage && (
            <RunForm
              key={baseline.id}
              baseline={baseline}
              issues={issues}
              disabled={m.disabled}
              submit={(input) =>
                m.run(async () => {
                  setIssues([]);
                  const result = await request(`${base}/baselines/${baseline.id}/runs`, 'POST', input);
                  if (result.status !== 'SAVED') {
                    setIssues(result.issues);
                    throw new Error('Reporting needs attention. No run was saved.');
                  }
                  setRun(await request(`${base}/runs/${result.run.id}`, 'GET'));
                  await refresh();
                }, 'Experimental reporting run saved.')
              }
            />
          )}
        </>
      )}
      {run && <RunResults run={run} />}
      {!manage && (
        <p className="notice">
          You can check readiness and read saved results. An Owner, Admin or Analyst can save baselines and runs.
        </p>
      )}
    </>
  );
}
function RunForm({
  baseline,
  disabled,
  issues,
  submit,
}: {
  baseline: Baseline;
  disabled: boolean;
  issues: ReadinessIssue[];
  submit: (input: unknown) => Promise<void>;
}) {
  const [nra, setNra] = useState('NONE');
  const [first, setFirst] = useState(''),
    [last, setLast] = useState('');
  const months: string[] = [];
  if (/^\d{4}-\d{2}$/.test(first) && /^\d{4}-\d{2}$/.test(last)) {
    let [y, m] = first.split('-').map(Number);
    while (months.length < 120) {
      const month = `${y}-${String(m).padStart(2, '0')}`;
      if (month > last) break;
      months.push(month);
      if (++m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return (
    <section className="panel stack-form">
      <span className="eyebrow">3 · REPORTING</span>
      <h2>Create reporting run</h2>
      <form
        aria-label="Reporting run"
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void submit({
            period: { firstMonth: first, lastMonth: last },
            policy: {
              version: 'experimental-workflow-v1',
              nra,
              significanceBasis: f.get('basis'),
              comparison: f.get('comparison'),
              sigmaMultiplier: 2,
              zeroThreshold: f.get('zeroThreshold'),
              negativePrediction: f.get('negativePrediction'),
              extrapolation: f.get('extrapolation'),
            },
            references:
              nra === 'NONE' ? [] : months.map((month) => ({ month, referenceMonth: f.get(`reference-${month}`) })),
          });
        }}
      >
        <fieldset className="form-grid" disabled={disabled}>
          <label>
            Reporting first month
            <input type="month" required value={first} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label>
            Reporting last month
            <input type="month" required value={last} onChange={(e) => setLast(e.target.value)} />
          </label>
          <label>
            Non-routine adjustment
            <select value={nra} onChange={(e) => setNra(e.target.value)}>
              <option value="NONE">None</option>
              <option value="HOURS">Operating hours</option>
              <option value="POPULATION">Population</option>
              <option value="HOURS_AND_POPULATION">Hours and population</option>
            </select>
          </label>
          <label>
            Significance basis
            <select name="basis">
              <option value="POST_NRA">After NRA</option>
              <option value="PRE_NRA">Before NRA</option>
            </select>
          </label>
          <label>
            Significance boundary
            <select name="comparison">
              <option value="AT_LEAST">At least 2 × baseline SE</option>
              <option value="GREATER_THAN">Greater than 2 × baseline SE</option>
            </select>
          </label>
          <label>
            Zero threshold
            <select name="zeroThreshold">
              <option value="UNDEFINED">Leave significance undefined</option>
              <option value="COMPARE_NONZERO">Compare nonzero variance</option>
            </select>
          </label>
          <label>
            Negative prediction
            <select name="negativePrediction">
              <option value="BLOCK">Block</option>
              <option value="ALLOW_WITH_WARNING">Allow with a warning</option>
            </select>
          </label>
          <label>
            Outside baseline driver range
            <select name="extrapolation">
              <option value="BLOCK">Block</option>
              <option value="ALLOW_WITH_WARNING">Allow with a warning</option>
            </select>
          </label>
        </fieldset>
        {nra !== 'NONE' && (
          <fieldset className="form-grid" disabled={disabled}>
            <legend>NRA reference months · choose a saved baseline month for each reporting month</legend>
            {months.map((month) => (
              <label key={month}>
                Reference for {month}
                <input
                  name={`reference-${month}`}
                  type="month"
                  required
                  min={baseline.snapshot.definition.period.firstMonth}
                  max={baseline.snapshot.definition.period.lastMonth}
                />
              </label>
            ))}
          </fieldset>
        )}
        <p className="muted">
          Review these experimental policies before saving. Significance uses twice the baseline residual standard
          error; the threshold is unchanged by NRA.
        </p>
        <Issues issues={issues} />
        <Button type="submit" disabled={disabled}>
          Save reporting run
        </Button>
      </form>
    </section>
  );
}
function RunResults({ run }: { run: SavedRun }) {
  const output = run.result.output;
  return (
    <section className="panel stack-form" aria-label="Reporting results">
      <h2>Reporting results · experimental</h2>
      <p>
        Run {run.id.slice(0, 8)} · Positive variance indicates saving; negative variance indicates waste. Results are
        unvalidated.
      </p>
      {output.status !== 'BLOCKED' && (
        <p>
          <strong>Saved reporting period:</strong> {output.inputSnapshot.period.firstMonth} –{' '}
          {output.inputSnapshot.period.lastMonth}. These results belong to the saved run, even if the form above has
          changed.
        </p>
      )}
      {!!run.baseline.snapshot.assembly.warnings.length && (
        <div role="note">
          <strong>Baseline input warnings</strong>
          <Issues issues={run.baseline.snapshot.assembly.warnings} />
        </div>
      )}
      {!!run.snapshot.assembly.warnings.length && (
        <div role="note">
          <strong>Reporting input warnings</strong>
          <Issues issues={run.snapshot.assembly.warnings} />
        </div>
      )}
      <div className="analysis-table" tabIndex={0} role="region" aria-label="Monthly reporting results">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Actual kWh</th>
              <th>Expected kWh</th>
              <th>NRA factor</th>
              <th>Adjusted kWh</th>
              <th>Before NRA variance kWh</th>
              <th>Final variance kWh</th>
              <th>Significance threshold kWh</th>
              <th>Significant</th>
              <th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            {output.rows.map((row) =>
              row.status === 'CALCULATED' ? (
                <tr key={row.month}>
                  <th>{row.month}</th>
                  <td>{number(row.actualKwh)}</td>
                  <td>{number(row.expectedKwh)}</td>
                  <td>{number(row.nraMultiplier)}</td>
                  <td>{number(row.adjustedExpectedKwh)}</td>
                  <td>{number(row.preNraVarianceKwh)}</td>
                  <td>
                    {number(row.postNraVarianceKwh)} · {row.direction.toLowerCase().replace('_', ' ')}
                  </td>
                  <td>{number(row.significance.thresholdKwh)}</td>
                  <td>
                    {row.significance.significant === null ? 'Undefined' : row.significance.significant ? 'Yes' : 'No'}{' '}
                    ({row.significance.basis === 'POST_NRA' ? 'after NRA' : 'before NRA'})
                  </td>
                  <td>{row.warnings.map(warningLabel).join('; ') || 'None'}</td>
                </tr>
              ) : (
                <tr key={row.month}>
                  <th>{row.month}</th>
                  <td colSpan={9}>Blocked</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {output.rows.some((row) => row.status === 'CALCULATED' && row.adjustments.length > 0) && (
        <div className="stack-form">
          <h3>NRA inputs used in this run</h3>
          <div className="analysis-table" tabIndex={0} role="region" aria-label="NRA reference inputs">
            <table>
              <thead>
                <tr>
                  <th>Reporting month</th>
                  <th>Adjustment</th>
                  <th>Reference month</th>
                  <th>Reference value</th>
                  <th>Reporting value</th>
                  <th>Ratio</th>
                </tr>
              </thead>
              <tbody>
                {output.rows.flatMap((row) =>
                  row.status === 'CALCULATED'
                    ? row.adjustments.map((a) => (
                        <tr key={`${row.month}-${a.kind}`}>
                          <th>{row.month}</th>
                          <td>{a.kind === 'OPERATING_HOURS' ? 'Operating hours' : 'Population'}</td>
                          <td>{a.referenceMonth}</td>
                          <td>
                            {number(a.referenceValue)} {a.kind === 'OPERATING_HOURS' ? 'hours' : 'people'}
                          </td>
                          <td>
                            {number(a.reportingValue)} {a.kind === 'OPERATING_HOURS' ? 'hours' : 'people'}
                          </td>
                          <td>{number(a.ratio)}</td>
                        </tr>
                      ))
                    : [],
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <details>
        <summary>Run provenance, policies and unrounded results</summary>
        <p className="analysis-hash">Input hash: {run.inputHash}</p>
        <pre className="analysis-json">{JSON.stringify(run, null, 2)}</pre>
      </details>
    </section>
  );
}
