import { Prisma } from '@prisma/client';
import { monthPeriod } from './energy';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export type OverviewReading = {
  id: string;
  meterId: string;
  revision: number;
  periodStart: Date;
  periodEnd: Date;
  normalizedKwh: { toString(): string };
  netCost: { toString(): string } | null;
  currency: string | null;
  estimated: boolean;
  conversionVersion: string;
};
// Full calendar months only. Never substitute a partial sum for a complete KPI.
export function overviewEnergy(year: number, meterIds: string[], records: OverviewReading[]) {
  const rows = records.filter((r) => meterIds.includes(r.meterId));
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const { start, end } = monthPeriod(month);
    const candidates = rows.filter((r) => r.periodStart < end && r.periodEnd > start);
    const complete =
      meterIds.length > 0 &&
      meterIds.every((id) => {
        const matches = candidates.filter((r) => r.meterId === id);
        return matches.length === 1 && +matches[0].periodStart === +start && +matches[0].periodEnd === +end;
      });
    const currencies = [...new Set(candidates.map((r) => r.currency).filter((c): c is string => c !== null))];
    const costComplete =
      complete && currencies.length === 1 && candidates.every((r) => r.netCost !== null && r.currency !== null);
    return {
      month,
      complete,
      kwh: complete ? candidates.reduce((a, r) => a.plus(r.normalizedKwh.toString()), new Decimal(0)).toString() : null,
      netCost: costComplete
        ? candidates.reduce((a, r) => a.plus(r.netCost!.toString()), new Decimal(0)).toString()
        : null,
      currency: costComplete ? currencies[0] : null,
      estimated: candidates.filter((r) => r.estimated).length,
      evidence: candidates.map((r) => ({
        id: r.id,
        revision: r.revision,
        meterId: r.meterId,
        conversionVersion: r.conversionVersion,
      })),
    };
  });
  const currencies = new Set(months.map((m) => m.currency));
  return {
    months,
    completeMonths: months.filter((m) => m.complete).length,
    kwh: months.every((m) => m.kwh !== null)
      ? months.reduce((a, m) => a.plus(m.kwh!), new Decimal(0)).toString()
      : null,
    netCost:
      months.every((m) => m.netCost !== null) && currencies.size === 1
        ? months.reduce((a, m) => a.plus(m.netCost!), new Decimal(0)).toString()
        : null,
    currency: currencies.size === 1 ? months[0].currency : null,
  };
}
