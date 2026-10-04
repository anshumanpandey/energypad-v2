'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { filterUtilityRows, type UtilityGraphRow, type UtilityCostTarget } from '@/domain/utility-graphs';
import { utilityComparison } from '@/domain/utility-comparison';
import { utilityLabel } from '@/domain/consumption-sort';
import { formatEnergyValue } from './format-energy-value';
import { Button } from './ui/button';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const colors = ['#168578', '#536bc7', '#cd7334', '#9b4c9e', '#578138', '#b74655'];

export function UtilityGraphs({
  rows,
  sites,
  kind,
  targets,
}: {
  rows: UtilityGraphRow[];
  sites: { id: string; name: string }[];
  kind: 'consumption' | 'emissions';
  targets: UtilityCostTarget[];
}) {
  const router = useRouter();
  const [filters, setFilters] = useState({ site: '', year: '', month: '', fuel: '' });
  const [view, setView] = useState<'graph' | 'table'>('graph');
  const title = kind === 'consumption' ? 'Consumption' : 'Emissions';
  const unit = kind === 'consumption' ? 'kWh' : 'kgCO2e';
  const years = [...new Set(rows.map((r) => r.month.slice(0, 4)))].sort().reverse();
  const fuels = [...new Set(rows.map((r) => r.fuel))].sort();
  const visible = filterUtilityRows(rows, filters);
  const available = visible.filter((r) => r[kind] !== null);
  const total =
    visible.length && available.length === visible.length
      ? available.reduce((sum, row) => sum + Number(row[kind]), 0)
      : null;
  const options = [
    {
      key: 'site' as const,
      label: 'Site',
      all: 'All sites',
      items: sites.map((s) => ({ value: s.id, label: s.name })),
    },
    { key: 'year' as const, label: 'Year', all: 'All years', items: years.map((y) => ({ value: y, label: y })) },
    {
      key: 'month' as const,
      label: 'Month',
      all: 'All months',
      items: months.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m })),
    },
    {
      key: 'fuel' as const,
      label: 'Fuel type',
      all: 'All fuels',
      items: fuels.map((f) => ({ value: f, label: utilityLabel(f) })),
    },
  ];
  return (
    <div className="utility-graphs-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MONTHLY UTILITY PERFORMANCE</span>
          <h1>{title}</h1>
          <p>
            {kind === 'consumption'
              ? 'Compare monthly energy consumption across sites and fuels.'
              : 'Compare monthly emissions calculated from consumption and emission factors.'}
          </p>
        </div>
      </div>
      <section className="panel stack-form" aria-label={`${title} filters`}>
        <div className="form-grid">
          {options.map(({ key, label, all, items }) => (
            <label key={key}>
              {label}
              <select
                aria-label={`${title} ${label.toLowerCase()}`}
                value={filters[key]}
                onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}
              >
                <option value="">{all}</option>
                {items.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="utility-graph-actions">
          <div role="group" aria-label={`${title} view`}>
            <Button aria-pressed={view === 'graph'} onClick={() => setView('graph')}>
              Graph view
            </Button>
            <Button aria-pressed={view === 'table'} onClick={() => setView('table')}>
              Table view
            </Button>
          </div>
          <Button
            onClick={() => {
              setFilters({ site: '', year: '', month: '', fuel: '' });
            }}
          >
            Reset filters
          </Button>
          <Button onClick={() => router.refresh()}>Refresh data</Button>
        </div>
      </section>
      <section className="panel" aria-label={`${title} summary`}>
        <h2>
          {title} · {formatEnergyValue(total, 'Unavailable')} {unit}
        </h2>
        <p>
          {available.length} of {visible.length} site/fuel months available. Missing data remains unavailable; confirmed
          zero fills are included.
        </p>
        {kind === 'emissions' && (
          <p>GB · Location based · kgCO2e per kWh. A utility factor takes priority over a site-wide factor.</p>
        )}
      </section>
      {!visible.length ? (
        <section className="panel">
          <p>No data for this selection. Upload consumption data or choose different filters.</p>
        </section>
      ) : view === 'graph' ? (
        <UtilityLines rows={visible} kind={kind} title={title} unit={unit} />
      ) : (
        <section className="panel">
          <div className="analysis-table" role="region" aria-label={`${title} table`} tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Year</th>
                  <th>Month</th>
                  <th>Fuel type</th>
                  <th>
                    {title} ({unit})
                  </th>
                  <th>Net cost</th>
                  <th>Data status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={`${row.siteId}-${row.fuel}-${row.month}`}>
                    <td>{row.siteName}</td>
                    <td>{row.month.slice(0, 4)}</td>
                    <td>{months[Number(row.month.slice(5, 7)) - 1]}</td>
                    <td>{utilityLabel(row.fuel)}</td>
                    <td title={row[kind] ?? undefined}>{formatEnergyValue(row[kind], 'Unavailable')}</td>
                    <td>
                      {formatEnergyValue(row.cost, 'Unavailable')}
                      {row.cost !== null && row.currency ? ` ${row.currency}` : ''}
                    </td>
                    <td>
                      {row[kind] === null
                        ? row.notes.join(' ') || 'Missing consumption.'
                        : row.zeroFilled
                          ? 'Missing month filled with 0 after confirmation'
                          : 'Available'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {kind === 'consumption' && visible.length > 0 && (
        <CostComparison rows={visible} targets={targets} fuel={filters.fuel} view={view} />
      )}
    </div>
  );
}

function CostComparison({
  rows,
  targets,
  fuel,
  view,
}: {
  rows: UtilityGraphRow[];
  targets: UtilityCostTarget[];
  fuel: string;
  view: 'graph' | 'table';
}) {
  const comparison = utilityComparison(rows, targets, fuel);
  const series = comparison.flatMap((row) => [
    { ...row, siteId: `${row.siteId}-actual`, siteName: `${row.siteName} · Actual` },
    {
      ...row,
      siteId: `${row.siteId}-target`,
      siteName: `${row.siteName} · Target`,
      consumption: row.targetEnergy,
      cost: row.targetCost,
      currency: row.targetCurrency,
    },
  ]);
  const currencies = [...new Set(series.map((r) => r.currency).filter((c): c is string => !!c))];
  return (
    <>
      <section className="panel">
        <h2>Actual vs target consumption and cost</h2>
        <p>
          Cost uses net amounts excluding VAT. Missing target costs remain unavailable. Set monthly target cost and
          currency in Targets &amp; Monitoring.
        </p>
        {fuel && (
          <p>Site-wide targets cannot be allocated to an individual fuel; a fuel-specific target is required.</p>
        )}
      </section>
      {view === 'graph' ? (
        <>
          <UtilityLines rows={series} kind="consumption" title="Actual vs target consumption" unit="kWh" />
          {currencies.map((currency) => (
            <UtilityLines
              key={currency}
              rows={series.map((r) => ({ ...r, cost: r.currency === currency ? r.cost : null }))}
              kind="cost"
              title={`Actual vs target cost · ${currency}`}
              unit={currency}
            />
          ))}
          {!currencies.length && (
            <section className="panel">
              <h2>Actual vs target cost</h2>
              <p>No cost values available for this selection.</p>
            </section>
          )}
        </>
      ) : (
        <section className="panel">
          <div className="analysis-table" role="region" aria-label="Actual vs target cost table" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Month</th>
                  <th>Actual consumption (kWh)</th>
                  <th>Target consumption (kWh)</th>
                  <th>Actual net cost</th>
                  <th>Target net cost</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={`${row.siteId}-${row.month}`}>
                    <td>{row.siteName}</td>
                    <td>{row.month}</td>
                    <td>{formatEnergyValue(row.consumption, 'Unavailable')}</td>
                    <td>{formatEnergyValue(row.targetEnergy, 'Unavailable')}</td>
                    <td>
                      {formatEnergyValue(row.cost, 'Unavailable')} {row.cost !== null ? row.currency : ''}
                    </td>
                    <td>
                      {formatEnergyValue(row.targetCost, 'Unavailable')}{' '}
                      {row.targetCost !== null ? row.targetCurrency : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function UtilityLines({
  rows,
  kind,
  title,
  unit,
}: {
  rows: UtilityGraphRow[];
  kind: 'consumption' | 'emissions' | 'cost';
  title: string;
  unit: string;
}) {
  const dates = [...new Set(rows.map((r) => r.month))].sort();
  const series = [...new Set(rows.map((r) => `${r.siteId}|${r.fuel}`))].map((key) => ({
    key,
    rows: rows.filter((r) => `${r.siteId}|${r.fuel}` === key),
  }));
  const maximum = Math.max(1, ...rows.map((r) => Number(r[kind] ?? 0)));
  const x = (index: number) => (dates.length === 1 ? 400 : 80 + (index * 660) / (dates.length - 1));
  const y = (value: number) => 240 - (value / maximum) * 195;
  return (
    <section className="panel utility-lines" aria-label={`${title} graph`}>
      <h2>
        Monthly {title.toLowerCase()} ({unit})
      </h2>
      <p>
        Each line represents one site and fuel. Hover or focus a point for its exact value. Lines break where data is
        unavailable.
      </p>
      <div className="utility-chart-scroll">
        <svg viewBox="0 0 800 305" role="img" aria-label={`${title} monthly line graph`}>
          <title>
            {title} by site, month and fuel in {unit}
          </title>
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <line x1="80" x2="740" y1={y(maximum * fraction)} y2={y(maximum * fraction)} stroke="#dce5e3" />
              <text x="70" y={y(maximum * fraction) + 4} textAnchor="end" fontSize="12">
                {Intl.NumberFormat('en', { notation: 'compact' }).format(maximum * fraction)}
              </text>
            </g>
          ))}
          {dates.map((date, index) =>
            dates.length <= 24 || index % Math.ceil(dates.length / 12) === 0 ? (
              <text key={date} transform={`translate(${x(index)},260) rotate(-35)`} textAnchor="end" fontSize="11">
                {date}
              </text>
            ) : null,
          )}
          {series.map((group, seriesIndex) => {
            const points = dates.map((date) => group.rows.find((r) => r.month === date));
            const color = colors[seriesIndex % colors.length];
            const path = points
              .map((row, index) =>
                row && row[kind] !== null
                  ? `${index && points[index - 1]?.[kind] != null ? 'L' : 'M'} ${x(index)} ${y(Number(row[kind]))}`
                  : '',
              )
              .join(' ');
            return (
              <g key={group.key}>
                <path d={path} fill="none" stroke={color} strokeWidth="2" />
                {points.map((row, index) =>
                  row && row[kind] !== null ? (
                    <circle
                      key={row.month}
                      cx={x(index)}
                      cy={y(Number(row[kind]))}
                      r="5"
                      fill={color}
                      tabIndex={0}
                      role="img"
                      aria-label={`${row.siteName}, ${utilityLabel(row.fuel)}, ${row.month}: ${row[kind]} ${unit}${row.zeroFilled ? ', confirmed zero fill' : ''}`}
                    >
                      <title>
                        {row.siteName} · {utilityLabel(row.fuel)} · {row.month}: {row[kind]} {unit}
                        {row.zeroFilled ? ' · confirmed zero fill' : ''}
                      </title>
                    </circle>
                  ) : null,
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="utility-chart-legend">
        {series.map((group, index) => (
          <li key={group.key}>
            <span style={{ background: colors[index % colors.length] }} />
            {group.rows[0].siteName} · {utilityLabel(group.rows[0].fuel)}
          </li>
        ))}
      </ul>
    </section>
  );
}
