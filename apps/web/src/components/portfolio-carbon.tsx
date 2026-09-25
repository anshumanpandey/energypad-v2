'use client';
import { useState } from 'react';
import { CarbonReportDownload } from './carbon-report-download';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { factorBases } from '@/domain/emission-factors';
import type { PortfolioCarbonSummary } from '@/domain/carbon';
export function PortfolioCarbon({ orgId, portfolios }: { orgId: string; portfolios: { id: string; name: string }[] }) {
  const [result, setResult] = useState<PortfolioCarbonSummary | null>(null);
  const mutation = useMutation();
  return (
    <section className="panel stack-form" aria-label="Portfolio carbon summary">
      <h2>Portfolio carbon summary</h2>
      <p>
        Compare active sites using the latest matching meter calculations. A total requires every included site and
        meter to have complete, current inputs. This is an active-meter sum; overlapping main meters and submeters are
        not deducted. Archived sites and meters are excluded.
      </p>
      {mutation.feedback}
      {!portfolios.length ? (
        <p>No available portfolios. Create a portfolio and assign sites to begin.</p>
      ) : (
        <form
          className="stack-form"
          onChange={() => setResult(null)}
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const portfolioId = String(fields.get('portfolioId'));
            const query = new URLSearchParams({
              year: String(fields.get('year')),
              geography: String(fields.get('geography')),
              basis: String(fields.get('basis')),
            });
            setResult(null);
            void mutation.run(
              async () =>
                setResult(await request(`organisations/${orgId}/portfolios/${portfolioId}/carbon?${query}`, 'GET')),
              'Portfolio coverage checked.',
            );
          }}
        >
          <fieldset className="form-grid" disabled={mutation.disabled} style={{ border: 0, padding: 0 }}>
            <label>
              Carbon portfolio
              <select name="portfolioId" required defaultValue={portfolios[0]?.id}>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Portfolio reporting year
              <input name="year" type="number" required min={1900} max={2199} defaultValue={new Date().getFullYear()} />
            </label>
            <label>
              Portfolio geography
              <input name="geography" required maxLength={40} placeholder="GB" />
            </label>
            <label>
              Portfolio reporting basis
              <select name="basis">
                {factorBases.map((b) => (
                  <option key={b} value={b}>
                    {b.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <Button type="submit" disabled={mutation.disabled}>
            {mutation.pending ? 'Checking…' : 'Check portfolio carbon'}
          </Button>
        </form>
      )}
      {result && (
        <div role="region" aria-label="Portfolio carbon results">
          <h3>
            {result.portfolio.name} · {result.definition.year}
          </h3>
          <p>
            <strong>
              {result.scope === 'ASSIGNED_ACTIVE_SITES'
                ? 'Assigned active sites only — this is not a whole-portfolio total.'
                : 'All active sites in this portfolio.'}
            </strong>
          </p>
          <p>
            <strong>
              {result.status === 'COMPLETE'
                ? `Included-meter sum: ${result.totalKgCO2e} kgCO2e`
                : result.status === 'EMPTY'
                  ? 'No active sites — no total available.'
                  : 'Total unavailable — resolve site coverage below.'}
            </strong>
          </p>
          <p>
            {result.sites.filter((s) => s.summary.status === 'COMPLETE').length} of {result.sites.length} included sites
            ready. {result.definition.geography} · {result.definition.basis.replaceAll('_', ' ')} · Checked{' '}
            {result.checkedAt}. Recheck after changes.
          </p>
          <CarbonReportDownload
            key={result.checkedAt}
            path={`organisations/${orgId}/portfolios/${result.portfolio.id}/carbon`}
            definition={result.definition}
            fingerprint={result.fingerprint}
          />
          <div style={{ overflowX: 'auto' }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Coverage</th>
                  <th>kgCO2e</th>
                  <th>Meters and saved runs</th>
                </tr>
              </thead>
              <tbody>
                {result.sites.map((site) => (
                  <tr key={site.id}>
                    <td>
                      <strong>{site.name}</strong>
                      <br />
                      {site.code}
                    </td>
                    <td>
                      {site.summary.status === 'EMPTY' ? 'No active meters' : site.summary.status}
                      <br />
                      {site.summary.meters.filter((m) => m.status === 'READY').length} of {site.summary.meters.length}{' '}
                      meters ready
                    </td>
                    <td>{site.summary.totalKgCO2e ?? '—'}</td>
                    <td>
                      <details>
                        <summary>Inspect meter coverage</summary>
                        {site.summary.meters.map((m) => (
                          <div key={m.meterId} style={{ marginTop: 12 }}>
                            <strong>
                              {m.name} · {m.status}
                            </strong>
                            <p>
                              {m.kgCO2e ?? 'No total'} {m.kgCO2e !== null ? 'kgCO2e' : ''} · {m.estimatedMonths}{' '}
                              estimated months
                            </p>
                            <p>{m.issue}</p>
                            {m.runId && (
                              <p>
                                Run {m.runId}
                                <br />
                                {m.calculatedAt}
                              </p>
                            )}
                          </div>
                        ))}
                      </details>
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
