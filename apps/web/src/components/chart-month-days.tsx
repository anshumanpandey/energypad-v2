import { formatMonth } from '../domain/format-month';
import { formatEnergyValue } from './format-energy-value';

export function ChartMonthDays({
  month,
  averages = [],
}: {
  month?: string;
  averages?: { label: string; value: string | number | null | undefined; unit: string }[];
}) {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return (
    <div className="chart-month-summary" aria-live="polite">
      <p className="chart-month-days">
        {formatMonth(month)} · {days} days
      </p>
      {averages.map(({ label, value, unit }) => (
        <p className="chart-month-days chart-daily-average" key={label}>
          {label}:{' '}
          <strong>
            {value === null || value === undefined || !Number.isFinite(Number(value))
              ? 'Unavailable'
              : `${formatEnergyValue(Number(value) / days)} ${unit}/day`}
          </strong>
        </p>
      ))}
    </div>
  );
}
