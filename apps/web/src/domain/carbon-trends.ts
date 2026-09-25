import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { carbonSummaryInput, type CarbonSnapshot } from './carbon';
import { uuid } from './policy';
import { monthPeriod } from './energy';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export const carbonTrendInput = carbonSummaryInput
  .extend({
    comparisonYear: z.number().int().min(1900).max(2199),
    kind: z.enum(['site', 'portfolio']),
    id: uuid,
  })
  .refine((v) => v.year !== v.comparisonYear, 'Choose two different years.');
export type TrendMeter = { id: string; name: string };
export type TrendRun = { id: string; algorithmVersion: string; createdAt: string; snapshot: CarbonSnapshot };
export type TrendReading = { id: string; meterId: string; periodStart: Date; periodEnd: Date };
export type TrendPoint = {
  month: string;
  status: 'COMPLETE' | 'INCOMPLETE' | 'EMPTY';
  kgCO2e: string | null;
  ready: number;
  expected: number;
  estimated: number;
  meters: {
    meterId: string;
    name: string;
    status: 'READY' | 'MISSING' | 'BLOCKED' | 'OUTDATED';
    runId: string | null;
    algorithm: string | null;
    calculatedAt: string | null;
    issue: string | null;
    evidence: CarbonSnapshot['rows'][number] | null;
  }[];
};
export function carbonTrendPoints(
  year: number,
  meters: TrendMeter[],
  runs: Map<string, TrendRun>,
  readings: TrendReading[],
  factorIds: Set<string>,
  algorithm: string,
): TrendPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const { start, end } = monthPeriod(month);
    const evidence: TrendPoint['meters'] = meters.map((meter) => {
      const run = runs.get(meter.id);
      const matches = run?.snapshot.rows.filter((r) => r.month === month) ?? [];
      const row = matches.length === 1 ? matches[0] : null;
      const current = readings.filter((r) => r.meterId === meter.id && r.periodStart < end && r.periodEnd > start);
      const base = {
        meterId: meter.id,
        name: meter.name,
        runId: run?.id ?? null,
        algorithm: run?.algorithmVersion ?? null,
        calculatedAt: run?.createdAt ?? null,
        evidence: row,
      };
      if (!run) return { ...base, status: 'MISSING', issue: 'No saved run for this year and definition.' };
      if (run.algorithmVersion !== algorithm)
        return { ...base, status: 'OUTDATED', issue: 'Calculation method changed; calculate again.' };
      if (!row || row.issue || !row.readingId || !row.factorId || row.kgCO2e === undefined)
        return { ...base, status: 'BLOCKED', issue: row?.issue ?? 'Saved month has incomplete evidence.' };
      if (
        current.length !== 1 ||
        current[0].id !== row.readingId ||
        +current[0].periodStart !== +start ||
        +current[0].periodEnd !== +end ||
        !factorIds.has(row.factorId)
      )
        return { ...base, status: 'OUTDATED', issue: 'Reading or factor coverage changed; calculate again.' };
      return { ...base, status: 'READY', issue: null };
    });
    const ready = evidence.filter((r) => r.status === 'READY');
    const complete = meters.length > 0 && ready.length === meters.length;
    return {
      month,
      status: !meters.length ? 'EMPTY' : complete ? 'COMPLETE' : 'INCOMPLETE',
      kgCO2e: complete ? ready.reduce((sum, r) => sum.plus(r.evidence!.kgCO2e!), new Decimal(0)).toString() : null,
      ready: ready.length,
      expected: meters.length,
      estimated: ready.filter((r) => r.evidence?.estimated).length,
      meters: evidence,
    };
  });
}
export function trendTotal(points: { kgCO2e: string | null }[]) {
  return points.length > 0 && points.every((p) => p.kgCO2e !== null)
    ? points.reduce((sum, p) => sum.plus(p.kgCO2e!), new Decimal(0)).toString()
    : null;
}
export function trendChange(current: string | null, previous: string | null) {
  if (current === null || previous === null) return { difference: null, percent: null };
  const difference = new Decimal(current).minus(previous);
  return {
    difference: difference.toString(),
    percent: new Decimal(previous).isZero() ? null : difference.div(previous).times(100).toString(),
  };
}
export function aggregateTrend(points: TrendPoint[][]) {
  return Array.from({ length: 12 }, (_, i) => {
    const rows = points.map((p) => p[i]);
    return {
      kgCO2e: trendTotal(rows),
      readySites: rows.filter((p) => p.status === 'COMPLETE').length,
      expectedSites: rows.length,
      readyMeters: rows.reduce((n, p) => n + p.ready, 0),
      expectedMeters: rows.reduce((n, p) => n + p.expected, 0),
      estimated: rows.reduce((n, p) => n + p.estimated, 0),
    };
  });
}
