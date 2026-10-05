'use client';
import { useState, useTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WastePreview } from '@/domain/analysis/waste-preview';
import { Button } from './ui/button';
import { WasteCharts } from './waste-charts';
import { aggregateWasteRows } from '@/domain/analysis/waste-gauge';
import type { UtilityChartSort } from '@/domain/utility-chart-sort';
import { formatEnergyValue } from './format-energy-value';
import { WasteWeather } from './waste-weather';

const driverLabels = {
  HDD: 'Heating',
  CDD: 'Cooling',
  POPULATION: 'Population',
  OPERATING_HOURS: 'Operating hours',
  DAYLIGHT: 'Daylighting',
};
export function WasteDashboard({
  orgId,
  siteId,
  sites,
  preview,
  manageWeather = false,
}: {
  orgId: string;
  siteId: string;
  sites: { id: string; name: string }[];
  preview: WastePreview;
  manageWeather?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drivers, setDrivers] = useOptimistic(preview.drivers);
  const [view, setView] = useState('graph');
  const [month, setMonth] = useState('');
  const [fuel, setFuel] = useState('');
  const [sort, setSort] = useState<UtilityChartSort>('month');
  const [other, setOther] = useState(preview.drivers.some((driver) => !['HDD', 'CDD'].includes(driver)));
  const update = (site: string, year: number | undefined, drivers?: string[]) => {
    const query = new URLSearchParams({ site });
    if (year !== undefined) query.set('year', String(year));
    if (drivers) query.set('drivers', drivers.join(','));
    startTransition(() => {
      if (drivers) setDrivers(drivers);
      router.push(`/org/${orgId}/waste-savings?${query}`);
    });
  };
  const meters = preview.meters.filter((meter) => !fuel || meter.fuel === fuel);
  const value = (number: number | null) => formatEnergyValue(number, 'Unavailable');
  return (
    <div className="utility-graphs-page waste-savings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPECTED VERSUS ACTUAL</span>
          <h1>Waste &amp; Savings</h1>
          <p>Monthly consumption, expected consumption and waste or savings calculated from uploaded site inputs.</p>
        </div>
      </div>
      <section className="panel stack-form" aria-label="Waste & Savings filters" aria-busy={pending}>
        <div className="utility-graph-actions">
          <Button aria-pressed={view === 'graph'} onClick={() => setView('graph')}>
            Graph view
          </Button>
          <Button aria-pressed={view === 'table'} onClick={() => setView('table')}>
            Table view
          </Button>
          <Button
            onClick={() => {
              setMonth('');
              setFuel('');
              setSort('month');
              setOther(false);
              update(siteId, undefined);
            }}
          >
            Reset filters
          </Button>
          <Button onClick={() => startTransition(() => router.refresh())}>Refresh data</Button>
        </div>
        <div className="form-grid">
          <label>
            Site
            <select
              aria-label="Waste site"
              disabled={pending}
              value={siteId}
              onChange={(event) => {
                setFuel('');
                update(event.target.value, undefined);
              }}
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
            <select
              aria-label="Waste year"
              disabled={pending}
              value={preview.year}
              onChange={(event) => update(siteId, Number(event.target.value))}
            >
              {[...new Set([preview.year, ...preview.years])].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label>
            Month
            <select aria-label="Waste result month" value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="">All months</option>
              {Array.from({ length: 12 }, (_, index) => {
                const code = String(index + 1).padStart(2, '0');
                return (
                  <option key={code} value={code}>
                    {new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
                      new Date(Date.UTC(2000, index, 1)),
                    )}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Fuel type
            <select aria-label="Waste fuel type" value={fuel} onChange={(event) => setFuel(event.target.value)}>
              <option value="">All fuels</option>
              {[...new Set(preview.meters.map((meter) => meter.fuel))].map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select
              aria-label="Waste sort by"
              value={sort}
              onChange={(event) => setSort(event.target.value as UtilityChartSort)}
            >
              <option value="month">Month</option>
              <option value="high-to-low">High to low</option>
              <option value="low-to-high">Low to high</option>
            </select>
          </label>
        </div>
        <div className="utility-graph-actions" role="group" aria-label="Calculation drivers">
          {Object.entries(driverLabels)
            .filter(([code]) => other || ['HDD', 'CDD'].includes(code))
            .map(([code, label]) => (
              <label className="checkbox-label" key={code}>
                <input
                  type="checkbox"
                  disabled={pending || (!drivers.includes(code) && drivers.length >= 3)}
                  checked={drivers.includes(code)}
                  onChange={(event) =>
                    update(
                      siteId,
                      preview.year,
                      event.target.checked
                        ? [...preview.drivers, code]
                        : preview.drivers.filter((driver) => driver !== code),
                    )
                  }
                />
                {label}
              </label>
            ))}
          <Button onClick={() => setOther(!other)}>{other ? 'Hide other drivers' : 'Add other drivers'}</Button>
        </div>
        <p role="status">
          {pending
            ? 'Updating calculations…'
            : `${preview.method} · Baseline ${preview.year - 1} · Reporting ${preview.year}`}
        </p>
        <p className="muted">
          Positive values show savings; negative values show waste. Calculations are experimental. Missing inputs remain
          unavailable.
        </p>
        <div className="utility-graph-actions">
          <Link href={`/org/${orgId}/degree-days?site=${siteId}&year=${preview.year}`}>View HDD &amp; CDD inputs</Link>
          <Link href={`/org/${orgId}/waste-savings?site=${siteId}&evidence=1`}>Saved calculation evidence</Link>
          <Link href={`/org/${orgId}/analysis`}>Advanced Analysis</Link>
        </div>
      </section>
      {!meters.length && (
        <section className="panel">
          <p>No uploaded consumption for this selection.</p>
        </section>
      )}
      {!!meters.length && preview.weather?.required && !preview.weather.ready && (
        <WasteWeather
          key={`${siteId}:${preview.year}`}
          orgId={orgId}
          siteId={siteId}
          year={preview.year}
          manage={manageWeather}
        />
      )}
      {meters.map((meter) => (
        <div key={meter.id}>
          <section className="panel">
            <h2>
              {meter.name} · {meter.fuel.replaceAll('_', ' ')}
            </h2>
            <p role="status">
              {meter.rows.filter((row) => row.variance !== null).length
                ? `${meter.rows.filter((row) => row.variance !== null).length} of ${meter.rows.length} months calculated.`
                : 'Calculation unavailable: the required inputs or model checks need attention.'}
            </p>
            {meter.baselineSource && (
              <p>
                Baseline {preview.year - 1}: {meter.baselineSource.name} (
                {meter.baselineSource.fuel.replaceAll('_', ' ')}). Comparing the same uploaded{' '}
                {meter.baselineSource.endUse} consumption in normalized kWh across the fuel change. Source readings are
                retained in the calculation sheet.
              </p>
            )}
            <p>
              Expected consumption is fitted from {preview.year - 1} consumption and selected drivers. Avoided / wasted
              energy = adjusted expected consumption − actual consumption. The gauge divides the latest three months’
              total avoided / wasted energy by their total adjusted expected consumption.
            </p>
            {meter.downloadable && (
              <a
                href={`/api/v1/organisations/${orgId}/sites/${siteId}/analysis/waste-preview.xlsx?${new URLSearchParams({ year: String(preview.year), meter: meter.id, drivers: preview.drivers.join(',') })}`}
              >
                Download site calculation sheet
              </a>
            )}
            {!!meter.issues.length && (
              <details open>
                <summary>Calculation inputs need attention ({meter.issues.length})</summary>
                <ul>
                  {meter.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          {view === 'table' && (
            <section className="panel table-scroll" aria-label="Waste and savings monthly results">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Actual (kWh)</th>
                    <th>Expected (kWh)</th>
                    <th>Adjusted expected (kWh)</th>
                    <th>Waste / savings (kWh)</th>
                    <th>Cost (£)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {meter.rows
                    .filter((row) => !month || row.month.endsWith(`-${month}`))
                    .sort((a, b) =>
                      sort === 'month'
                        ? a.month.localeCompare(b.month)
                        : (sort === 'high-to-low' ? -1 : 1) * ((a.variance ?? 0) - (b.variance ?? 0)),
                    )
                    .map((row) => (
                      <tr key={row.month}>
                        <th scope="row">{row.month}</th>
                        <td>{value(row.actual)}</td>
                        <td>{value(row.expected)}</td>
                        <td>{value(row.adjusted)}</td>
                        <td>{value(row.variance)}</td>
                        <td>{value(row.cost)}</td>
                        <td>{row.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      ))}
      {view === 'graph' && meters.length > 0 && (
        <WasteCharts
          rows={aggregateWasteRows(meters.map((meter) => meter.rows))}
          month={month}
          sort={sort}
          throughMonth={preview.weather?.required ? preview.weather.throughMonth : undefined}
        />
      )}
    </div>
  );
}
