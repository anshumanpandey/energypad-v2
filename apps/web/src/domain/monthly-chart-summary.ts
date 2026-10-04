import { sumUtilityAmounts } from './utility-comparison';
export type MonthlyAmount = { month: string; actual: string | null };
export function monthlyChartSummary(points: MonthlyAmount[], period: string) {
  const current = points.find((p) => p.month === period)?.actual ?? null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    return { current: null, dailyAverage: null, previous: null, percent: null };
  const [year, month] = period.split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const previousPeriod = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const previous = points.find((p) => p.month === previousPeriod)?.actual ?? null;
  return {
    current,
    dailyAverage: current === null ? null : String(Number(current) / days),
    previous,
    percent:
      current !== null && previous !== null && Number(previous) > 0
        ? ((Number(current) - Number(previous)) / Number(previous)) * 100
        : null,
  };
}
export function monthlyActuals(rows: { month: string; [key: string]: unknown }[], field: string): MonthlyAmount[] {
  return [...new Set(rows.map((r) => r.month))].sort().map((month) => ({
    month,
    actual: sumUtilityAmounts(
      rows.filter((r) => r.month === month).map((r) => (r[field] as string | null | undefined) ?? null),
    ),
  }));
}
