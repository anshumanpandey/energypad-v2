import type { WasteChartRow } from '@/domain/analysis/waste-gauge';
import { formatMonth } from '../domain/format-month';
import { formatEnergyValue } from './format-energy-value';
import { ChartMonthDays } from './chart-month-days';

export function MonthlyWasteGauge({ rows, month }: { rows: WasteChartRow[]; month: string }) {
  const row = [...rows]
    .filter((row) => row.month.endsWith(`-${month}`))
    .sort((a, b) => a.month.localeCompare(b.month))
    .at(-1);
  const value = row?.variance != null && Number.isFinite(row.variance) ? row.variance : null;
  const maximum = Math.max(1, ...rows.map((row) => (Number.isFinite(row.variance) ? Math.abs(row.variance ?? 0) : 0)));
  const label = value === null ? 'N/A' : `${value > 0 ? '+' : ''}${formatEnergyValue(value)} kWh`;
  const direction = value === null ? 'Unavailable' : value > 0 ? 'SAVING' : value < 0 ? 'WASTE' : 'No change';
  return (
    <section className="panel monthly-waste-gauge" aria-label="Selected month energy gauge">
      <h2>Avoided Energy (+) and Wasted Energy (-)</h2>
      <div className="monthly-waste-gauge-summary">
        <p>{row ? formatMonth(row.month) : month ? 'No data for the selected month' : 'Select a month'}</p>
        <ChartMonthDays
          month={row?.month}
          hideMonth
          averages={[{ label: 'Daily average', totalLabel: 'Waste this month', value, unit: 'kWh' }]}
        />
      </div>
      <svg viewBox="0 0 640 380" role="img" aria-label={`Selected month energy gauge: ${label}, ${direction}`}>
        <title>{`Avoided energy is positive; wasted energy is negative. ${label}.`}</title>
        <path d="M 100 255 A 220 220 0 0 1 320 35" fill="none" stroke="#e97871" strokeWidth="28" />
        <path d="M 320 35 A 220 220 0 0 1 540 255" fill="none" stroke="#94c11f" strokeWidth="28" />
        <text x="320" y="14" textAnchor="middle" fontSize="13">
          0
        </text>
        <text x="100" y="289" textAnchor="middle" fontSize="13">{`−${formatEnergyValue(maximum)}`}</text>
        <text x="540" y="289" textAnchor="middle" fontSize="13">{`+${formatEnergyValue(maximum)}`}</text>
        <text x="100" y="313" textAnchor="middle" fontSize="14" fill="#a53630">
          WASTE
        </text>
        <text x="540" y="313" textAnchor="middle" fontSize="14" fill="#356647">
          SAVING
        </text>
        {value !== null && (
          <g transform={`rotate(${(value / maximum) * 90} 320 255)`} data-testid="monthly-waste-needle">
            <path d="M 313 255 L 320 65 L 327 255 Z" fill="#4d505c" />
            <circle cx="320" cy="255" r="11" fill="#4d505c" />
          </g>
        )}
        <text x="320" y="310" textAnchor="middle" fontSize="26" fontWeight="700">
          {label}
        </text>
        <text
          x="320"
          y="337"
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill={value !== null && value < 0 ? '#a53630' : '#356647'}
        >
          {direction}
        </text>
        <text x="320" y="367" textAnchor="middle" fontSize="11" fill="#686e78">
          Scale: selected year’s largest absolute monthly value (kWh)
        </text>
      </svg>
    </section>
  );
}
