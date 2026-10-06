import { formatMonth } from '@/domain/format-month';
import { monthlyChartSummary, type MonthlyAmount } from '@/domain/monthly-chart-summary';
import { formatEnergyValue } from './format-energy-value';
export function MonthlyChartSummary({
  points,
  period,
  unit,
}: {
  points: MonthlyAmount[];
  period: string;
  unit: string;
}) {
  const summary = monthlyChartSummary(points, period);
  return (
    <div className="monthly-chart-summary" aria-label="Selected month statistics">
      <span>
        <strong>{period ? formatMonth(period) : 'Select a month'}</strong> · Actual:{' '}
        {formatEnergyValue(summary.current, 'Unavailable')} {unit}
      </span>
      <span>
        Average per day: {formatEnergyValue(summary.dailyAverage, 'Unavailable')} {unit}/day
      </span>
      <span
        style={{
          color:
            summary.percent === null || summary.percent === 0 ? undefined : summary.percent > 0 ? '#b42318' : '#187548',
        }}
      >
        {summary.percent === null
          ? 'Change vs previous month: Unavailable'
          : summary.percent === 0
            ? '→ 0.00% · No change vs previous month'
            : `${summary.percent > 0 ? '↑' : '↓'} ${Math.abs(summary.percent).toFixed(2)}% ${summary.percent > 0 ? 'increase' : 'decrease'} vs previous month`}
      </span>
    </div>
  );
}
