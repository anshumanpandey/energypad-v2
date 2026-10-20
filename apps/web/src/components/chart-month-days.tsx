import { formatMonth } from '../domain/format-month';
import { formatEnergyValue } from './format-energy-value';

export function ChartMonthDays({
  month,
  hideMonth = false,
  averages = [],
}: {
  month?: string;
  hideMonth?: boolean;
  averages?: { label: string; totalLabel?: string; value: string | number | null | undefined; unit: string }[];
}) {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return (
    <div className="chart-month-summary" aria-live="polite">
      <p className="chart-month-days">
        {!hideMonth && `${formatMonth(month)} · `}
        <span className="chart-days-count">{days}</span> <span className="chart-days-label">days</span>
      </p>
      {averages.map(({ label, totalLabel = 'Monthly value', value, unit }) => {
        const available = value !== null && value !== undefined && Number.isFinite(Number(value));
        return (
          <div className="chart-average-pair" key={label}>
            <p className="chart-month-days chart-daily-average">
              <span>{label}</span>
              <strong>{available ? `${formatEnergyValue(Number(value) / days)} ${unit}/day` : 'Unavailable'}</strong>
            </p>
            <p className="chart-month-days chart-month-total">
              <span>{totalLabel}</span>
              <strong>{available ? `${formatEnergyValue(Number(value))} ${unit}` : 'Unavailable'}</strong>
            </p>
          </div>
        );
      })}
    </div>
  );
}
