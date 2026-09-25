import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { carbonSummaryInput } from './carbon';
import { fuels } from './tariffs';
import { uuid } from './policy';
import { overviewEnergy, type OverviewReading } from './overview';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export const benchmarkInput = carbonSummaryInput.extend({
  month: z.number().int().min(0).max(12).default(0),
  fuel: z.enum(fuels).default('ELECTRICITY'),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .default('GBP'),
  metric: z.enum(['kwh', 'netCost']).default('kwh'),
  order: z.enum(['asc', 'desc']).default('asc'),
  siteId: uuid.optional(),
  siteType: z.string().trim().max(100).default(''),
});
export function benchmarkEnergy(
  year: number,
  month: number,
  currency: string,
  meters: string[],
  records: OverviewReading[],
) {
  const all = overviewEnergy(year, meters, records);
  const months = month ? all.months.filter((r) => Number(r.month.slice(5)) === month) : all.months;
  const complete = meters.length > 0 && months.every((r) => r.kwh !== null);
  const costComplete = complete && months.every((r) => r.netCost !== null && r.currency === currency);
  return {
    months,
    expectedMonths: months.length,
    completeMonths: months.filter((r) => r.complete).length,
    estimated: months.reduce((a, r) => a + r.estimated, 0),
    kwh: complete ? months.reduce((a, r) => a.plus(r.kwh!), new Decimal(0)).toString() : null,
    netCost: costComplete ? months.reduce((a, r) => a.plus(r.netCost!), new Decimal(0)).toString() : null,
    energyIssue: !meters.length
      ? 'No active meters for this fuel.'
      : !complete
        ? 'Incomplete monthly meter coverage.'
        : null,
    costIssue: !complete
      ? 'Incomplete energy coverage.'
      : !costComplete
        ? `Missing net cost or currency differs from ${currency}.`
        : null,
  };
}
export function rankSites<T extends { id: string; code: string; kwh: string | null; netCost: string | null }>(
  rows: T[],
  metric: 'kwh' | 'netCost',
  order: 'asc' | 'desc',
) {
  const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const sorted = [...rows].sort((a, b) => {
    const x = a[metric],
      y = b[metric];
    const n =
      x === null ? (y === null ? 0 : 1) : y === null ? -1 : new Decimal(x).comparedTo(y) * (order === 'asc' ? 1 : -1);
    return n || compareText(a.code, b.code) || compareText(a.id, b.id);
  });
  let rank = 0;
  return sorted.map((row, i) => {
    if (row[metric] === null) return { ...row, rank: null };
    if (i === 0 || !new Decimal(row[metric]!).equals(sorted[i - 1][metric]!)) rank = i + 1;
    return { ...row, rank };
  });
}
