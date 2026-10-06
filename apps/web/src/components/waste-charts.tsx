'use client';
import { formatMonth } from '@/domain/format-month';
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
  throughMonth,
}: {
  rows: WasteChartRow[];
  month?: string;
  sort?: UtilityChartSort;
  throughMonth?: string;
}) {
  const anchor = month
    ? ([...rows]
        .filter((row) => row.month.endsWith(`-${month}`))
        .sort((a, b) => a.month.localeCompare(b.month))
        .at(-1)?.month ?? '')
    : '';
  const gauge = wasteGauge(!month && throughMonth ? rows.filter((row) => row.month <= throughMonth) : rows, anchor);
  const percentage = gauge.percentage;
  const monthlyGauge = gauge.months.map((month) => {
    const row = rows.find((row) => row.month === month);
    const value =
      row?.variance != null && row.adjusted != null && row.adjusted > 0 ? (row.variance / row.adjusted) * 100 : null;
    return { month, value };
  });
  const gaugeMaximum = Math.max(100, ...monthlyGauge.map((point) => Math.abs(point.value ?? 0)));
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
          <p>
            {gauge.months.length
              ? `${formatMonth(gauge.months[0])} to ${formatMonth(gauge.months[2])}`
              : 'No reporting period available.'}
          </p>
          <div className="utility-chart-scroll">
            <svg
              viewBox="0 0 620 320"
              role="img"
              aria-label={`Waste/Savings Gauge: ${percentage === null ? 'Unavailable' : `${formatEnergyValue(percentage)}%`}`}
            >
              <title>Three-month waste and savings percentages in the Carbon gauge style</title>
              {monthlyGauge.map((point, index) => {
                const x = 110 + index * 200;
                const size = (Math.abs(point.value ?? 0) / gaugeMaximum) * 90;
                const label = `${formatMonth(point.month)}: ${point.value === null ? 'Unavailable' : `${formatEnergyValue(point.value)}%`}`;
                return (
                  <g key={point.month} role="img" aria-label={label} tabIndex={0} data-month={point.month}>
                    <title>{label}</title>
                    <text x={x} y="35" textAnchor="middle" fontSize="14">
                      {formatMonth(point.month)}
                    </text>
                    <rect x={x - 22} y="55" width="44" height="190" rx="22" fill="#edf1ef" />
                    {point.value !== null && (
                      <rect
                        x={x - 22}
                        y={point.value >= 0 ? 150 - Math.max(3, size) : 150}
                        width="44"
                        height={Math.max(3, size)}
                        rx="8"
                        fill={point.value >= 0 ? '#168578' : '#b74655'}
                      />
                    )}
                    <line x1={x - 32} x2={x + 32} y1="150" y2="150" stroke="#4b635c" strokeDasharray="4 3" />
                    <text x={x + 36} y="154" fontSize="11">
                      0%
                    </text>
                    <text x={x} y="275" textAnchor="middle" fontSize="17" fontWeight="bold">
                      {point.value === null
                        ? 'Unavailable'
                        : `${point.value > 0 ? '+' : ''}${formatEnergyValue(point.value)}%`}
                    </text>
                    <text x={x} y="297" textAnchor="middle" fontSize="12">
                      {point.value === null ? 'Missing inputs' : point.value < 0 ? 'Wasted energy' : 'Avoided energy'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p>
            <strong>
              Three-month total:{' '}
              {percentage === null ? 'Unavailable' : `${percentage > 0 ? '+' : ''}${formatEnergyValue(percentage)}%`}
            </strong>
          </p>
          <p>
            Three-month total avoided/wasted energy ÷ adjusted expected consumption × 100. Positive is saving; negative
            is waste.
          </p>
          {percentage === null && (
            <p className="notice">
              Three consecutive months of calculated values and a positive expected total are required.
            </p>
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
