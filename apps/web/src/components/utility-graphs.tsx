'use client';

import { formatMonth } from '../domain/format-month';
import { useState } from 'react';
import { ChartExpansionGroup, GroupedExpandableChart } from './expandable-chart';
import { useRouter } from 'next/navigation';
import { filterUtilityRows, type UtilityGraphRow, type UtilityCostTarget } from '@/domain/utility-graphs';
import { utilityComparison, sumUtilityAmounts } from '@/domain/utility-comparison';
import { utilityLabel } from '@/domain/consumption-sort';
import { formatEnergyValue } from './format-energy-value';
import { Button } from './ui/button';
import { UtilityBars } from './utility-bars';
import { CarbonFootprintCharts } from './carbon-footprint-charts';
import { MonthlyCarbonGauge } from './monthly-carbon-gauge';
import { MonthlyChartSummary } from './monthly-chart-summary';
import { monthlyActuals } from '@/domain/monthly-chart-summary';
import { sortChartValues, type UtilityChartSort } from '@/domain/utility-chart-sort';

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
  const firstSite = sites[0]?.id ?? '';
  const [filters, setFilters] = useState({ site: firstSite, year: '', month: '01', fuel: '' });
  const [costBasis, setCostBasis] = useState<'net' | 'gross'>('net');
  const [view, setView] = useState<'graph' | 'table' | 'gauge'>('graph');
  const [sortBy, setSortBy] = useState<UtilityChartSort>('month');
  const title = kind === 'consumption' ? 'Consumption' : 'Carbon Footprint';
  const unit = kind === 'consumption' ? 'kWh' : 'kg';
  const years = [...new Set(rows.map((r) => r.month.slice(0, 4)))].sort().reverse();
  const fuels = [...new Set(rows.map((r) => r.fuel))].sort();
  const selectedSite =
    filters.site === '' ? '' : sites.some((site) => site.id === filters.site) ? filters.site : firstSite;
  const visible = sortChartValues(filterUtilityRows(rows, { ...filters, site: selectedSite }), sortBy, (r) => r[kind]);
  const chartRows = filterUtilityRows(rows, { ...filters, site: selectedSite, month: '' });
  const history = filterUtilityRows(rows, { site: selectedSite, fuel: filters.fuel, year: '', month: '' });
  const reportingYear = filters.year || [...new Set(chartRows.map((r) => r.month.slice(0, 4)))].sort().at(-1) || '';
  const period = filters.month ? `${reportingYear}-${filters.month}` : '';
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
    {
      key: 'month' as const,
      label: 'Month',
      all: 'All months',
      items: months.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m })),
    },
    { key: 'year' as const, label: 'Year', all: 'All years', items: years.map((y) => ({ value: y, label: y })) },
    {
      key: 'fuel' as const,
      label: 'Fuel type',
      all: 'All fuels',
      items: fuels.map((f) => ({ value: f, label: utilityLabel(f) })),
    },
  ];
  const filterActions = (
    <div className="utility-graph-actions">
      <div className="waste-view-toggle" role="group" aria-label={`${title} view`}>
        <Button aria-pressed={view === 'graph'} onClick={() => setView('graph')}>
          Graph view
        </Button>
        <Button aria-pressed={view === 'table'} onClick={() => setView('table')}>
          Table view
        </Button>
        {
          <Button
            aria-pressed={view === 'gauge'}
            onClick={() => {
              setView('gauge');
              setFilters((previous) => ({ ...previous, month: previous.month || '01' }));
            }}
          >
            Gauge view
          </Button>
        }
      </div>
      <Button
        onClick={() => {
          setFilters({ site: firstSite, year: '', month: '01', fuel: '' });
          setCostBasis('net');
          setSortBy('month');
        }}
      >
        Reset filters
      </Button>
      <Button onClick={() => router.refresh()}>Refresh data</Button>
    </div>
  );
  const summary = (
    <section className="panel" aria-label={`${title} summary`}>
      <h2>
        {title} · {formatEnergyValue(total, 'Unavailable')} {unit}
      </h2>
      <p>
        {available.length} of {visible.length} site/fuel months available.
        {kind === 'consumption' && ' Missing data remains unavailable; confirmed zero fills are included.'}
      </p>
    </section>
  );
  return (
    <div className={`utility-graphs-page${kind === 'emissions' ? ' carbon-footprint-page' : ' consumption-page'}`}>
      <div className="page-heading waste-page-heading">
        <h1>{title}</h1>
      </div>
      <div className="waste-dashboard-layout">
        <aside className="panel stack-form waste-dashboard-filters" aria-label={`${title} filters`}>
          {
            <fieldset className="waste-site-options">
              <legend>Sites</legend>
              {[{ id: '', name: 'All Sites' }, ...sites].map((site) => (
                <label className="waste-site-option" key={site.id}>
                  <input
                    type="radio"
                    name={`${kind}-site`}
                    checked={selectedSite === site.id}
                    onChange={() => setFilters((previous) => ({ ...previous, site: site.id }))}
                  />
                  <span>{site.name}</span>
                </label>
              ))}
            </fieldset>
          }
          <div className="form-grid">
            {options
              .filter((option) => option.key !== 'site')
              .map(({ key, label, all, items }) => (
                <label key={key}>
                  {label}
                  <select
                    aria-label={`${title} ${label.toLowerCase()}`}
                    value={filters[key]}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilters((previous) => ({ ...previous, [key]: value }));
                    }}
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
            <label>
              Sort by
              <select
                aria-label={`${title} sort by`}
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as UtilityChartSort)}
              >
                <option value="month">Month order</option>
                <option value="high-to-low">Actual: high to low</option>
                <option value="low-to-high">Actual: low to high</option>
              </select>
            </label>
          </div>
          {filterActions}
        </aside>
        <ChartExpansionGroup enabled={view !== 'table'} key={`${kind}-${view}`}>
          <div className={`waste-dashboard-results${view !== 'table' ? ' carbon-chart-grid' : ''}`}>
            {!chartRows.length ? (
              <section className="panel">
                <p>No data for this selection. Upload consumption data or choose different filters.</p>
              </section>
            ) : view !== 'table' ? (
              <GroupedExpandableChart
                title={kind === 'consumption' ? 'Monthly consumption' : 'Monthly carbon footprint'}
              >
                {view === 'gauge' ? (
                  <MonthlyCarbonGauge
                    kind={kind}
                    points={monthlyActuals(chartRows, kind)}
                    history={monthlyActuals(history, kind)}
                    period={period}
                  />
                ) : (
                  <UtilityLines
                    rows={chartRows}
                    kind={kind}
                    title={title}
                    unit={unit}
                    selectedMonth={filters.month}
                    history={history}
                    period={period}
                    sortBy={sortBy}
                  />
                )}
              </GroupedExpandableChart>
            ) : (
              <section className="panel">
                <MonthlyChartSummary compact points={monthlyActuals(history, kind)} period={period} unit={unit} />
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
                        <th>{costBasis === 'gross' ? 'Gross cost' : 'Net cost'}</th>
                        <th>Data status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortChartValues(chartRows, sortBy, (r) => r[kind]).map((row) => (
                        <tr
                          key={`${row.siteId}-${row.fuel}-${row.month}`}
                          className={row.month.slice(5, 7) === filters.month ? 'utility-selected-month' : undefined}
                          aria-current={row.month.slice(5, 7) === filters.month ? 'true' : undefined}
                        >
                          <td>{row.siteName}</td>
                          <td>{row.month.slice(0, 4)}</td>
                          <td>{formatMonth(row.month)}</td>
                          <td>{utilityLabel(row.fuel)}</td>
                          <td title={row[kind] ?? undefined}>{formatEnergyValue(row[kind], 'Unavailable')}</td>
                          <td>
                            {formatEnergyValue(costBasis === 'gross' ? row.grossCost : row.cost, 'Unavailable')}
                            {(costBasis === 'gross' ? row.grossCost : row.cost) != null && row.currency
                              ? ` ${row.currency}`
                              : ''}
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
            {kind === 'consumption' && chartRows.length > 0 && (
              <CostComparison
                rows={chartRows}
                history={history}
                period={period}
                targets={targets}
                fuel={filters.fuel}
                view={view === 'gauge' ? 'graph' : view}
                selectedMonth={filters.month}
                costBasis={costBasis}
                onCostBasisChange={setCostBasis}
                sortBy={sortBy}
              />
            )}
            {kind === 'emissions' && chartRows.length > 0 && (
              <CarbonFootprintCharts
                rows={chartRows}
                history={history}
                targets={targets.filter((t) => !selectedSite || t.siteId === selectedSite)}
                year={reportingYear}
                month={filters.month}
                fuel={filters.fuel}
                view={view}
                sortBy={sortBy}
              />
            )}
            {summary}
          </div>
        </ChartExpansionGroup>
      </div>
    </div>
  );
}

function CostComparison({
  rows,
  history,
  targets,
  fuel,
  view,
  selectedMonth,
  period,
  costBasis,
  onCostBasisChange,
  sortBy,
}: {
  rows: UtilityGraphRow[];
  history: UtilityGraphRow[];
  targets: UtilityCostTarget[];
  fuel: string;
  view: 'graph' | 'table';
  selectedMonth: string;
  period: string;
  costBasis: 'net' | 'gross';
  onCostBasisChange: (basis: 'net' | 'gross') => void;
  sortBy: UtilityChartSort;
}) {
  const siteComparisons = utilityComparison(rows, targets, fuel);
  const comparison = sortChartValues(
    [...new Set(siteComparisons.map((row) => row.month))].map((month) => {
      const matching = siteComparisons.filter((row) => row.month === month);
      return {
        month,
        consumption: sumUtilityAmounts(matching.map((row) => row.consumption)),
        targetEnergy: sumUtilityAmounts(matching.map((row) => row.targetEnergy)),
        targetScope: [...new Set(matching.map((row) => row.targetScope))].join(' / '),
      };
    }),
    sortBy,
    (row) => row.consumption,
  );
  const vatControl = (
    <div className="waste-cost-basis">
      <label>
        <input
          type="checkbox"
          checked={costBasis === 'gross'}
          onChange={(event) => onCostBasisChange(event.target.checked ? 'gross' : 'net')}
        />
        Include VAT
      </label>
    </div>
  );
  const currencies = [...new Set(history.map((r) => r.currency).filter((c): c is string => !!c))];
  const costField = costBasis === 'gross' ? 'grossCost' : 'cost';
  return (
    <>
      {view === 'graph' ? (
        <GroupedExpandableChart title="Actual vs target consumption">
          <UtilityBars
            points={comparison.map((row) => ({ month: row.month, actual: row.consumption, target: row.targetEnergy }))}
            showHelp={false}
            compactSummary
            actualColor="#94c11f"
            title="Actual vs target consumption"
            unit="kWh"
            diverging
            sortBy={sortBy}
            selectedMonth={selectedMonth}
            period={period}
            summaryPoints={monthlyActuals(history, 'consumption')}
            targetNote={
              comparison.some((r) => r.targetScope === 'Site-wide target')
                ? 'Target: site-wide total from the uploaded workbook.'
                : 'Target: selected fuel.'
            }
          />
        </GroupedExpandableChart>
      ) : (
        <section className="panel">
          <MonthlyChartSummary compact points={monthlyActuals(history, 'consumption')} period={period} unit="kWh" />
          <div className="analysis-table" role="region" aria-label="Actual vs target consumption table" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Actual (kWh)</th>
                  <th>Target (kWh)</th>
                  <th>Target scope</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((r) => (
                  <tr
                    key={r.month}
                    className={r.month.slice(5, 7) === selectedMonth ? 'utility-selected-month' : undefined}
                    aria-current={r.month.slice(5, 7) === selectedMonth ? 'true' : undefined}
                  >
                    <th>{formatMonth(r.month)}</th>
                    <td>{formatEnergyValue(r.consumption, 'Unavailable')}</td>
                    <td>{formatEnergyValue(r.targetEnergy, 'Unavailable')}</td>
                    <td>{r.targetScope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {currencies.map((currency) => {
        const costHistory = monthlyActuals(
          history.filter((r) => r.currency === currency),
          costField,
        );
        const costPoints = sortChartValues(
          monthlyActuals(
            rows.filter((r) => r.currency === currency),
            costField,
          ),
          sortBy,
          (r) => r.actual,
        );
        return view === 'graph' ? (
          <GroupedExpandableChart key={currency} title={`Cost · ${currency}`}>
            <UtilityBars
              controls={vatControl}
              showHelp={false}
              compactSummary
              actualColor="#4989c6"
              points={costPoints.map((r) => ({ ...r, target: null }))}
              title={`Cost · ${currency}`}
              unit={currency}
              selectedMonth={selectedMonth}
              actualOnly
              sortBy={sortBy}
              period={period}
              summaryPoints={costHistory}
              targetNote={costBasis === 'gross' ? 'Gross cost includes VAT.' : 'Net cost excludes VAT.'}
            />
          </GroupedExpandableChart>
        ) : (
          <section key={currency} className="panel">
            <h2>
              {costBasis === 'gross' ? 'Gross' : 'Net'} cost ({currency})
            </h2>
            {vatControl}
            <MonthlyChartSummary compact points={costHistory} period={period} unit={currency} />
            <div className="analysis-table" role="region" aria-label="Cost table" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {costPoints.map((r) => (
                    <tr
                      key={r.month}
                      className={r.month.slice(5, 7) === selectedMonth ? 'utility-selected-month' : undefined}
                      aria-current={r.month.slice(5, 7) === selectedMonth ? 'true' : undefined}
                    >
                      <th>{formatMonth(r.month)}</th>
                      <td>
                        {formatEnergyValue(r.actual, 'Unavailable')} {currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {!currencies.length && (
        <section className="panel">
          <h2>Cost</h2>
          <p>No cost values available for this selection.</p>
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
  selectedMonth,
  history,
  period,
  sortBy,
}: {
  rows: UtilityGraphRow[];
  kind: 'consumption' | 'emissions' | 'cost';
  title: string;
  unit: string;
  selectedMonth: string;
  history: UtilityGraphRow[];
  period: string;
  sortBy: UtilityChartSort;
}) {
  const dates = sortChartValues(monthlyActuals(rows, kind), sortBy, (r) => r.actual).map((r) => r.month);
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
      <MonthlyChartSummary compact points={monthlyActuals(history, kind)} period={period} unit={unit} />
      <div className="utility-chart-scroll">
        <svg viewBox="0 0 800 305" role="img" aria-label={`${title} monthly line graph`}>
          <title>{`${title} by site, month and fuel in ${unit}`}</title>
          {dates.map((date, index) =>
            date.slice(5, 7) === selectedMonth ? (
              <rect
                key={`selected-${formatMonth(date)}`}
                data-selected-month={date}
                x={x(index) - 13}
                y="35"
                width="26"
                height="210"
                fill="#e9f3dc"
              />
            ) : null,
          )}
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
              <text
                key={date}
                data-month={date}
                transform={`translate(${x(index)},260) rotate(-35)`}
                textAnchor="end"
                fontSize="11"
                fontWeight={date.slice(5, 7) === selectedMonth ? 'bold' : 'normal'}
              >
                {date}
              </text>
            ) : null,
          )}
          {series.map((group, seriesIndex) => {
            const points = dates.map((date) => group.rows.find((r) => r.month === date));
            const color = colors[seriesIndex % colors.length];
            const path = points
              .map((row, index) => {
                if (!row || row[kind] === null) return '';
                const previous = points[index - 1];
                if (!previous || previous[kind] === null) return `M ${x(index)} ${y(Number(row[kind]))}`;
                const midpoint = (x(index - 1) + x(index)) / 2;
                return `C ${midpoint} ${y(Number(previous[kind]))} ${midpoint} ${y(Number(row[kind]))} ${x(index)} ${y(Number(row[kind]))}`;
              })
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
                      r={row.month.slice(5, 7) === selectedMonth ? 7 : 5}
                      stroke={row.month.slice(5, 7) === selectedMonth ? '#142d29' : undefined}
                      strokeWidth="2"
                      fill={color}
                      tabIndex={0}
                      role="img"
                      aria-label={`${row.siteName}, ${utilityLabel(row.fuel)}, ${formatMonth(row.month)}: ${row[kind]} ${unit}${row.zeroFilled ? ', confirmed zero fill' : ''}`}
                    >
                      <title>{`${row.siteName} · ${utilityLabel(row.fuel)} · ${formatMonth(row.month)}: ${row[kind]} ${unit}${row.zeroFilled ? ' · confirmed zero fill' : ''}`}</title>
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
