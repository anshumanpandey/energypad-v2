'use client';

import { ChartMonthDays } from './chart-month-days';
import { formatMonth } from '../domain/format-month';
import { useState, type ReactNode } from 'react';
import { formatEnergyValue } from './format-energy-value';
import { WasteDirectionText } from './waste-direction';
import { useGraphMonth } from './graph-month';
import { monthlyChartChange } from '@/domain/monthly-chart-change';

export type ChartPoint = { month: string; value: string | number | null; note?: string };

export function MetricChart({
  title,
  unit,
  points,
  tone,
  description,
  comparePreviousMonth = false,
  showHelp = true,
  calendarMonth,
  hideCalendarMonth = false,
  curved = false,
  chartType = 'line',
  showCoverage = true,
  controls,
}: {
  title: string;
  unit: string;
  points: ChartPoint[];
  tone: 'energy' | 'carbon' | 'waste';
  description: string;
  comparePreviousMonth?: boolean;
  showHelp?: boolean;
  calendarMonth?: string;
  hideCalendarMonth?: boolean;
  curved?: boolean;
  chartType?: 'line' | 'bar';
  showCoverage?: boolean;
  controls?: ReactNode;
}) {
  const month = useGraphMonth();
  const [selected, setSelected] = useState<string | null>(null);
  const finite = (p: ChartPoint) => p.value !== null && Number.isFinite(Number(p.value));
  const values = points.filter(finite).map((p) => Number(p.value));
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const span = high - low || 1;
  const y = (value: number) => 220 - ((value - low) / span) * 180;
  const step = 600 / Math.max(points.length, 1);
  const linePath = points
    .map((point, index) => {
      if (!finite(point)) return '';
      const x = 80 + step * index + step / 2;
      const pointY = y(Number(point.value));
      const previous = index > 0 ? points[index - 1] : null;
      if (!previous || !finite(previous)) return `M ${x} ${pointY}`;
      if (!curved) return `L ${x} ${pointY}`;
      // Midpoint controls keep the curve within the two measured values.
      const midpoint = x - step / 2;
      return `C ${midpoint} ${y(Number(previous.value))} ${midpoint} ${pointY} ${x} ${pointY}`;
    })
    .join(' ');
  const active = points.find((p) => (selected ? p.month === selected : p.month.slice(5, 7) === month));
  const change = comparePreviousMonth && active ? monthlyChartChange(points, active) : null;
  const displayValue = (p: ChartPoint) => (tone === 'waste' ? formatEnergyValue(p.value, 'Unavailable') : p.value);
  const display = (p: ChartPoint) => (finite(p) ? `${displayValue(p)} ${unit}` : 'Unavailable');
  const selectedMonthDetail = (active || showHelp) && (
    <p className="metric-chart-detail" aria-live="polite">
      {active ? (
        <>
          {!comparePreviousMonth && (
            <WasteDirectionText
              text={`${formatMonth(active.month)}: ${display(active)}${active.note ? ` · ${active.note}` : ''}`}
            />
          )}
          {comparePreviousMonth && (
            <span className={`metric-chart-change ${change ? `is-${change.direction}` : ''}`}>
              {change ? (
                <>
                  {change.direction !== 'equal' && (
                    <span className="metric-chart-change-arrow" aria-hidden="true">
                      {change.direction === 'down' ? '↓' : '↑'}
                    </span>
                  )}
                  <span>
                    <strong>
                      {change.percentage === null
                        ? 'Percentage unavailable (previous month was zero)'
                        : `${change.percentage > 0 ? '+' : ''}${formatEnergyValue(change.percentage)}%`}
                    </strong>
                    {' · '}
                    {change.direction === 'equal'
                      ? 'No change'
                      : `${formatEnergyValue(Math.abs(change.difference))} ${unit}`}
                  </span>
                </>
              ) : (
                'N/A'
              )}
            </span>
          )}
        </>
      ) : values.length ? (
        'Hover or focus a month to inspect its value. A dash marks unavailable data; lines break across missing months.'
      ) : (
        'See the calculation status above for the inputs that need attention.'
      )}
    </p>
  );
  return (
    <section className={`panel metric-chart metric-chart-${tone}`} aria-label={title}>
      <div className="metric-chart-heading">
        <div>
          {unit !== '£' && <span className="eyebrow">{unit}</span>}
          <h2>{title}</h2>
        </div>
        {showCoverage && (
          <span className="metric-chart-coverage">
            {values.length}/{points.length} months available
          </span>
        )}
      </div>
      {controls}
      <div className="metric-chart-summary-row">
        <ChartMonthDays
          month={calendarMonth}
          hideMonth={hideCalendarMonth}
          averages={[
            {
              label: 'Daily average',
              totalLabel: unit === '£' ? 'Monthly cost' : 'Waste this month',
              value: points.find((point) => point.month === calendarMonth)?.value,
              unit,
            },
          ]}
        />
        {comparePreviousMonth && selectedMonthDetail}
      </div>
      {showHelp && <p className="chart-help">{description}</p>}
      {!values.length && <p className="notice">No calculated values for this selection. Missing data is not zero.</p>}
      {values.length > 0 && (
        <svg viewBox="0 0 720 270" role="img" aria-label={`${title} chart in ${unit}`}>
          <title>{`${title}: monthly values in ${unit}. Use the data table for exact values.`}</title>
          {[0, 0.5, 1].map((fraction) => {
            const value = low + fraction * span;
            return (
              <g key={fraction} className="metric-chart-grid">
                <line x1="75" x2="680" y1={y(value)} y2={y(value)} />
                <text x="68" y={y(value) + 4} textAnchor="end">
                  {Intl.NumberFormat('en', {
                    notation: 'compact',
                    minimumFractionDigits: tone === 'waste' ? 2 : 0,
                    maximumFractionDigits: tone === 'waste' ? 2 : 1,
                  }).format(value)}
                </text>
              </g>
            );
          })}
          <line x1="75" x2="680" y1={y(0)} y2={y(0)} className="metric-chart-zero" />
          {chartType === 'line' && <path d={linePath} className="metric-chart-line" aria-hidden="true" />}
          {points.map((point, index) => {
            const x = 80 + step * index + step / 2;
            const highlighted = point.month.slice(5, 7) === month;
            const valid = finite(point);
            const value = valid ? Number(point.value) : 0;
            return (
              <g key={point.month}>
                <g
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatMonth(point.month)}: ${display(point)}${point.note ? `. ${point.note}` : ''}`}
                  onFocus={() => setSelected(point.month)}
                  onMouseEnter={() => setSelected(point.month)}
                  onBlur={() => setSelected(null)}
                  onMouseLeave={() => setSelected(null)}
                  className={`metric-chart-point ${value < 0 ? 'is-negative' : ''} ${highlighted ? 'is-selected' : ''}`}
                  aria-current={highlighted ? 'true' : undefined}
                >
                  <title>{`${formatMonth(point.month)}: ${display(point)}${point.note ? ` · ${point.note}` : ''}`}</title>
                  <rect x={x - step * 0.3} y="30" width={step * 0.6} height="200" fill="transparent" />
                  {valid ? (
                    chartType === 'bar' ? (
                      <rect
                        className="metric-chart-dot metric-chart-bar"
                        x={x - Math.min(step * 0.6, 42) / 2}
                        y={value === 0 ? y(0) - 1 : Math.min(y(value), y(0))}
                        width={Math.min(step * 0.6, 42)}
                        height={Math.max(2, Math.abs(y(value) - y(0)))}
                        rx={2}
                      />
                    ) : (
                      <circle className="metric-chart-dot" cx={x} cy={y(value)} r={highlighted ? 7 : 5} />
                    )
                  ) : (
                    <text x={x} y={y(0) - 8} textAnchor="middle" className="metric-chart-missing">
                      –
                    </text>
                  )}
                </g>
                <text x={x} y="250" textAnchor="middle" className="metric-chart-month">
                  {formatMonth(point.month)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {!comparePreviousMonth && selectedMonthDetail}
      <details>
        <summary>View {title.toLowerCase()} data</summary>
        <div className="analysis-table" role="region" aria-label={`${title} data`} tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Value ({unit})</th>
                <th>Coverage / context</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.month}>
                  <th>{formatMonth(p.month)}</th>
                  <td>{finite(p) ? displayValue(p) : 'Unavailable'}</td>
                  <td>
                    <WasteDirectionText text={p.note || '—'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
