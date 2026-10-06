'use client';
import { formatMonth } from '../domain/format-month';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { UtilityCostTarget, UtilityGraphRow } from '@/domain/utility-graphs';
import { filterUtilityRows } from '@/domain/utility-graphs';
import type { WastePreview } from '@/domain/analysis/waste-preview';
import {
  dashboardReportCsv,
  overviewReportRows,
  reportCoverage,
  reportSortOptions,
  sortOverviewReports,
} from '@/domain/legacy-reports';
import { utilityComparison } from '@/domain/utility-comparison';
import { utilityLabel } from '@/domain/consumption-sort';
import { formatEnergyValue } from './format-energy-value';
import { Button } from './ui/button';
import { WasteWeather } from './waste-weather';

const months = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, '0'),
  name: new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, index))),
}));
const colors = [
  '#168578',
  '#4989c6',
  '#cd7334',
  '#9b4c9e',
  '#578138',
  '#b74655',
  '#bca02b',
  '#735bc1',
  '#317888',
  '#aa566e',
  '#569e83',
  '#6b7681',
];

export function ReportsDashboard({
  orgId,
  sites,
  siteId,
  year,
  years,
  rows,
  targets,
  preview,
  manageWeather,
}: {
  orgId: string;
  sites: { id: string; name: string }[];
  siteId: string;
  year: number;
  years: number[];
  rows: UtilityGraphRow[];
  targets: UtilityCostTarget[];
  preview: WastePreview | null;
  manageWeather: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState('');
  const [fuel, setFuel] = useState('');
  const [sort, setSort] = useState('month');
  const [metric, setMetric] = useState<'consumption' | 'emissions'>('consumption');
  const [view, setView] = useState('graph');
  const filters = { site: siteId, year: String(year), month, fuel };
  const yearlyRows = filterUtilityRows(rows, { ...filters, month: '' });
  const visibleRows = filterUtilityRows(rows, filters);
  const overview = sortOverviewReports(overviewReportRows(visibleRows, preview), sort);
  const coverage = reportCoverage(yearlyRows, year);
  const available = coverage.filter((item) => item.available).length;
  const comparison = utilityComparison(visibleRows, targets, fuel);
  const points = comparison.map((row) => ({
    month: row.month,
    actual: row[metric],
    target: metric === 'consumption' ? row.targetEnergy : row.targetCarbon,
    scope: row.targetScope,
  }));
  const unit = metric === 'consumption' ? 'kWh' : 'kgCO2e';
  const title = metric === 'consumption' ? 'Energy Consumption vs Target' : 'Carbon Emissions vs Target';
  const amount = (value: string | number | null) => formatEnergyValue(value, 'Unavailable');
  const update = (site: string, selectedYear?: number) => {
    const query = new URLSearchParams({ site });
    if (selectedYear !== undefined) query.set('year', String(selectedYear));
    startTransition(() => router.push(`/org/${orgId}/reports?${query}`));
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([dashboardReportCsv(overview, targets, fuel, coverage)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `energiepad-report-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="reports-dashboard">
      <section className="panel stack-form" aria-label="Reports dashboard filters" aria-busy={pending}>
        <div className="form-grid">
          <label>
            Site
            <select
              aria-label="Site"
              disabled={pending}
              value={siteId}
              onChange={(event) => update(event.target.value)}
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
              aria-label="Year"
              disabled={pending}
              value={year}
              onChange={(event) => update(siteId, Number(event.target.value))}
            >
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Month
            <select aria-label="Month" value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="">All months</option>
              {months.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fuel Source
            <select aria-label="Fuel Source" value={fuel} onChange={(event) => setFuel(event.target.value)}>
              <option value="">All fuels</option>
              {[...new Set(rows.map((row) => row.fuel))].sort().map((value) => (
                <option key={value} value={value}>
                  {utilityLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Display
            <select aria-label="Display" value={view} onChange={(event) => setView(event.target.value)}>
              <option value="graph">Graph</option>
              <option value="table">Table</option>
              <option value="pie">Pie</option>
            </select>
          </label>
          <label>
            Sort
            <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              {reportSortOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="utility-graph-actions">
          <Button onClick={download} disabled={pending || !overview.length}>
            Download Entire Document
          </Button>
          <Button onClick={() => window.print()}>Print report</Button>
        </div>
      </section>
      {preview?.weather?.required && !preview.weather.ready && (
        <WasteWeather key={`${siteId}-${year}`} orgId={orgId} siteId={siteId} year={year} manage={manageWeather} />
      )}
      <section className="panel">
        <h2>Overview</h2>
        <p>
          Monthly uploaded consumption, net financial cost, carbon impacts and calculated avoided (+) or wasted (-)
          energy. Missing inputs remain unavailable.
        </p>
        <div className="analysis-table" role="region" aria-label="Reports overview" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Energy</th>
                <th>Utility</th>
                <th>Total utility consumption (kWh)</th>
                <th>Financial cost (£)</th>
                <th>Carbon impacts (kgCO2e)</th>
                <th>(+) Avoided and (-) Wasted Energy (kWh)</th>
                <th>Financial Cost (£)</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((row) => (
                <tr key={`${row.month}-${row.meterId ?? row.fuel}`}>
                  <th>{formatMonth(row.month)}</th>
                  <td>{row.endUse}</td>
                  <td>{utilityLabel(row.fuel)}</td>
                  <td>{amount(row.consumption)}</td>
                  <td>
                    {row.currency === 'GBP'
                      ? amount(row.cost)
                      : row.cost !== null && row.currency
                        ? `${amount(row.cost)} ${row.currency}`
                        : 'Unavailable'}
                  </td>
                  <td>{amount(row.emissions)}</td>
                  <td title={row.calculationNote}>{amount(row.variance)}</td>
                  <td title={row.calculationNote}>{amount(row.wasteCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!overview.length && <p>No uploaded data for this selection.</p>}
        <p>
          Waste figures use the same selected-year model and drivers as Waste &amp; Savings. Cost excludes VAT;
          avoided/wasted cost is available for GBP readings.
        </p>
        <div className="utility-graph-actions">
          {preview?.meters.map((meter) => (
            <Link
              key={meter.id}
              href={`/api/v1/organisations/${orgId}/sites/${siteId}/analysis/waste-preview.xlsx?${new URLSearchParams({ year: String(year), meter: meter.id, drivers: preview.drivers.join(',') })}`}
            >
              Download {meter.name} calculation sheet
            </Link>
          ))}
        </div>
      </section>
      <div className="reports-summary-grid">
        <section className="panel utility-lines" aria-label="Reports target comparison">
          <h2>{title}</h2>
          <div className="utility-graph-actions">
            <Button aria-pressed={metric === 'consumption'} onClick={() => setMetric('consumption')}>
              Consumption (kWh)
            </Button>
            <Button aria-pressed={metric === 'emissions'} onClick={() => setMetric('emissions')}>
              Carbon (kg)
            </Button>
          </div>
          <p>
            Actual values against uploaded targets. Site-wide targets apply when no complete fuel target is available.
          </p>
          {view === 'graph' && <ReportLines points={points} unit={unit} title={title} />}
          {view === 'pie' && (
            <div className="reports-pies">
              {(['actual', 'target'] as const).map((key) => (
                <ReportPie
                  key={key}
                  title={`${key === 'actual' ? 'Actual' : 'Target'} monthly distribution`}
                  points={points.map((point) => ({ label: point.month, value: point[key] }))}
                  unit={unit}
                />
              ))}
            </div>
          )}
          <details open={view === 'table'}>
            <summary>View comparison data</summary>
            <div className="analysis-table">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Actual ({unit})</th>
                    <th>Target ({unit})</th>
                    <th>Target scope</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.month}>
                      <th>{formatMonth(point.month)}</th>
                      <td>{amount(point.actual)}</td>
                      <td>{amount(point.target)}</td>
                      <td>{point.scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="panel report-coverage">
          <h2>Number Of Reports</h2>
          <p>
            {year} · Reports this year {available}/12 · Missing Report: {12 - available}
          </p>
          <svg viewBox="0 0 200 200" role="img" aria-label={`${available} of 12 monthly reports available`}>
            <circle cx="100" cy="100" r="72" fill="none" stroke="#edf0f2" strokeWidth="20" />
            <circle
              cx="100"
              cy="100"
              r="72"
              fill="none"
              stroke="#4989c6"
              strokeWidth="20"
              pathLength="12"
              strokeDasharray={`${available} ${12 - available}`}
              transform="rotate(-90 100 100)"
            />
            <text x="100" y="108" textAnchor="middle" fontSize="25">
              {available}/12
            </text>
          </svg>
          <p>
            Coverage counts months with complete uploaded consumption for the selected fuel(s). Waste and carbon
            calculations may still need additional inputs.
          </p>
          <details>
            <summary>View monthly report coverage</summary>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((item) => (
                  <tr key={item.month}>
                    <th>{formatMonth(item.month)}</th>
                    <td>{item.available ? 'Available' : 'Missing / incomplete'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      </div>
    </div>
  );
}

function ReportLines({
  points,
  title,
  unit,
}: {
  points: { month: string; actual: string | null; target: string | null }[];
  title: string;
  unit: string;
}) {
  const maximum = Math.max(1, ...points.flatMap((point) => [Number(point.actual ?? 0), Number(point.target ?? 0)]));
  const x = (index: number) => 65 + (index * 600) / Math.max(1, points.length - 1);
  const y = (value: string) => 225 - (Number(value) / maximum) * 180;
  return (
    <svg viewBox="0 0 720 285" role="img" aria-label={`${title} line graph`}>
      {[0, 0.5, 1].map((value) => (
        <g key={value}>
          <line x1="65" x2="665" y1={225 - value * 180} y2={225 - value * 180} stroke="#dce5e3" />
          <text x="55" y={230 - value * 180} textAnchor="end" fontSize="11">
            {Intl.NumberFormat('en-GB', { notation: 'compact' }).format(maximum * value)}
          </text>
        </g>
      ))}
      {(['actual', 'target'] as const).map((key, series) => (
        <g key={key}>
          <path
            d={points
              .map((point, index) =>
                point[key] === null
                  ? ''
                  : `${index > 0 && points[index - 1][key] !== null ? 'L' : 'M'} ${x(index)} ${y(point[key]!)}`,
              )
              .join(' ')}
            fill="none"
            stroke={colors[series]}
            strokeWidth="3"
          />
          {points.map(
            (point, index) =>
              point[key] !== null && (
                <circle key={point.month} cx={x(index)} cy={y(point[key]!)} r="4" fill={colors[series]} tabIndex={0}>
                  <title>{`${formatMonth(point.month)}: ${key} ${point[key]} ${unit}`}</title>
                </circle>
              ),
          )}
          <text x={230 + series * 180} y="282" fill={colors[series]} fontSize="13">
            {series === 0 ? 'Actual' : 'Target'} ({unit})
          </text>
        </g>
      ))}
      {points.map((point, index) => (
        <text key={point.month} x={x(index)} y="246" textAnchor="middle" fontSize="11">
          {formatMonth(point.month)}
        </text>
      ))}
    </svg>
  );
}

function ReportPie({
  title,
  points,
  unit,
}: {
  title: string;
  points: { label: string; value: string | null }[];
  unit: string;
}) {
  const total = points.reduce((sum, point) => sum + Number(point.value ?? 0), 0);
  return (
    <div>
      <h3>{title}</h3>
      {!points.length || points.some((point) => point.value === null) || total <= 0 ? (
        <p>Complete positive monthly values are required for this pie chart.</p>
      ) : (
        <>
          <svg viewBox="0 0 200 200" role="img" aria-label={title}>
            {points.map((point, index) => {
              const length = (Number(point.value) / total) * 100;
              const start =
                (points.slice(0, index).reduce((sum, item) => sum + Number(item.value ?? 0), 0) / total) * 100;
              return (
                <circle
                  key={point.label}
                  cx="100"
                  cy="100"
                  r="65"
                  fill="none"
                  stroke={colors[index % colors.length]}
                  strokeWidth="35"
                  pathLength="100"
                  strokeDasharray={`${length} ${100 - length}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 100 100)"
                >
                  <title>{`${formatMonth(point.label)}: ${point.value} ${unit}`}</title>
                </circle>
              );
            })}
          </svg>
          <ul>
            {points.map((point, index) => (
              <li key={point.label} style={{ color: colors[index % colors.length] }}>
                {formatMonth(point.label)}: {formatEnergyValue(point.value)} {unit}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
