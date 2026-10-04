import { Prisma } from '@prisma/client';
import type { MonthlyPlanPayload } from './monthly-plans';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export function consumptionTargetChart(
  months: { month: string; kwh: string | null }[],
  fuels: string[],
  plans: { month: string; fuel: string; kind: string; replacement: unknown; payload: unknown }[],
) {
  const selected = [...new Set(fuels)];
  const current = plans.filter(
    (p) => p.kind === 'TARGET' && !p.replacement && (selected.includes(p.fuel) || p.fuel === 'ALL'),
  );
  const rows = months.map((m) => {
    const targets = current.filter((p) => p.month === m.month);
    const siteTargets = targets.filter((p) => p.fuel === 'ALL');
    const utilityTargets = targets.filter((p) => p.fuel !== 'ALL');
    const complete =
      selected.length > 0 &&
      (siteTargets.length === 1 ||
        (!siteTargets.length && selected.every((fuel) => utilityTargets.filter((p) => p.fuel === fuel).length === 1)));
    return {
      month: m.month,
      consumption: m.kwh,
      target: complete
        ? (siteTargets.length ? siteTargets : utilityTargets)
            .reduce((sum, p) => sum.plus((p.payload as MonthlyPlanPayload).normalizedKwh), new Decimal(0))
            .toString()
        : null,
    };
  });
  const total = (field: 'consumption' | 'target') =>
    rows.length === 12 && rows.every((r) => r[field] !== null)
      ? rows.reduce((sum, r) => sum.plus(r[field]!), new Decimal(0)).toString()
      : null;
  return { rows, consumption: total('consumption'), target: total('target') };
}
