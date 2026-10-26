import { ChartMonthDays } from './chart-month-days';
import { formatMonth } from '../domain/format-month';
import { monthlyChartSummary, type MonthlyAmount } from '../domain/monthly-chart-summary';
import { formatEnergyValue } from './format-energy-value';
export function MonthlyChartSummary({
  points,
  period,
  unit,
  compact = false,
}: {
  points: MonthlyAmount[];
  period: string;
  unit: string;
  compact?: boolean;
}) {
  const summary = monthlyChartSummary(points, period);
  if (compact)
    return (
      <div className="metric-chart-summary-row" aria-label="Selected month statistics">
        <ChartMonthDays
          month={period}
          hideMonth
          averages={[
            {
              label: 'Daily average',
              totalLabel:
                unit === 'kg' ? 'Emissions this month' : unit === 'kWh' ? 'Consumption this month' : 'Cost this month',
              value: summary.current,
              unit,
            },
          ]}
        />
        <p className="metric-chart-detail" aria-live="polite">
          <span
            className={`metric-chart-change ${summary.percent === null ? '' : summary.percent > 0 ? 'is-up' : summary.percent < 0 ? 'is-down' : 'is-equal'}`}
          >
            {summary.percent === null ? (
              'N/A'
            ) : (
              <>
                <span className="metric-chart-change-arrow" aria-hidden="true">
                  {summary.percent > 0 ? '↑' : summary.percent < 0 ? '↓' : '→'}
                </span>
                <strong>
                  {summary.percent > 0 ? '+' : ''}
                  {summary.percent.toFixed(2)}%
                </strong>
              </>
            )}
          </span>
        </p>
      </div>
    );
  return (
    <div className="monthly-chart-summary" aria-label="Selected month statistics">
      <span>
        <strong>{period ? formatMonth(period) : 'Select a month'}</strong>
      </span>
      <div className="monthly-chart-values">
        <span className="monthly-chart-actual">
          <span>Actual:</span>{' '}
          <strong>
            {formatEnergyValue(summary.current, 'Unavailable')} {unit}
          </strong>
        </span>
        <span className="monthly-chart-average">
          <span>Average per day:</span>{' '}
          <strong>
            {formatEnergyValue(summary.dailyAverage, 'Unavailable')} {unit}/day
          </strong>
        </span>
      </div>
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
