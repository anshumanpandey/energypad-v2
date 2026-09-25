'use client';
import { useEffect, useState, useRef } from 'react';
import { CarbonSummaryPanel } from './carbon-summary';
import { CarbonImports } from './carbon-imports';
import { CarbonTargets } from './carbon-targets';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { factorBases } from '@/domain/emission-factors';
import type { CarbonSnapshot } from '@/domain/carbon';
type Run = { id: string; algorithmVersion: string; createdAt: string; snapshot: CarbonSnapshot };
export function CarbonWorkspace({
  orgId,
  sites,
  manage,
  canFactors,
}: {
  orgId: string;
  sites: { id: string; name: string }[];
  manage: boolean;
  canFactors: boolean;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  return (
    <section className="panel">
      <h2>Calculate annual emissions</h2>
      <p>
        Calculate one meter at a time. Every month needs consumption and one factor covering the entire month. Mid-month
        factor changes require resolution; consumption is not prorated. Estimated readings remain identified in the
        result.
      </p>
      <label>
        Carbon site
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">Select a site</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {siteId && <SiteCarbon key={siteId} orgId={orgId} siteId={siteId} manage={manage} canFactors={canFactors} />}
    </section>
  );
}
function SiteCarbon({
  orgId,
  siteId,
  manage,
  canFactors,
}: {
  orgId: string;
  siteId: string;
  manage: boolean;
  canFactors: boolean;
}) {
  const [meters, setMeters] = useState<{ id: string; name: string; archivedAt: string | null }[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const mutation = useMutation();
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const base = `organisations/${orgId}/sites/${siteId}`;
  useEffect(() => {
    let cancelled = false;
    Promise.all([request(`${base}/energy`, 'GET'), request(`${base}/carbon`, 'GET')])
      .then(([energy, history]) => {
        if (!cancelled) {
          setMeters(energy.meters);
          setRuns(history);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load carbon data.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [base, retry]);
  if (loading) return <p role="status">Loading carbon data…</p>;
  if (loadError)
    return (
      <>
        <p role="alert">{loadError}</p>
        <Button
          onClick={() => {
            setLoadError('');
            setLoading(true);
            setRetry(retry + 1);
          }}
        >
          Retry
        </Button>
      </>
    );
  return (
    <>
      <CarbonSummaryPanel key={runs[0]?.id ?? 'empty'} base={base} />
      {mutation.feedback}
      {manage && (
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = Object.fromEntries(new FormData(event.currentTarget));
            const definition = { ...fields, year: Number(fields.year) };
            const signature = JSON.stringify(definition);
            if (!attempt.current || attempt.current.signature !== signature)
              attempt.current = { signature, key: crypto.randomUUID() };
            const requestKey = attempt.current.key;
            void mutation.run(async () => {
              const run = await request(`${base}/carbon`, 'POST', { ...definition, requestKey });
              setRuns((current) => [run, ...current.filter((r) => r.id !== run.id)].slice(0, 50));
              attempt.current = null;
            }, 'Calculation saved. Review coverage and results below.');
          }}
        >
          <div className="form-grid">
            <label>
              Carbon meter
              <select name="meterId" required>
                <option value="">Select a meter</option>
                {meters
                  .filter((m) => !m.archivedAt)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Calculation year
              <input name="year" type="number" min={1900} max={2199} required defaultValue={new Date().getFullYear()} />
            </label>
            <label>
              Calculation geography
              <input name="geography" required maxLength={40} placeholder="GB" />
            </label>
            <label>
              Calculation basis
              <select name="basis">
                {factorBases.map((b) => (
                  <option key={b} value={b}>
                    {b.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button type="submit" disabled={mutation.disabled}>
            {' '}
            {mutation.pending ? 'Calculating…' : 'Calculate and save'}
          </Button>
        </form>
      )}
      {manage && <CarbonImports base={base} canFactors={canFactors} onCommitted={() => setRetry(retry + 1)} />}
      <CarbonTargets key={retry} base={base} meters={meters} runs={runs} manage={manage} />
      <h3>Saved calculations</h3>
      <p>
        Latest 50 runs for this site. Saved results retain their original inputs after corrections; calculate again to
        use current versions.
      </p>
      {!runs.length && <p>No saved calculations yet.</p>}
      {runs.map((run) => (
        <details key={run.id} open={runs[0]?.id === run.id}>
          <summary>
            {run.snapshot.meter.name} · {run.snapshot.definition.year} ·{' '}
            {run.snapshot.status === 'COMPLETE'
              ? `${run.snapshot.totalKgCO2e} kgCO2e`
              : 'Blocked — incomplete coverage'}{' '}
            · {run.createdAt}
          </summary>
          <p>
            {run.snapshot.definition.geography} · {run.snapshot.definition.basis.replaceAll('_', ' ')} ·{' '}
            {run.algorithmVersion} · Run {run.id}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Consumption (kWh)</th>
                  <th>Factor (kgCO2e/kWh)</th>
                  <th>Emissions (kgCO2e)</th>
                  <th>Coverage / provenance</th>
                </tr>
              </thead>
              <tbody>
                {run.snapshot.rows.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>
                      {row.normalizedKwh ?? '—'}
                      {row.estimated ? ' (estimated)' : ''}
                    </td>
                    <td>{row.factor ?? '—'}</td>
                    <td>{row.kgCO2e ?? '—'}</td>
                    <td>
                      {row.issue ?? row.source}
                      <details>
                        <summary>Input versions</summary>
                        <p>
                          Reading: {row.readingId ?? 'None'} (revision {row.readingRevision ?? '—'})<br />
                          Conversion: {row.conversionVersion ?? '—'}
                          <br />
                          Factor: {row.factorId ?? 'None'} (revision {row.factorRevision ?? '—'})
                        </p>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </>
  );
}
