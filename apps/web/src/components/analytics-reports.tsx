'use client';
import { useState } from 'react';
import type { AnalyticsReport, ReportValue } from '@/domain/analytics-report';
import { reportFields } from '@/domain/analytics-report';
import { Button } from './ui/button';
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const display = (value: ReportValue) => (value === null ? 'Unavailable' : String(value));
export function AnalyticsReports({
  organisationId,
  sites,
}: {
  organisationId: string;
  sites: { id: string; name: string; archived: boolean }[];
}) {
  const [family, setFamily] = useState('energy');
  const [site, setSite] = useState(sites[0]?.id ?? '');
  const [options, setOptions] = useState<{ id: string; createdAt: string }[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [source, setSource] = useState<{ url: string; fingerprint: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function response(url: string) {
    const result = await fetch(url, { cache: 'no-store' });
    if (!result.ok) {
      const problem = await result.json();
      throw new Error(problem.title ?? 'Unable to load report.');
    }
    return result;
  }
  async function history(older = false) {
    setPending(true);
    setError('');
    try {
      const path = family === 'baseline' ? 'history' : 'waste-runs';
      const result = await response(
        `/api/v1/organisations/${organisationId}/sites/${site}/analysis/${path}${older && cursor ? `?cursor=${cursor}` : ''}`,
      );
      const data = await result.json();
      setOptions(data.items);
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load history.');
    } finally {
      setPending(false);
    }
  }
  async function preview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setReport(null);
    setSource(null);
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams({ family });
    for (const key of ['year', 'baselineId', 'runId', 'carbonRunId'])
      if (data.get(key)) query.set(key, String(data.get(key)));
    const url = `/api/v1/organisations/${organisationId}/sites/${site}/reports?${query}`;
    try {
      const result = await response(url);
      setReport(await result.json());
      setSource({ url, fingerprint: result.headers.get('X-Report-Fingerprint')! });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load report.');
    } finally {
      setPending(false);
    }
  }
  async function download(format: 'csv' | 'json') {
    if (!source || !report) return;
    setPending(true);
    setError('');
    try {
      const result = await response(`${source.url}&format=${format}&fingerprint=${source.fingerprint}`);
      const url = URL.createObjectURL(await result.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.family}-${report.siteId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to export report.');
    } finally {
      setPending(false);
    }
  }
  function reset() {
    setOptions([]);
    setCursor(null);
    setReport(null);
    setSource(null);
    setError('');
  }
  if (!sites.length)
    return (
      <section className="panel">
        <h2>Energy, savings and baseline reports</h2>
        <p>Add a site to begin.</p>
      </section>
    );
  return (
    <div className="waste-savings">
      <form className="panel stack-form" onSubmit={preview}>
        <h2>Energy, savings and baseline reports</h2>
        <label>
          Report site
          <select
            value={site}
            disabled={pending}
            onChange={(e) => {
              setSite(e.target.value);
              reset();
            }}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Report family
          <select
            value={family}
            disabled={pending}
            onChange={(e) => {
              setFamily(e.target.value);
              reset();
            }}
          >
            <option value="energy">Energy</option>
            <option value="savings">Savings</option>
            <option value="baseline">Baseline</option>
          </select>
        </label>
        <div key={`${site}-${family}`} className="stack-form">
          {family === 'energy' ? (
            <label>
              Report year
              <input
                name="year"
                type="number"
                min="1900"
                max="2199"
                defaultValue={new Date().getUTCFullYear()}
                required
              />
            </label>
          ) : (
            <>
              <p>Select a saved version or paste its ID. Historical versions remain available after corrections.</p>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => void history()}>
                Find saved versions
              </Button>
              <label>
                {family === 'baseline' ? 'Baseline version ID' : 'Analysis run ID'}
                <input name={family === 'baseline' ? 'baselineId' : 'runId'} list="report-versions" required />
              </label>
              <datalist id="report-versions">
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.createdAt}
                  </option>
                ))}
              </datalist>
              {!!options.length && (
                <ul>
                  {options.map((o) => (
                    <li key={o.id}>
                      {o.createdAt} · {o.id}
                    </li>
                  ))}
                </ul>
              )}
              {cursor && (
                <Button type="button" variant="secondary" disabled={pending} onClick={() => void history(true)}>
                  Older report versions
                </Button>
              )}
              {family === 'savings' && (
                <label>
                  Carbon run ID (optional)
                  <input name="carbonRunId" />
                </label>
              )}
            </>
          )}
        </div>
        <Button disabled={pending} type="submit">
          Preview report
        </Button>
      </form>
      {pending && <p role="status">Preparing report…</p>}
      {error && <p role="alert">{error}</p>}
      {report && (
        <section className="panel stack-form" aria-label="Report preview">
          <h2>{report.family[0].toUpperCase() + report.family.slice(1)} report</h2>
          <p>
            {report.period.firstMonth} – {report.period.lastMonth} · {report.status}
          </p>
          <p>{report.note}</p>
          <p>
            Contract: {report.reportVersion}. Exports recheck access and match this preview; if source data changes,
            preview again. CSV uses one JSON Pointer path, type and value per field, preserving all nested evidence.
            JSON retains the complete structured report.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button type="button" disabled={pending} onClick={() => void download('csv')}>
              Download report CSV
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void download('json')}>
              Download report JSON
            </Button>
          </div>
          <dl>
            {Object.entries(report.summary).map(([key, value]) => (
              <div key={key}>
                <dt>{label(key)}</dt>
                <dd>
                  {display(value)}{' '}
                  {value !== null && report.units[key] !== 'Unavailable' ? (report.units[key] ?? '') : ''}
                </dd>
              </div>
            ))}
          </dl>
          <div className="analysis-table" role="region" aria-label="Report results" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  {Array.from(new Set(report.rows.flatMap((r) => Object.keys(r)))).map((k) => (
                    <th key={k}>
                      {label(k)}
                      {report.units[k] ? ` (${report.units[k]})` : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={i}>
                    {Array.from(new Set(report.rows.flatMap((row) => Object.keys(row)))).map((k) => (
                      <td key={k}>{display(r[k] ?? null)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!report.rows.length && <p>No result rows are available.</p>}
          <details>
            <summary>Saved inputs, versions and evidence</summary>
            <div className="analysis-table">
              <table>
                <thead>
                  <tr>
                    <th>Evidence path</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {reportFields(report.evidence).map((r) => (
                    <tr key={r.path}>
                      <th>{r.path}</th>
                      <td>{display(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
