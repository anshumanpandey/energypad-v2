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
    <section className="panel waste-table-panel" aria-label={`${title} table`}>
      <h2>{title}</h2>
      <div className="table-scroll waste-table-scroll" tabIndex={0} role="region" aria-label={`${title} data`}>
        <table className="waste-data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className={header === 'Context' ? 'waste-table-context' : undefined}>
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
  const selectedMonth = (value: string) => !!month && value.endsWith(`-${month}`);
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
            {sortChartValues(rows, sort, (row) => (row[key] === null ? null : String(row[key]))).map((row) => {
              const change = monthlyChartChange(points, { month: row.month, value: row[key] });
              return (
                <tr key={row.month} aria-current={selectedMonth(row.month) ? 'date' : undefined}>
                  <th scope="row">{formatMonth(row.month)}</th>
                  <td>{value(row[key])}</td>
                  <td>{signed(change?.difference ?? null)}</td>
                  <td>{signed(change?.percentage ?? null, '%')}</td>
                  <td className="waste-table-context">{row.note || '—'}</td>
                </tr>
              );
            })}
          </ChartTable>
        );
      })}
      <ChartTable title="Waste/Savings Gauge" headers={['Month / period', 'Avoided / wasted energy (%)']}>
        {[...rows]
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((row) => (
            <tr key={row.month} aria-current={selectedMonth(row.month) ? 'date' : undefined}>
              <th scope="row">{formatMonth(row.month)}</th>
              <td>
                {signed(
                  row.variance !== null && row.adjusted !== null && row.adjusted > 0
                    ? (row.variance / row.adjusted) * 100
                    : null,
                  '%',
                )}
              </td>
            </tr>
          ))}
        <tr className="waste-table-total">
          <th scope="row">
            Three-month total
            {gaugeMonths.length > 0 && (
              <small className="waste-table-period">
                {formatMonth(gaugeMonths[0].month)} – {formatMonth(gaugeMonths[gaugeMonths.length - 1].month)}
              </small>
            )}
          </th>
          <td>{signed(gaugePercentage, '%')}</td>
        </tr>
      </ChartTable>
      <ChartTable
        title="Actual consumption vs wastage"
        headers={['Month', 'Actual consumption (kWh)', 'Wastage (kWh)']}
      >
        {sortChartValues(rows, sort, (row) => (row.actual === null ? null : String(row.actual))).map((row) => (
          <tr key={row.month} aria-current={selectedMonth(row.month) ? 'date' : undefined}>
            <th scope="row">{formatMonth(row.month)}</th>
            <td>{value(row.actual)}</td>
            <td>{value(row.variance === null ? null : Math.max(0, -row.variance))}</td>
          </tr>
        ))}
      </ChartTable>
    </div>
  );
}
