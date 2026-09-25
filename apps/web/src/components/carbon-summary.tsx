'use client';
import { useState } from 'react';
import { CarbonReportDownload } from './carbon-report-download';
import { Button } from './ui/button';
import { request } from './forms';
import { factorBases } from '@/domain/emission-factors';
import type { CarbonSummary } from '@/domain/carbon';
export function CarbonSummaryPanel({ base }: { base: string }) {
  const [summary, setSummary] = useState<CarbonSummary | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <section style={{ marginTop: 24, marginBottom: 24 }} aria-label="Site carbon summary">
      <h3>Site carbon summary</h3>
      <p>
        Sum of currently active meters for one year, geography and reporting basis. Meters may overlap (for example, a
        main meter and submeters); this is a meter sum, not a net site inventory. Archived meters are excluded.
      </p>
      <form
        className="stack-form"
        onChange={() => {
          setSummary(null);
          setError('');
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const query = new URLSearchParams(
            Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>,
          );
          setPending(true);
          setSummary(null);
          setError('');
          void request(`${base}/carbon/summary?${query}`, 'GET')
            .then(setSummary)
            .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load the summary.'))
            .finally(() => setPending(false));
        }}
      >
        <fieldset disabled={pending} className="form-grid" style={{ border: 0, padding: 0 }}>
          <label>
            Summary year
            <input name="year" type="number" min={1900} max={2199} required defaultValue={new Date().getFullYear()} />
          </label>
          <label>
            Summary geography
            <input name="geography" required maxLength={40} placeholder="GB" />
          </label>
          <label>
            Summary basis
            <select name="basis">
              {factorBases.map((b) => (
                <option key={b} value={b}>
                  {b.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <Button type="submit" disabled={pending}>
          {pending ? 'Checking…' : 'Check site summary'}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {summary && (
        <div role="region" aria-label="Carbon summary results" style={{ marginTop: 16 }}>
          <strong>
            {summary.status === 'COMPLETE'
              ? `Active-meter sum: ${summary.totalKgCO2e} kgCO2e`
              : summary.status === 'EMPTY'
                ? 'No active meters — no total available.'
                : 'Total unavailable — resolve meter coverage below.'}
          </strong>
          <p>
            {summary.meters.filter((m) => m.status === 'READY').length} of {summary.meters.length} active meters ready.
            Checked {summary.checkedAt}. Check again after changing inputs.
          </p>
          <CarbonReportDownload key={summary.checkedAt} path={`${base}/carbon`} definition={summary.definition} />
          <div style={{ overflowX: 'auto' }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Meter</th>
                  <th>Status</th>
                  <th>kgCO2e</th>
                  <th>Coverage and source</th>
                </tr>
              </thead>
              <tbody>
                {summary.meters.map((m) => (
                  <tr key={m.meterId}>
                    <td>
                      {m.name}
                      <br />
                      {m.fuel}
                    </td>
                    <td>{m.status}</td>
                    <td>{m.kgCO2e ?? '—'}</td>
                    <td>
                      {m.issue ?? `${m.estimatedMonths} months use estimated consumption.`}
                      {m.runId && (
                        <details>
                          <summary>Saved run</summary>
                          <p>
                            {m.runId}
                            <br />
                            {m.calculatedAt}
                          </p>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
