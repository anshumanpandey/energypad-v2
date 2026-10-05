'use client';
import { MetricChart } from './metric-chart';
import { UtilityBars } from './utility-bars';
import { GraphMonthProvider } from './graph-month';
import { formatEnergyValue } from './format-energy-value';
import { wasteGauge, type WasteChartRow } from '@/domain/analysis/waste-gauge';
import { sortChartValues, type UtilityChartSort } from '@/domain/utility-chart-sort';

export function WasteCharts({
  rows,
  month = '',
  sort = 'month',
}: {
  rows: WasteChartRow[];
  month?: string;
  sort?: UtilityChartSort;
}) {
  const anchor = month
    ? ([...rows]
        .filter((row) => row.month.endsWith(`-${month}`))
        .sort((a, b) => a.month.localeCompare(b.month))
        .at(-1)?.month ?? '')
    : '';
  const gauge = wasteGauge(rows, anchor);
  const percentage = gauge.percentage;
  const angle = ((Math.max(-100, Math.min(100, percentage ?? 0)) + 100) / 200) * Math.PI;
  const x = 180 - 115 * Math.cos(angle),
    y = 165 - 115 * Math.sin(angle);
  const points = (key: 'variance' | 'cost') =>
    sortChartValues(rows, sort, (row) => (row[key] === null ? null : String(row[key]))).map((row) => ({
      month: row.month,
      value: row[key],
      note: row.note,
    }));
  return (
    <GraphMonthProvider key={month} initialMonth={month}>
      <div className="graphs-grid">
        <MetricChart
          title="Avoided Energy (+) and Wasted Energy (-) (kWh)"
          unit="kWh"
          points={points('variance')}
          tone="waste"
          description="Adjusted expected minus actual consumption. Positive values are avoided energy; negative values are wasted energy."
        />
        <section className="panel metric-chart" aria-label="Waste/Savings Gauge">
          <h2>Waste/Savings Gauge (Percentage change in the last 3 months)</h2>
          <p>{gauge.months.length ? `${gauge.months[0]} to ${gauge.months[2]}` : 'No reporting period available.'}</p>
          <svg
            viewBox="0 0 360 235"
            role="img"
            aria-label={`Waste/Savings Gauge: ${percentage === null ? 'Unavailable' : `${formatEnergyValue(percentage)}%`}`}
          >
            <title>{`Three-month waste/savings percentage: ${percentage === null ? 'Unavailable' : `${formatEnergyValue(percentage)}%`}`}</title>
            <path d="M 50 165 A 130 130 0 0 1 180 35" fill="none" stroke="#c55b44" strokeWidth="22" />
            <path d="M 180 35 A 130 130 0 0 1 310 165" fill="none" stroke="#168578" strokeWidth="22" />
            {percentage !== null && (
              <>
                <line x1="180" y1="165" x2={x} y2={y} stroke="#173d45" strokeWidth="5" />
                <circle cx="180" cy="165" r="8" fill="#173d45" />
              </>
            )}
            <text x="35" y="195" textAnchor="middle">
              −100%
            </text>
            <text x="180" y="20" textAnchor="middle">
              0%
            </text>
            <text x="320" y="195" textAnchor="middle">
              +100%
            </text>
            <text x="180" y="230" textAnchor="middle" fontSize="28" fontWeight="bold">
              {percentage === null ? 'Unavailable' : `${percentage > 0 ? '+' : ''}${formatEnergyValue(percentage)}%`}
            </text>
          </svg>
          <p>
            Three-month total avoided/wasted energy ÷ adjusted expected consumption × 100. Positive is saving; negative
            is waste.
          </p>
          {percentage === null && (
            <p className="notice">
              Three consecutive months of calculated values and a positive expected total are required.
            </p>
          )}
          {percentage !== null && Math.abs(percentage) > 100 && (
            <p>The needle is capped at the chart’s scale; the percentage above is the full calculated value.</p>
          )}
        </section>
        <MetricChart
          title="Cost (£)"
          unit="£"
          points={points('cost')}
          tone="waste"
          description="Estimated avoided (+) or wasted (-) energy cost, using each reading’s net GBP cost per kWh. VAT is excluded; missing rates and other currencies remain unavailable."
        />
        <UtilityBars
          title="Actual consumption vs wastage"
          unit="kWh"
          points={rows.map((row) => ({
            month: row.month,
            actual: row.actual === null ? null : String(row.actual),
            target: row.variance === null ? null : String(Math.max(0, -row.variance)),
          }))}
          diverging
          showSummary={false}
          selectedMonth={month}
          sortBy={sort}
          actualLabel="Actual consumption"
          targetLabel="Wastage"
          targetNote="Wastage is the magnitude of negative avoided/wasted energy. Months with avoided energy have zero wastage."
        />
      </div>
    </GraphMonthProvider>
  );
}
