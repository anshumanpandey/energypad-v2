import type { UtilityGraphRow, UtilityCostTarget } from './utility-graphs';
import { utilityComparison, sumUtilityAmounts } from './utility-comparison';

// Resolve targets per site before summing, so site-wide targets are counted once.
export function carbonMonthlyComparison(rows: UtilityGraphRow[], targets: UtilityCostTarget[], fuel: string) {
  const comparisons = utilityComparison(rows, targets, fuel);
  return [...new Set(comparisons.map((row) => row.month))].sort().map((month) => {
    const matching = comparisons.filter((row) => row.month === month);
    return {
      month,
      emissions: sumUtilityAmounts(matching.map((row) => row.emissions)),
      targetCarbon: sumUtilityAmounts(matching.map((row) => row.targetCarbon)),
      targetScope: [...new Set(matching.map((row) => row.targetScope))].join(' / '),
    };
  });
}

export function carbonRollingMonths(year: string, month: string) {
  if (!/^(19|20|21)\d{2}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) return [];
  return Array.from({ length: 4 }, (_, index) =>
    new Date(Date.UTC(Number(year), Number(month) - 4 + index, 1)).toISOString().slice(0, 7),
  );
}

export function carbonRollingComparison(
  rows: UtilityGraphRow[],
  targets: UtilityCostTarget[],
  year: string,
  month: string,
  fuel: string,
) {
  const comparisons = carbonMonthlyComparison(rows, targets, fuel);
  return carbonRollingMonths(year, month).map((period) => {
    const row = comparisons.find((r) => r.month === period);
    const actual = row?.emissions ?? null;
    const target = row?.targetCarbon ?? null;
    return {
      month: period,
      actual,
      target,
      percent:
        actual !== null && target !== null && Number(target) > 0
          ? ((Number(actual) / Number(target)) * 100).toFixed(2)
          : null,
      issue:
        actual === null
          ? 'Missing emissions.'
          : target === null
            ? 'Missing carbon target.'
            : Number(target) === 0
              ? 'A zero target has no percentage ratio.'
              : null,
    };
  });
}

export function carbonRecentSummary(points: ReturnType<typeof carbonRollingComparison>) {
  const previousTotal = sumUtilityAmounts(points.slice(0, 3).map((p) => p.actual));
  return {
    current: points[3]?.actual ?? null,
    previousAverage: previousTotal !== null && points.length === 4 ? String(Number(previousTotal) / 3) : null,
  };
}
