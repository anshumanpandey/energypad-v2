'use client';

import { useState } from 'react';
import { WasteDirectionText } from './waste-direction';
import { useGraphMonth } from './graph-month';

export type ChartPoint = { month: string; value: string | number | null; note?: string };

export function MetricChart({
  title,
  unit,
  points,
  tone,
  description,
}: {
  title: string;
  unit: string;
  points: ChartPoint[];
  tone: 'energy' | 'carbon' | 'waste';
  description: string;
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
      const command = index > 0 && finite(points[index - 1]) ? 'L' : 'M';
      return `${command} ${80 + step * index + step / 2} ${y(Number(point.value))}`;
    })
    .join(' ');
  const active = points.find((p) => (selected ? p.month === selected : p.month.slice(5, 7) === month));
  const display = (p: ChartPoint) => (finite(p) ? `${p.value} ${unit}` : 'Unavailable');
  return (
    <section className={`panel metric-chart metric-chart-${tone}`} aria-label={title}>
      <div className="metric-chart-heading">
        <div>
          <span className="eyebrow">{unit}</span>
          <h2>{title}</h2>
        </div>
        <span className="metric-chart-coverage">
          {values.length}/{points.length} months available
        </span>
      </div>
      <p>{description}</p>
      {!values.length && <p className="notice">No calculated values for this selection. Missing data is not zero.</p>}
      <svg viewBox="0 0 720 270" role="img" aria-label={`${title} chart in ${unit}`}>
        <title>{`${title}: monthly values in ${unit}. Use the data table for exact values.`}</title>
        {[0, 0.5, 1].map((fraction) => {
          const value = low + fraction * span;
          return (
            <g key={fraction} className="metric-chart-grid">
              <line x1="75" x2="680" y1={y(value)} y2={y(value)} />
              <text x="68" y={y(value) + 4} textAnchor="end">
                {Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
              </text>
            </g>
          );
        })}
        <line x1="75" x2="680" y1={y(0)} y2={y(0)} className="metric-chart-zero" />
        <path d={linePath} className="metric-chart-line" aria-hidden="true" />
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
                aria-label={`${point.month}: ${display(point)}${point.note ? `. ${point.note}` : ''}`}
                onFocus={() => setSelected(point.month)}
                onMouseEnter={() => setSelected(point.month)}
                onBlur={() => setSelected(null)}
                onMouseLeave={() => setSelected(null)}
                className={`metric-chart-point ${value < 0 ? 'is-negative' : ''} ${highlighted ? 'is-selected' : ''}`}
                aria-current={highlighted ? 'true' : undefined}
              >
                <title>{`${point.month}: ${display(point)}${point.note ? ` · ${point.note}` : ''}`}</title>
                <rect x={x - step * 0.3} y="30" width={step * 0.6} height="200" fill="transparent" />
                {valid ? (
                  <circle className="metric-chart-dot" cx={x} cy={y(value)} r={highlighted ? 7 : 5} />
                ) : (
                  <text x={x} y={y(0) - 8} textAnchor="middle" className="metric-chart-missing">
                    –
                  </text>
                )}
              </g>
              <text x={x} y="250" textAnchor="middle" className="metric-chart-month">
                {
                  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
                    Number(point.month.slice(5, 7)) - 1
                  ]
                }
              </text>
            </g>
          );
        })}
      </svg>
      <p className="metric-chart-detail" aria-live="polite">
        {active ? (
          <WasteDirectionText text={`${active.month}: ${display(active)}${active.note ? ` · ${active.note}` : ''}`} />
        ) : (
          'Hover or focus a month to inspect its value. A dash marks unavailable data; lines break across missing months.'
        )}
      </p>
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
                  <th>{p.month}</th>
                  <td>{finite(p) ? p.value : 'Unavailable'}</td>
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
