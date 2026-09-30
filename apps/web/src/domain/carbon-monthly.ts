import { Prisma, type ConsumptionRecord, type EmissionFactorVersion } from '@prisma/client';
import type { CarbonSnapshot } from './carbon';
import { monthPeriod } from './energy';
const Decimal = Prisma.Decimal.clone({ precision: 50 });

// Shared by read-only charts and immutable saved carbon runs.
export function monthlyCarbonRows(
  year: number,
  readings: ConsumptionRecord[],
  factors: EmissionFactorVersion[],
): CarbonSnapshot['rows'] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const period = monthPeriod(month);
    const candidates = readings.filter((r) => +r.periodStart < +period.end && +r.periodEnd > +period.start);
    if (
      candidates.length !== 1 ||
      +candidates[0].periodStart !== +period.start ||
      +candidates[0].periodEnd !== +period.end
    )
      return {
        month,
        issue: candidates.length ? 'Ambiguous or non-monthly consumption coverage.' : 'Missing consumption.',
      };
    const reading = candidates[0];
    const base = {
      month,
      readingId: reading.id,
      readingRevision: reading.revision,
      normalizedKwh: reading.normalizedKwh.toString(),
      conversionVersion: reading.conversionVersion,
      estimated: reading.estimated,
    };
    const matches = factors.filter(
      (f) => f.fuel === reading.fuel && +f.validFrom <= +period.start && +f.validUntil >= +period.end,
    );
    if (matches.length !== 1)
      return {
        ...base,
        issue: 'A single factor must cover the whole month. Add complete coverage; mid-month changes are not prorated.',
      };
    const factor = matches[0];
    const kg = new Decimal(reading.normalizedKwh.toString()).mul(factor.factor.toString());
    return {
      ...base,
      issue: null,
      factorId: factor.id,
      factorRevision: factor.revision,
      factor: factor.factor.toString(),
      source: factor.source,
      kgCO2e: kg.toFixed(),
    };
  });
}
