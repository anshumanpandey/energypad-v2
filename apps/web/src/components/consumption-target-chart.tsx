'use client';
import { formatMonth } from '@/domain/format-month';
import { useGraphMonth } from './graph-month';
import { formatEnergyValue } from './format-energy-value';
import type { consumptionTargetChart } from '@/domain/consumption-target-chart';

export function ConsumptionTargetChart({
  year,
  data,
}: {
  year: number;
  data: ReturnType<typeof consumptionTargetChart>;
}) {
  const month = useGraphMonth();
  const maximum = Math.max(1, ...data.rows.flatMap((r) => [Number(r.consumption ?? 0), Number(r.target ?? 0)]));
  const value = (v: string | null) => (v === null ? 'Unavailable' : `${formatEnergyValue(v)} kWh`);
  return (
    <section className="panel annual-comparison" aria-label="Consumption vs target">
      <div className="metric-chart-heading">
        <div>
          <span className="eyebrow">ANNUAL COMPARISON · {year}</span>
          <h2>Consumption vs target</h2>
        </div>
        <span className="metric-chart-coverage">January–December</span>
      </div>
      <p className="muted">
        Consumption extends left; target consumption extends right. Both sides use the same scale in kWh.
      </p>
      <div className="annual-comparison-totals">
        <div>
          <span>Annual consumption</span>
          <strong>{value(data.consumption)}</strong>
        </div>
        <div>
          <span>Annual target</span>
          <strong>{value(data.target)}</strong>
        </div>
      </div>
      <div className="annual-comparison-labels">
        <strong>← Consumption</strong>
        <strong>Target →</strong>
      </div>
      <div className="annual-comparison-rows" role="list" aria-label="Monthly consumption and targets">
        {data.rows.map((r) => (
          <div
            key={r.month}
            role="listitem"
            className="annual-comparison-row"
            aria-current={r.month.endsWith(`-${month}`) ? 'true' : undefined}
            aria-label={`${formatMonth(r.month)}: consumption ${value(r.consumption)}; target ${value(r.target)}`}
          >
            <div className="annual-comparison-side annual-comparison-actual">
              <span>{value(r.consumption)}</span>
              <div className="annual-comparison-track" aria-hidden="true">
                {r.consumption !== null && <i style={{ width: `${(Number(r.consumption) / maximum) * 100}%` }} />}
              </div>
            </div>
            <span className="annual-comparison-month">{formatMonth(r.month)}</span>
            <div className="annual-comparison-side annual-comparison-target">
              <span>{value(r.target)}</span>
              <div className="annual-comparison-track" aria-hidden="true">
                {r.target !== null && <i style={{ width: `${(Number(r.target) / maximum) * 100}%` }} />}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted">
        Targets cover the same utility types as the active meters at this site. Annual totals require all 12 months;
        missing or ambiguous targets are unavailable.
      </p>
    </section>
  );
}
