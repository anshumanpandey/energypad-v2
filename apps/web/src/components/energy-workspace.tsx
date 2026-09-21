'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { EnergyImportWorkspace } from './energy-import-workspace';
import { DriverWorkspace, type DriverData } from './driver-workspace';
import { WeatherWorkspace, type WeatherData } from './weather-workspace';
import {
  ReadingCorrections,
  ConversionCorrections,
  type ReadingRevision,
  type ConversionRevision,
} from './energy-corrections';
import { request, useMutation } from './forms';
type EnergyData = {
  drivers: DriverData;
  weather: WeatherData;
  meters: { id: string; name: string; code: string; unit: string; archivedAt: string | null }[];
  conversions: ConversionRevision[];
  records: ReadingRevision[];
  coverage: { meterId: string; name: string; missing: string[] }[];
};
export function EnergyWorkspace({
  orgId,
  sites,
  manage,
}: {
  orgId: string;
  sites: { id: string; name: string }[];
  manage: boolean;
}) {
  const m = useMutation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [loaded, setLoaded] = useState<{ siteId: string; year: number; data: EnergyData } | null>(null);
  const data = loaded?.siteId === siteId && loaded.year === year ? loaded.data : null;
  const base = `organisations/${orgId}/sites/${siteId}/energy`;
  async function load() {
    const [result, drivers, weather] = await Promise.all([
      request(`${base}?year=${year}`, 'GET'),
      request(`${base}/drivers?year=${year}`, 'GET'),
      request(`${base}/weather?year=${year}`, 'GET'),
    ]);
    setLoaded({ siteId, year, data: { ...result, drivers, weather } });
  }
  if (!sites.length)
    return (
      <section className="panel">
        <h2>Add a site to get started</h2>
        <p>Create a site and a meter in Sites before recording energy use.</p>
      </section>
    );
  return (
    <div className="stack-form">
      {m.feedback}
      <form
        className="panel stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          void m.run(load, 'Energy records loaded.');
        }}
      >
        <div className="form-grid">
          <label>
            Site
            <select
              aria-label="Energy site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              disabled={m.disabled}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input
              type="number"
              min="1900"
              max="2199"
              required
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={m.disabled}
            />
          </label>
        </div>
        <Button disabled={m.disabled}>Load energy records</Button>
      </form>
      {data && (
        <>
          <section className="panel stack-form">
            <h2>Monthly coverage · {year}</h2>
            <p>
              Coverage includes all 12 calendar months, including future months. Missing periods are never filled with
              zero.
            </p>
            {!data.coverage.length && <p>Add an active meter in Sites to record consumption.</p>}
            {data.coverage.map((c) => (
              <div className="site-history-entry" key={c.meterId}>
                <strong>
                  {c.name} · {12 - c.missing.length}/12 months recorded
                </strong>
                <p>{c.missing.length ? `Not recorded: ${c.missing.join(', ')}` : 'Complete calendar year'}</p>
              </div>
            ))}
          </section>
          <WeatherWorkspace
            key={`weather:${siteId}:${year}`}
            base={`${base}/weather`}
            year={year}
            data={data.weather}
            manage={manage}
            reload={load}
          />
          <DriverWorkspace
            key={`${siteId}:${year}`}
            base={`${base}/drivers`}
            year={year}
            data={data.drivers}
            manage={manage}
            reload={load}
          />
          {manage && data.meters.some((meter) => !meter.archivedAt) && (
            <form
              className="panel stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const values = new FormData(form);
                void m.run(async () => {
                  await request(base, 'POST', {
                    meterId: values.get('meterId'),
                    month: values.get('month'),
                    quantity: values.get('quantity'),
                    estimated: values.get('estimated') === 'on',
                    netCost: values.get('netCost') || null,
                    vatPercent: values.get('vatPercent') || null,
                    currency: values.get('currency') || null,
                    endUse: values.get('endUse'),
                  });
                  form.reset();
                  await load();
                }, 'Consumption recorded.');
              }}
            >
              <h2>Record monthly consumption</h2>
              <p>Enter a complete calendar month for one meter. Cost is net of VAT; leave unknown values blank.</p>
              <div className="form-grid">
                <label>
                  Meter
                  <select name="meterId" aria-label="Energy meter" required>
                    {data.meters
                      .filter((meter) => !meter.archivedAt)
                      .map((meter) => (
                        <option key={meter.id} value={meter.id}>
                          {meter.name} ({meter.unit})
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Month
                  <input type="month" name="month" required />
                </label>
                <label>
                  Quantity (meter units)
                  <input name="quantity" type="number" min="0" max="9999999999.999" step="0.001" required />
                </label>
                <label>
                  End use (optional)
                  <input name="endUse" maxLength={100} placeholder="For example, heating" />
                </label>
                <label>
                  Net cost
                  <input name="netCost" type="number" min="0" max="9999999999.999" step="0.001" />
                </label>
                <label>
                  Currency (3-letter code)
                  <input name="currency" maxLength={3} />
                </label>
                <label>
                  VAT (%)
                  <input name="vatPercent" type="number" min="0" max="100" step="0.001" />
                </label>
              </div>
              <label className="checkbox-label">
                <input name="estimated" type="checkbox" />
                Estimated reading
              </label>
              <Button disabled={m.disabled}>Save consumption</Button>
            </form>
          )}
          <section className="panel stack-form">
            <h2>Conversion factors</h2>
            <p>
              kWh and MWh use fixed conversions. For m³, litres or kilograms, record the kWh per source unit from your
              supplier or an approved reference. Factors apply only to the specified meter, fuel and complete months.
            </p>
            {data.conversions
              .filter((c) => !c.replacement)
              .map((c) => (
                <article className="site-history-entry" key={c.id}>
                  <strong>
                    {data.meters.find((meter) => meter.id === c.meterId)?.name} · {c.factor} kWh/{c.sourceUnit}
                  </strong>
                  <p>
                    {c.fuel} · {c.validFrom.slice(0, 7)} to{' '}
                    {new Date(new Date(c.validUntil).getTime() - 86400000).toISOString().slice(0, 7)} inclusive
                  </p>
                  <p>Source: {c.source}</p>
                  <ConversionCorrections base={base} conversion={c} manage={manage} reload={load} />
                </article>
              ))}
            {!data.conversions.length && <p>No custom conversion factors recorded.</p>}
            {manage && data.meters.some((meter) => !meter.archivedAt && ['m3', 'litre', 'kg'].includes(meter.unit)) && (
              <form
                className="stack-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = Object.fromEntries(new FormData(form));
                  void m.run(async () => {
                    await request(`${base}/conversions`, 'POST', input);
                    form.reset();
                    await load();
                  }, 'Conversion factor saved.');
                }}
              >
                <h3>Add conversion factor</h3>
                <div className="form-grid">
                  <label>
                    Meter
                    <select name="meterId" aria-label="Conversion meter" required>
                      {data.meters
                        .filter((meter) => !meter.archivedAt && ['m3', 'litre', 'kg'].includes(meter.unit))
                        .map((meter) => (
                          <option key={meter.id} value={meter.id}>
                            {meter.name} ({meter.unit})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    kWh per source unit
                    <input name="factor" type="number" min="0.000001" max="100000" step="0.000001" required />
                  </label>
                  <label>
                    First month
                    <input name="firstMonth" type="month" required />
                  </label>
                  <label>
                    Last month (inclusive)
                    <input name="lastMonth" type="month" required />
                  </label>
                  <label>
                    Factor source / reference
                    <input
                      name="source"
                      minLength={3}
                      maxLength={500}
                      required
                      placeholder="Supplier statement or published reference"
                    />
                  </label>
                </div>
                <p className="field-hint">
                  Saved versions remain in history. Use a correction to replace a factor; overlapping periods are
                  rejected. Existing readings retain their original conversion.
                </p>
                <Button disabled={m.disabled}>Save conversion factor</Button>
              </form>
            )}
          </section>
          {manage && (
            <EnergyImportWorkspace
              key={siteId}
              base={`/api/v1/${base}/imports`}
              meters={data.meters}
              onCommitted={load}
            />
          )}
          <section className="panel stack-form">
            <h2>Consumption records</h2>
            {!data.records.length ? (
              <p>No readings recorded for this year.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      <th>Month / meter</th>
                      <th>Source</th>
                      <th>Energy (kWh)</th>
                      <th>Net / gross cost</th>
                      <th>Data quality</th>
                      <th>History and corrections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          {record.periodStart.slice(0, 7)}
                          <br />
                          {data.meters.find((meter) => meter.id === record.meterId)?.name}
                        </td>
                        <td>
                          {record.sourceQuantity} {record.sourceUnit}
                        </td>
                        <td>
                          {record.normalizedKwh}
                          <details>
                            <summary>Conversion details</summary>
                            <p>
                              {record.conversionFactor} kWh/{record.sourceUnit}
                            </p>
                            <p>
                              {data.conversions.find((c) => c.id === record.conversionId)?.source ??
                                'Exact kWh/MWh dimensional conversion'}
                            </p>
                            <p>Version: {record.conversionVersion}</p>
                          </details>
                        </td>
                        <td>
                          {record.netCost ?? 'Unknown'} / {record.grossCost ?? 'Unknown'} {record.currency}
                        </td>
                        <td>
                          {record.qualityFlags.length ? record.qualityFlags.join(' · ') : 'No input issues detected'}
                        </td>
                        <td>
                          <ReadingCorrections base={base} record={record} manage={manage} reload={load} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
