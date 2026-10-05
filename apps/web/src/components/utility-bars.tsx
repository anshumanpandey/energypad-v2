'use client';
import { formatEnergyValue } from './format-energy-value';
import { MonthlyChartSummary } from './monthly-chart-summary';
import type { MonthlyAmount } from '@/domain/monthly-chart-summary';
import { sortChartValues, type UtilityChartSort } from '@/domain/utility-chart-sort';

export type UtilityBarPoint = { month: string; actual: string | null; target: string | null };
export function UtilityBars({
  points: sourcePoints,
  title,
  unit,
  diverging = false,
  selectedMonth,
  actualOnly = false,
  period = '',
  summaryPoints = sourcePoints,
  targetNote,
  sortBy = 'month',
  actualLabel = 'Actual',
  targetLabel = 'Target',
  showSummary = true,
}: {
  points: UtilityBarPoint[];
  title: string;
  unit: string;
  diverging?: boolean;
  selectedMonth: string;
  actualOnly?: boolean;
  period?: string;
  summaryPoints?: MonthlyAmount[];
  targetNote?: string;
  sortBy?: UtilityChartSort;
  actualLabel?: string;
  targetLabel?: string;
  showSummary?: boolean;
}) {
  const points = sortChartValues(sourcePoints, sortBy, (r) => r.actual);
  const maximum = Math.max(1, ...points.flatMap((p) => [Number(p.actual ?? 0), Number(p.target ?? 0)]));
  const height = diverging ? Math.max(180, points.length * 30 + 90) : 340;
  const baseline = diverging ? 470 : 250;
  const scale = (value: string | null) => (Number(value ?? 0) / maximum) * (diverging ? 290 : 195);
  const step = 660 / Math.max(1, points.length);
  const number = (value: number) => Intl.NumberFormat('en-GB', { notation: 'compact' }).format(value);
  return (
    <section className="panel utility-lines" aria-label={`${title} graph`}>
      <h2>
        {title} ({unit})
      </h2>
      {showSummary && <MonthlyChartSummary points={summaryPoints} period={period} unit={unit} />}
      {targetNote && <p>{targetNote}</p>}
      <p>
        {diverging
          ? `${actualLabel} extends left and ${targetLabel.toLowerCase()} extends right from zero, using the same scale.`
          : actualOnly
            ? 'Monthly recorded cost.'
            : 'Actual and target use the same scale.'}{' '}
        The selected month is highlighted. Missing values are shown as a dash.
      </p>
      <div className="utility-chart-scroll">
        <svg
          viewBox={`0 0 900 ${height}`}
          role="img"
          aria-label={`${title} ${diverging ? 'diverging' : 'monthly'} bar graph`}
        >
          <title>{`${title} in ${unit}`}</title>
          {diverging ? (
            <>
              <text x="310" y="22" textAnchor="middle">
                {actualLabel}
              </text>
              <text x="630" y="22" textAnchor="middle">
                {targetLabel}
              </text>
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  {[-1, 1].map((sign) => (
                    <g key={sign}>
                      <line
                        x1={baseline + sign * 290 * fraction}
                        x2={baseline + sign * 290 * fraction}
                        y1="45"
                        y2={height - 32}
                        stroke="#dce5e3"
                      />
                      <text x={baseline + sign * 290 * fraction} y={height - 12} textAnchor="middle" fontSize="12">
                        {number(maximum * fraction)}
                      </text>
                    </g>
                  ))}
                </g>
              ))}
            </>
          ) : (
            <>
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1="80"
                    x2="740"
                    y1={baseline - 195 * fraction}
                    y2={baseline - 195 * fraction}
                    stroke="#dce5e3"
                  />
                  <text x="70" y={baseline - 195 * fraction + 4} textAnchor="end" fontSize="12">
                    {number(maximum * fraction)}
                  </text>
                </g>
              ))}
            </>
          )}
          {points.map((point, index) => {
            const selected = point.month.slice(5, 7) === selectedMonth;
            const rowY = 50 + index * 30;
            const x = 80 + step * index + step / 2;
            const label = actualOnly
              ? `${point.month}: cost ${formatEnergyValue(point.actual, 'Unavailable')} ${unit}`
              : `${point.month}: ${actualLabel.toLowerCase()} ${formatEnergyValue(point.actual, 'Unavailable')}, ${targetLabel.toLowerCase()} ${formatEnergyValue(point.target, 'Unavailable')} ${unit}`;
            return (
              <g
                key={point.month}
                tabIndex={0}
                role="img"
                aria-label={label}
                aria-current={selected ? 'true' : undefined}
                data-selected-month={selected ? point.month : undefined}
                data-month={point.month}
              >
                <title>{label}</title>
                {selected && (
                  <rect
                    x={diverging ? 90 : x - step / 2}
                    y={diverging ? rowY - 3 : 40}
                    width={diverging ? 710 : step}
                    height={diverging ? 28 : 220}
                    fill="#e9f3dc"
                  />
                )}
                {diverging ? (
                  <text x="85" y={rowY + 14} textAnchor="end" fontSize="12" fontWeight={selected ? 'bold' : 'normal'}>
                    {point.month}
                  </text>
                ) : (
                  <text
                    transform={`translate(${x},275) rotate(-35)`}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight={selected ? 'bold' : 'normal'}
                  >
                    {point.month}
                  </text>
                )}
                {(actualOnly ? (['actual'] as const) : (['actual', 'target'] as const)).map((kind, seriesIndex) => {
                  const value = point[kind];
                  const size = scale(value);
                  const color = seriesIndex ? '#4989c6' : '#168578';
                  const barX = diverging
                    ? seriesIndex
                      ? baseline
                      : baseline - size
                    : actualOnly
                      ? x - step * 0.14
                      : x + (seriesIndex ? 2 : -step * 0.3);
                  const barY = diverging ? rowY : baseline - size;
                  const width = diverging ? size : step * 0.28;
                  const barHeight = diverging ? 21 : size;
                  return value === null ? (
                    <text
                      key={kind}
                      x={diverging ? baseline + (seriesIndex ? 15 : -15) : barX + width / 2}
                      y={diverging ? rowY + 15 : baseline - 4}
                      textAnchor="middle"
                      fontSize="14"
                    >
                      —
                    </text>
                  ) : (
                    <g key={kind} data-series={kind} data-value={value}>
                      <rect
                        x={barX}
                        y={barY}
                        width={width}
                        height={barHeight}
                        fill={color}
                        stroke={selected ? '#142d29' : undefined}
                        strokeWidth="1.5"
                      />
                      {Number(value) === 0 && (
                        <circle
                          cx={diverging ? baseline : barX + width / 2}
                          cy={diverging ? rowY + 10 : baseline}
                          r="3"
                          fill={color}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {diverging && (
            <line x1={baseline} x2={baseline} y1="40" y2={height - 30} stroke="#4b635c" strokeWidth="1.5" />
          )}
        </svg>
      </div>
      <ul className="utility-chart-legend">
        <li>
          <span style={{ background: '#168578' }} />
          {actualLabel}
        </li>
        {!actualOnly && (
          <li>
            <span style={{ background: '#4989c6' }} />
            {targetLabel}
          </li>
        )}
      </ul>
    </section>
  );
}
