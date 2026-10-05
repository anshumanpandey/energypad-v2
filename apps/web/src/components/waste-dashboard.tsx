'use client';
import { useState, useTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WastePreview } from '@/domain/analysis/waste-preview';
import { Button } from './ui/button';
import { MetricChart } from './metric-chart';
import { GraphMonthProvider } from './graph-month';
import { formatEnergyValue } from './format-energy-value';

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
}: {
  orgId: string;
  siteId: string;
  sites: { id: string; name: string }[];
  preview: WastePreview;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drivers, setDrivers] = useOptimistic(preview.drivers);
  const [view, setView] = useState('graph');
  const [month, setMonth] = useState('');
  const [fuel, setFuel] = useState('');
  const [sort, setSort] = useState('month');
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
  const points = (rows: WastePreview['meters'][number]['rows'], key: 'actual' | 'expected' | 'adjusted' | 'variance') =>
    [...rows]
      .sort((a, b) =>
        sort === 'month'
          ? a.month.localeCompare(b.month)
          : a[key] === null
            ? b[key] === null
              ? 0
              : 1
            : b[key] === null
              ? -1
              : sort === 'high-to-low'
                ? b[key]! - a[key]!
                : a[key]! - b[key]!,
      )
      .map((row) => ({ month: row.month, value: row[key], note: row.note }));
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
            <select aria-label="Waste sort by" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="month">Month</option>
              <option value="high-to-low">High to low</option>
              <option value="low-to-high">Low to high</option>
            </select>
          </label>
        </div>
        <div role="group" aria-label="Calculation drivers">
          {Object.entries(driverLabels)
            .filter(([code]) => other || ['HDD', 'CDD'].includes(code))
            .map(([code, label]) => (
              <label key={code}>
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
        <Link href={`/org/${orgId}/degree-days?site=${siteId}`}>View HDD &amp; CDD inputs</Link>
        <Link href={`/org/${orgId}/waste-savings?site=${siteId}&evidence=1`}>Saved calculation evidence</Link>
        <Link href={`/org/${orgId}/analysis`}>Advanced Analysis</Link>
      </section>
      {!meters.length && (
        <section className="panel">
          <p>No uploaded consumption for this selection.</p>
        </section>
      )}
      {meters.map((meter) => (
        <div key={meter.id}>
          <section className="panel">
            <h2>
              {meter.name} · {meter.fuel.replaceAll('_', ' ')}
            </h2>
            {meter.downloadable && (
              <a
                href={`/api/v1/organisations/${orgId}/sites/${siteId}/analysis/waste-preview.xlsx?${new URLSearchParams({ year: String(preview.year), meter: meter.id, drivers: preview.drivers.join(',') })}`}
              >
                Download site calculation sheet
              </a>
            )}
            {!!meter.issues.length && (
              <details>
                <summary>Calculation inputs need attention ({meter.issues.length})</summary>
                <ul>
                  {meter.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          {view === 'graph' ? (
            <GraphMonthProvider key={month} initialMonth={month}>
              <div className="graphs-grid">
                <MetricChart
                  title="Actual consumption"
                  unit="kWh"
                  points={points(meter.rows, 'actual')}
                  tone="energy"
                  description="Uploaded monthly consumption."
                />
                <MetricChart
                  title="Expected consumption"
                  unit="kWh"
                  points={points(meter.rows, 'expected')}
                  tone="energy"
                  description="Consumption predicted from the preceding year’s baseline."
                />
                <MetricChart
                  title="Adjusted expected consumption"
                  unit="kWh"
                  points={points(meter.rows, 'adjusted')}
                  tone="energy"
                  description="Expected consumption after applicable non-routine adjustments."
                />
                <MetricChart
                  title="Monthly waste & savings"
                  unit="kWh"
                  points={points(meter.rows, 'variance')}
                  tone="waste"
                  description="Adjusted expected consumption minus actual consumption."
                />
              </div>
            </GraphMonthProvider>
          ) : (
            <section className="panel table-scroll" aria-label="Waste and savings monthly results">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Actual (kWh)</th>
                    <th>Expected (kWh)</th>
                    <th>Adjusted expected (kWh)</th>
                    <th>Waste / savings (kWh)</th>
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
                        <td>{row.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      ))}
    </div>
  );
}
