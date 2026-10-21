import type { MonthlyAmount } from '@/domain/monthly-chart-summary';
import { MonthlyChartSummary } from './monthly-chart-summary';
import { formatEnergyValue } from './format-energy-value';

export function MonthlyCarbonGauge({
  points,
  history,
  period,
}: {
  points: MonthlyAmount[];
  history: MonthlyAmount[];
  period: string;
}) {
  const raw = points.find((point) => point.month === period)?.actual;
  const value = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const maximum = Math.max(1, ...points.map((point) => Number(point.actual ?? 0)));
  const label = value === null ? 'N/A' : `${formatEnergyValue(value)} kg`;
  return (
    <section className="panel utility-lines monthly-carbon-gauge" aria-label="Selected month carbon gauge">
      <h2>Monthly carbon footprint (kg)</h2>
      <MonthlyChartSummary compact points={history} period={period} unit="kg" />
      <svg viewBox="0 0 640 340" role="img" aria-label={`Selected month carbon gauge: ${label}`}>
        <title>Monthly emissions; scale from zero to the largest displayed monthly total</title>
        <path d="M 100 255 A 220 220 0 0 1 540 255" fill="none" stroke="#4989c6" strokeWidth="28" />
        <text x="100" y="289" textAnchor="middle" fontSize="13">
          0
        </text>
        <text x="540" y="289" textAnchor="middle" fontSize="13">
          {formatEnergyValue(maximum)}
        </text>
        {value !== null && (
          <g transform={`rotate(${(value / maximum) * 180 - 90} 320 255)`} data-testid="monthly-carbon-needle">
            <path d="M 313 255 L 320 65 L 327 255 Z" fill="#4d505c" />
            <circle cx="320" cy="255" r="11" fill="#4d505c" />
          </g>
        )}
        <text x="320" y="315" textAnchor="middle" fontSize="26" fontWeight="700">
          {label}
        </text>
      </svg>
    </section>
  );
}
