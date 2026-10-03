'use client';
import { useEnergyYear } from './energy-year';
import { formatEnergyValue } from './format-energy-value';
import { WasteDirection } from './waste-direction';
import { DateInput } from './ui/date-input';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { NraReviewPanel, type NraReviewRecord } from './nra-review';
import { BaselineDiagnostics } from './baseline-diagnostics';
import { request, useMutation } from './forms';
import { weatherConfigurationSaved } from './weather-events';
import type { AnalysisService } from '@/server/analysis/service';
import type { BaselineDefinition, ReadinessIssue } from '@/server/analysis/contract';
import type { RegressionInterpretation } from '@/domain/analysis/interpretation';
import type { RegressionResult } from '@/domain/analysis/regression';
import type { ReportingResult } from '@/domain/analysis/reporting';
type Options = Awaited<ReturnType<AnalysisService['options']>>;
type HistoryPage = Awaited<ReturnType<AnalysisService['history']>>;
type History = HistoryPage['items'];
type Baseline = {
  id: string;
  revision: number;
  inputHash: string;
  snapshot: {
    definition: BaselineDefinition;
    interpretation?: RegressionInterpretation;
    assembly: { warnings: ReadinessIssue[]; rows: { consumption: { id: string; month: string } }[] };
  };
  fit: RegressionResult;
};
type SavedRun = {
  authorId: string;
  reviews: NraReviewRecord[];
  snapshot: {
    assembly: { warnings: ReadinessIssue[] };
    request: { policy: { nra: string }; nraContext?: { rationale: string; evidence: string[] } | null };
  };
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
const number = (v: number | null) => formatEnergyValue(v, 'Undefined');
export function AnalysisWorkspace({
  orgId,
  sites,
  manage,
  approve,
  actorId,
  wizard = false,
}: {
  wizard?: boolean;
  orgId: string;
  approve: boolean;
  actorId: string;
  sites: { id: string; name: string; archived: boolean }[];
  manage: boolean;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const selection = useEnergyYear();
  const reportingYear = wizard ? (selection?.year ?? new Date().getUTCFullYear()) : undefined;
  const archived = sites.find((s) => s.id === siteId)?.archived ?? false;
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
          <h2>{wizard ? 'Add a site to create a waste report' : 'Add a site to get started'}</h2>
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
                  {s.archived ? ' · Archived' : ''}
                </option>
              ))}
            </select>
          </label>
          <SiteAnalysis
            key={`${siteId}:${archived}:${reportingYear}`}
            reportingYear={reportingYear}
            base={`organisations/${orgId}/sites/${siteId}/analysis`}
            manage={manage && !archived}
            archived={archived}
            approve={approve && !archived}
            actorId={actorId}
            wizard={wizard}
          />
        </>
      )}
    </div>
  );
}
function SiteAnalysis({
  reportingYear,
  base,
  manage,
  archived,
  approve,
  actorId,
  wizard,
}: {
  reportingYear?: number;
  wizard: boolean;
  base: string;
  manage: boolean;
  archived: boolean;
  approve: boolean;
  actorId: string;
}) {
  const m = useMutation();
  const [step, setStep] = useState(0);
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
  const [weatherOptionsError, setWeatherOptionsError] = useState('');
  useEffect(() => {
    if (archived) return;
    let active = true;
    let sequence = 0;
    async function updateWeather(event: Event) {
      const detail = (event as CustomEvent<{ base: string }>).detail;
      if (detail?.base !== base.replace(/\/analysis$/, '/energy/weather')) return;
      const current = ++sequence;
      try {
        const refreshed: Options = await request(`${base}/options`, 'GET');
        if (active && current === sequence) {
          setOptions((previous) => (previous ? { ...previous, weather: refreshed.weather } : refreshed));
          setWeatherOptionsError('');
        }
      } catch {
        if (active && current === sequence)
          setWeatherOptionsError('Could not refresh weather configurations. Reload the page to try again.');
      }
    }
    window.addEventListener(weatherConfigurationSaved, updateWeather);
    return () => {
      active = false;
      window.removeEventListener(weatherConfigurationSaved, updateWeather);
    };
  }, [base, archived]);
  useEffect(() => {
    let active = true;
    Promise.all([
      archived ? Promise.resolve({ meters: [], uses: [], weather: [] }) : request(`${base}/options`, 'GET'),
      request(`${base}/history`, 'GET'),
    ])
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
  }, [base, retry, archived]);
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
      setStep(1);
    }, 'Baseline loaded.');
  }
  return (
    <>
      {wizard && (
        <nav className="waste-report-steps" aria-label="Waste Report steps">
          {['Baseline', 'Reporting period', 'Results'].map((label, index) => (
            <button
              key={label}
              type="button"
              aria-current={step === index ? 'step' : undefined}
              disabled={m.disabled || (index === 1 && !baseline) || (index === 2 && !run)}
              onClick={() => setStep(index)}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>
      )}
      {m.feedback}
      <div hidden={wizard && step !== 0} className="stack-form">
        {archived && (
          <div className="notice" role="note">
            Archived site · Saved baselines and runs are available for review. New calculations are disabled.
          </div>
        )}
        {!archived && (
          <section className="panel stack-form" aria-label="Baseline setup">
            <div>
              <span className="eyebrow">1 · BASELINE</span>
              <h2>Baseline setup</h2>
              <p>
                {reportingYear
                  ? `The baseline uses January–December ${reportingYear - 1}, the year before the selected reporting year (${reportingYear}). Select one to three drivers.`
                  : 'Select one to three drivers and a complete monthly period. Source revisions are preserved when you save.'}
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
                    period: reportingYear
                      ? { firstMonth: `${reportingYear - 1}-01`, lastMonth: `${reportingYear - 1}-12` }
                      : {
                          firstMonth: String(f.get('firstMonth')).slice(0, 7),
                          lastMonth: String(f.get('lastMonth')).slice(0, 7),
                        },
                    drivers,
                    weather: drivers.some((d) => ['HDD', 'CDD', 'DAYLIGHT'].includes(d))
                      ? { configurationId: f.get('weatherId'), methodology: 'daily-mean-degree-days-v1' }
                      : null,
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
                      setStep(1);
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
                  {reportingYear ? (
                    <div role="note" aria-label="Automatic baseline period">
                      <strong>Baseline period</strong>
                      <p>
                        01/01/{reportingYear - 1} – 31/12/{reportingYear - 1}
                      </p>
                      <span>
                        Uses all 12 months of the previous year. Missing data will be listed when you check readiness.
                      </span>
                    </div>
                  ) : (
                    <>
                      <label>
                        Baseline first month
                        <DateInput
                          type="date"
                          name="firstMonth"
                          min="1900-01-01"
                          max="2199-12-31"
                          aria-describedby="baseline-date-help"
                          required
                        />
                      </label>
                      <label>
                        Baseline last month
                        <DateInput
                          type="date"
                          name="lastMonth"
                          min="1900-01-01"
                          max="2199-12-31"
                          aria-describedby="baseline-date-help"
                          required
                        />
                      </label>
                    </>
                  )}
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
                    {weatherOptionsError && <span role="alert">{weatherOptionsError}</span>}
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
                {!reportingYear && (
                  <p id="baseline-date-help" className="muted">
                    Select any date in each month. The baseline includes both selected months in full.
                  </p>
                )}
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
                <strong>
                  {readiness.ready ? 'Inputs ready for experimental fitting' : 'Baseline needs attention'}
                </strong>
                <Issues issues={readiness.issues} />
                <Issues issues={readiness.warnings} />
              </div>
            )}
          </section>
        )}
        <Issues issues={issues} />
        <details open={!wizard} className="waste-report-history">
          <summary>Reuse a saved baseline or reporting run</summary>
          <section className="panel stack-form" aria-label="Baseline and run history">
            <div>
              <span className="eyebrow">SAVED EVIDENCE</span>
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
                            setStep(2);
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
                                        ...page.items.filter(
                                          (r) => !item.runs.some((existing) => existing.id === r.id),
                                        ),
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
        </details>
      </div>
      <div hidden={wizard && step !== 1} className="stack-form">
        {baseline && (
          <>
            <section className="panel stack-form" aria-label="Selected baseline">
              <h2>Selected baseline · revision {baseline.revision}</h2>
              <p>
                {baseline.snapshot.definition.period.firstMonth} – {baseline.snapshot.definition.period.lastMonth} ·{' '}
                {baseline.snapshot.definition.drivers.map((d) => labels[d]).join(', ')}
              </p>
              {!!baseline.snapshot.assembly.warnings.length && (
                <div role="note" aria-label="Baseline input warnings">
                  <strong>Baseline input warnings</strong>
                  <Issues issues={baseline.snapshot.assembly.warnings} />
                </div>
              )}
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
              <BaselineDiagnostics
                fit={baseline.fit}
                observations={baseline.snapshot.assembly.rows}
                interpretation={baseline.snapshot.interpretation}
              />
              <details>
                <summary>Baseline provenance and unrounded data</summary>
                <p className="analysis-hash">Input hash: {baseline.inputHash}</p>
                <pre className="analysis-json">{JSON.stringify(baseline, null, 2)}</pre>
              </details>
            </section>
            {manage && (
              <RunForm
                key={baseline.id}
                reportingYear={reportingYear}
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
                    setStep(2);
                    await refresh();
                  }, 'Experimental reporting run saved.')
                }
              />
            )}
          </>
        )}
        {wizard && baseline && (
          <Button variant="secondary" disabled={m.disabled} onClick={() => setStep(0)}>
            Back to baseline
          </Button>
        )}
      </div>
      <div hidden={wizard && step !== 2} className="stack-form">
        {run && <RunResults run={run} />}
        {wizard && run && (
          <div className="analysis-actions">
            <Button variant="secondary" disabled={m.disabled} onClick={() => setStep(1)}>
              Back to reporting period
            </Button>
            <Link
              href={`/org/${base.split('/')[1]}/graphs?site=${base.split('/')[3]}&run=${run.id}&year=${run.result.output.rows[0]?.month.slice(0, 4) ?? new Date().getFullYear()}`}
            >
              View Waste &amp; Savings graph
            </Link>
          </div>
        )}
        {run && run.snapshot.request.policy.nra !== 'NONE' && (
          <NraReviewPanel
            key={run.id}
            base={base}
            runId={run.id}
            authorId={run.authorId}
            context={run.snapshot.request.nraContext}
            reviews={run.reviews}
            canReview={approve && actorId !== run.authorId}
            reload={async () => setRun(await request(`${base}/runs/${run.id}`, 'GET'))}
          />
        )}
      </div>
      {!manage && !archived && (
        <p className="notice">
          You can check readiness and read saved results. An Owner, Admin or Analyst can save baselines and runs.
        </p>
      )}
    </>
  );
}
function RunForm({
  reportingYear,
  baseline,
  disabled,
  issues,
  submit,
}: {
  reportingYear?: number;
  baseline: Baseline;
  disabled: boolean;
  issues: ReadinessIssue[];
  submit: (input: unknown) => Promise<void>;
}) {
  const [nra, setNra] = useState('NONE');
  const [firstDate, setFirstDate] = useState(reportingYear ? `${reportingYear}-01-01` : ''),
    [lastDate, setLastDate] = useState(reportingYear ? `${reportingYear}-12-31` : '');
  const first = reportingYear ? `${reportingYear}-01` : firstDate.slice(0, 7),
    last = reportingYear ? `${reportingYear}-12` : lastDate.slice(0, 7);
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
      <span className="eyebrow">REPORTING</span>
      <h2>Create reporting run</h2>
      <p id="reporting-date-help" className="muted">
        {reportingYear
          ? `This annual report covers January–December ${reportingYear}, using the previous year's baseline.`
          : 'Select any date in each month. Reporting includes both selected months in full.'}
      </p>
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
              comparison: 'GREATER_THAN',
              sigmaMultiplier: 2,
              zeroThreshold: f.get('zeroThreshold'),
              negativePrediction: f.get('negativePrediction'),
              extrapolation: f.get('extrapolation'),
            },
            ...(nra === 'NONE'
              ? {}
              : {
                  nraContext: {
                    rationale: f.get('nraRationale'),
                    evidence: String(f.get('nraEvidence') ?? '')
                      .split('\n')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  },
                }),
            references:
              nra === 'NONE' ? [] : months.map((month) => ({ month, referenceMonth: f.get(`reference-${month}`) })),
          });
        }}
      >
        <fieldset className="form-grid" disabled={disabled}>
          {reportingYear ? (
            <div role="note" aria-label="Automatic reporting period">
              <strong>Reporting period</strong>
              <p>
                01/01/{reportingYear} – 31/12/{reportingYear}
              </p>
              <span>All 12 months are required. Change the Year selection above to report on another year.</span>
            </div>
          ) : (
            <>
              <label>
                Reporting first month
                <DateInput
                  type="date"
                  min="1900-01-01"
                  max="2199-12-31"
                  aria-describedby="reporting-date-help"
                  required
                  value={firstDate}
                  onValueChange={setFirstDate}
                />
              </label>
              <label>
                Reporting last month
                <DateInput
                  type="date"
                  min="1900-01-01"
                  max="2199-12-31"
                  aria-describedby="reporting-date-help"
                  required
                  value={lastDate}
                  onValueChange={setLastDate}
                />
              </label>
            </>
          )}
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
            <label>
              NRA rationale and assumptions
              <textarea name="nraRationale" required maxLength={2000} />
            </label>
            <label>
              NRA evidence references (one per line)
              <textarea name="nraEvidence" required maxLength={5000} />
            </label>
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
          A month is significant only when the absolute waste or saving is greater than twice the baseline residual
          standard error. A value equal to the threshold is not significant; NRA does not change the threshold.
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
                    {number(row.postNraVarianceKwh)} · <WasteDirection direction={row.direction} />
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
