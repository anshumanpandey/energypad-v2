import type { ReactNode } from 'react';
import { formatMonth } from '../domain/format-month';
import type { WasteChartRow } from '../domain/analysis/waste-gauge';
import { monthlyChartChange } from '../domain/monthly-chart-change';
import { sortChartValues, type UtilityChartSort } from '../domain/utility-chart-sort';
import { formatEnergyValue } from './format-energy-value';

const value = (number: number | null) => formatEnergyValue(number, 'Unavailable');
const signed = (number: number | null, suffix = '') =>
  number === null ? 'Unavailable' : `${number > 0 ? '+' : ''}${value(number)}${suffix}`;

function ChartTable({ title, headers, children }: { title: string; headers: string[]; children: ReactNode }) {
  return (
    <section className="panel" aria-label={`${title} table`}>
      <h2>{title}</h2>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={`${title} data`}>
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

export function WasteChartTables({
  rows,
  month,
  sort,
  gaugeMonths,
  gaugePercentage,
}: {
  rows: WasteChartRow[];
  month: string;
  sort: UtilityChartSort;
  gaugeMonths: { month: string; value: number | null }[];
  gaugePercentage: number | null;
}) {
  const selected = rows.filter((row) => !month || row.month.endsWith(`-${month}`));
  return (
    <div className="utility-graphs-page" aria-label="Chart data tables">
      {(['variance', 'cost'] as const).map((key) => {
        const title = key === 'variance' ? 'Avoided Energy (+) and Wasted Energy (-) (kWh)' : 'Cost (£)';
        const unit = key === 'variance' ? 'kWh' : '£';
        const points = rows.map((row) => ({ month: row.month, value: row[key] }));
        return (
          <ChartTable
            key={key}
            title={title}
            headers={['Month', `Value (${unit})`, `Change (${unit})`, 'Change (%)', 'Context']}
          >
            {sortChartValues(selected, sort, (row) => (row[key] === null ? null : String(row[key]))).map((row) => {
              const change = monthlyChartChange(points, { month: row.month, value: row[key] });
              return (
                <tr key={row.month}>
                  <th scope="row">{formatMonth(row.month)}</th>
                  <td>{value(row[key])}</td>
                  <td>{signed(change?.difference ?? null)}</td>
                  <td>{signed(change?.percentage ?? null, '%')}</td>
                  <td>{row.note || '—'}</td>
                </tr>
              );
            })}
          </ChartTable>
        );
      })}
      <ChartTable title="Waste/Savings Gauge" headers={['Month / period', 'Avoided / wasted energy (%)']}>
        {gaugeMonths.map((point) => (
          <tr key={point.month}>
            <th scope="row">{formatMonth(point.month)}</th>
            <td>{signed(point.value, '%')}</td>
          </tr>
        ))}
        <tr>
          <th scope="row">Three-month total</th>
          <td>{signed(gaugePercentage, '%')}</td>
        </tr>
      </ChartTable>
      <ChartTable
        title="Actual consumption vs wastage"
        headers={['Month', 'Actual consumption (kWh)', 'Wastage (kWh)']}
      >
        {sortChartValues(selected, sort, (row) => (row.actual === null ? null : String(row.actual))).map((row) => (
          <tr key={row.month}>
            <th scope="row">{formatMonth(row.month)}</th>
            <td>{value(row.actual)}</td>
            <td>{value(row.variance === null ? null : Math.max(0, -row.variance))}</td>
          </tr>
        ))}
      </ChartTable>
    </div>
  );
}
