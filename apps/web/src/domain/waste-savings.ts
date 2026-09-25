import { Prisma } from '@prisma/client';
import type { ReportingResult } from './analysis/reporting';
import type { CarbonSnapshot } from './carbon';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export type ImpactReading = {
  id: string;
  revision: number;
  normalizedKwh: string;
  netCost: string | null;
  currency: string | null;
  estimated: boolean;
  conversionVersion: string;
};
export function wasteSavings(output: ReportingResult, readings: ImpactReading[], carbon: CarbonSnapshot | null) {
  const rows = output.rows.map((row) => {
    if (row.status !== 'CALCULATED') return { month: row.month, status: 'BLOCKED' as const, issues: row.issues };
    const reading = readings.find((r) => r.id === row.consumptionId);
    const rate =
      reading?.netCost !== null &&
      reading?.netCost !== undefined &&
      reading.currency &&
      new Decimal(reading.normalizedKwh).gt(0)
        ? new Decimal(reading.netCost).div(reading.normalizedKwh)
        : null;
    const factor = carbon?.rows.find(
      (r) =>
        r.month === row.month && r.readingId === row.consumptionId && !r.issue && r.factor !== undefined && r.factorId,
    );
    const impact = (value: number, multiplier: Prisma.Decimal | null) =>
      multiplier === null ? null : new Decimal(value).times(multiplier).toString();
    const factorValue = factor ? new Decimal(factor.factor!) : null;
    return {
      ...row,
      reading: reading ?? null,
      currency: rate ? reading!.currency : null,
      rate: rate?.toString() ?? null,
      preCost: impact(row.preNraVarianceKwh, rate),
      postCost: impact(row.postNraVarianceKwh, rate),
      preCarbon: impact(row.preNraVarianceKwh, factorValue),
      postCarbon: impact(row.postNraVarianceKwh, factorValue),
      factor: factor ?? null,
    };
  });
  const calculated = rows.filter((r) => r.status === 'CALCULATED');
  const complete = output.status === 'CALCULATED' && rows.length > 0 && calculated.length === rows.length;
  const currencies = new Set(calculated.map((r) => r.currency));
  const sum = (
    key: 'preNraVarianceKwh' | 'postNraVarianceKwh' | 'preCost' | 'postCost' | 'preCarbon' | 'postCarbon',
  ) =>
    complete && calculated.every((r) => r[key] !== null)
      ? calculated.reduce((s, r) => s.plus(r[key]!), new Decimal(0)).toString()
      : null;
  return {
    version: 'waste-impact-v1',
    rows,
    complete,
    preKwh: sum('preNraVarianceKwh'),
    postKwh: sum('postNraVarianceKwh'),
    currency: currencies.size === 1 ? (calculated[0]?.currency ?? null) : null,
    preCost: currencies.size === 1 ? sum('preCost') : null,
    postCost: currencies.size === 1 ? sum('postCost') : null,
    preCarbon: sum('preCarbon'),
    postCarbon: sum('postCarbon'),
    significantMonths: calculated.filter((r) => r.significance.significant === true).length,
  };
}
