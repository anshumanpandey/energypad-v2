'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { fuels } from '@/domain/tariffs';
import type { PortfolioEnergyResult } from '@/domain/portfolio-energy';
export function PortfolioEnergy({ orgId, portfolios }: { orgId: string; portfolios: { id: string; name: string }[] }) {
  const [result, setResult] = useState<PortfolioEnergyResult | null>(null);
  const [availableSites, setAvailableSites] = useState<PortfolioEnergyResult['availableSites']>([]);
  const mutation = useMutation();
  return (
    <section className="panel stack-form" aria-label="Portfolio energy and cost summary">
      <h2>Portfolio energy and cost</h2>
      <p>
        Current active sites and meters, using current reading revisions. Registered meters may overlap; main/submeter
        overlap is not deducted. Empty sites or sites without meters for the selected fuel leave coverage incomplete.
        Costs are net of tax; currencies are never converted or combined.
      </p>
      {mutation.feedback}
      {!portfolios.length ? (
        <p>Create a portfolio and assign sites to begin.</p>
      ) : (
        <form
          className="stack-form"
          onChange={() => setResult(null)}
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const query = new URLSearchParams({ year: String(fields.get('year')), fuel: String(fields.get('fuel')) });
            if (fields.get('siteId')) query.set('siteId', String(fields.get('siteId')));
            setResult(null);
            void mutation.run(async () => {
              const data: PortfolioEnergyResult = await request(
                `organisations/${orgId}/portfolios/${fields.get('portfolioId')}/energy?${query}`,
                'GET',
              );
              setResult(data);
              setAvailableSites(data.availableSites);
            }, 'Portfolio energy coverage checked.');
          }}
        >
          <fieldset disabled={mutation.disabled} className="form-grid">
            <label>
              Energy portfolio
              <select name="portfolioId" required onChange={() => setAvailableSites([])}>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Energy reporting year
              <input name="year" type="number" min={1900} max={2199} required defaultValue={new Date().getFullYear()} />
            </label>
            <label>
              Energy fuel
              <select name="fuel">
                <option value="ALL">All fuels</option>
                {fuels.map((f) => (
                  <option key={f} value={f}>
                    {f.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Energy site
              <select name="siteId" key={availableSites.map((s) => s.id).join(',')}>
                <option value="">All included sites</option>
                {availableSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          {!availableSites.length && <p>Check the portfolio to load its accessible site filters.</p>}
          <Button type="submit" disabled={mutation.disabled}>
            {mutation.pending ? 'Checking…' : 'Check portfolio energy'}
          </Button>
        </form>
      )}
      {result && (
        <div role="region" aria-label="Portfolio energy results" className="stack-form">
          <h3>
            {result.portfolio.name} · {result.definition.year} · {result.definition.fuel.replaceAll('_', ' ')}
          </h3>
          <p>
            {result.scope === 'ASSIGNED_ACTIVE_SITES'
              ? 'Assigned active sites only; this is not a whole-portfolio total.'
              : 'Active sites in the selected portfolio.'}
            {result.definition.siteId ? ' Filtered to one site.' : ''}
          </p>
          <p>
            <strong>Annual consumption: {result.kwh === null ? 'Unavailable' : `${result.kwh} kWh`}</strong>
            <br />
            Annual net cost: {result.netCost === null ? 'Unavailable' : `${result.netCost} ${result.currency}`}
          </p>
          <p>
            {result.status === 'EMPTY'
              ? 'No included sites.'
              : `${result.sites.length} included sites. ${result.months.filter((m) => m.kwh !== null).length} of 12 months have complete energy coverage.`}{' '}
            Missing coverage or costs and mixed currencies remain unavailable. Checked {result.checkedAt}; recheck after
            changes.
          </p>
          <div className="analysis-table">
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Sites ready</th>
                  <th>kWh</th>
                  <th>Net cost</th>
                  <th>Estimated readings</th>
                </tr>
              </thead>
              <tbody>
                {result.months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td>
                      {m.completeSites} / {result.sites.length}
                    </td>
                    <td>{m.kwh ?? 'Unavailable'}</td>
                    <td>{m.netCost === null ? 'Unavailable' : `${m.netCost} ${m.currency}`}</td>
                    <td>{m.estimated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4>Site totals and source evidence</h4>
          {result.sites.map((s) => (
            <details key={s.id}>
              <summary>
                {s.name} · {s.code} · {s.energy.kwh === null ? 'Energy unavailable' : `${s.energy.kwh} kWh`} ·{' '}
                {s.energy.netCost === null ? 'Cost unavailable' : `${s.energy.netCost} ${s.energy.currency}`}
              </summary>
              <p>
                {s.meters.length} active meters for the selected fuel; {s.energy.completeMonths} / 12 complete months.
              </p>
              <div className="analysis-table">
                <pre>{JSON.stringify({ meters: s.meters, months: s.energy.months }, null, 2)}</pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
