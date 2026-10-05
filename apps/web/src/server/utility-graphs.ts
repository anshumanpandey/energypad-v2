import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { monthlyCarbonRows } from '../domain/carbon-monthly';
import type { UtilityGraphRow, UtilityCostTarget } from '../domain/utility-graphs';
import type { MonthlyPlanPayload } from '../domain/monthly-plans';
import { importedFuel } from '../domain/imported-fuel';

const Decimal = Prisma.Decimal.clone({ precision: 50 });

export class UtilityGraphService extends FoundationService {
  async targets(actor: Actor, organisationId: string): Promise<UtilityCostTarget[]> {
    const sites = await this.listSites(actor, organisationId);
    const plans = await this.db.monthlyPlanVersion.findMany({
      where: { organisationId, siteId: { in: sites.map((s) => s.id) }, kind: 'TARGET', replacement: { is: null } },
    });
    return plans.map((plan) => {
      const payload = plan.payload as unknown as MonthlyPlanPayload;
      return {
        siteId: plan.siteId,
        month: plan.month,
        fuel: plan.fuel,
        energy: payload.normalizedKwh,
        carbon: payload.carbon || null,
        cost: payload.cost || null,
        grossCost: payload.grossCost || null,
        currency: payload.currency || null,
      };
    });
  }
  async records(actor: Actor, organisationId: string, detail = false) {
    return this.db.$transaction(
      async (tx) => {
        const member = await this.membership(actor, organisationId, undefined, tx);
        const sites = await tx.site.findMany({
          where: {
            organisationId,
            archivedAt: null,
            ...(member.role === 'SITE_MANAGER'
              ? { assignments: { some: { membershipId: member.id, organisationId } } }
              : {}),
          },
          select: { id: true, name: true },
        });
        const siteIds = sites.map((s) => s.id);
        const [meters, readings, factors] = await Promise.all([
          tx.meter.findMany({ where: { organisationId, siteId: { in: siteIds }, archivedAt: null } }),
          tx.consumptionRecord.findMany({
            where: { organisationId, siteId: { in: siteIds }, replacement: { is: null } },
          }),
          tx.emissionFactorVersion.findMany({
            where: {
              organisationId,
              OR: [{ siteId: null }, { siteId: { in: siteIds } }],
              geography: 'GB',
              basis: 'LOCATION_BASED',
              unit: 'kgCO2e/kWh',
              replacement: { is: null },
            },
          }),
        ]);
        const output: UtilityGraphRow[] = [];
        for (const site of sites) {
          const siteReadings = readings.filter((r) => r.siteId === site.id);
          const years = [...new Set(siteReadings.map((r) => r.periodStart.getUTCFullYear()))];
          const siteMeters = meters.filter((m) => m.siteId === site.id);
          for (const year of years) {
            const representedFuels = new Set(
              siteReadings.filter((r) => r.periodStart.getUTCFullYear() === year).map((r) => r.fuel),
            );
            const yearMeters = siteMeters.filter((m) => representedFuels.has(m.fuel));
            const results = yearMeters.map((meter) => ({
              meter,
              displayFuel: (() => {
                const reading = siteReadings.find(
                  (r) => r.meterId === meter.id && r.periodStart.getUTCFullYear() === year,
                );
                return reading
                  ? importedFuel(reading.fuel, reading.importProvenance ?? reading.sourceProvenance)
                  : meter.fuel;
              })(),
              rows: monthlyCarbonRows(
                year,
                siteReadings.filter((r) => r.meterId === meter.id),
                factors,
              ),
            }));
            const groups = detail
              ? results.map((result) => [result])
              : [...new Set(results.map((r) => r.displayFuel))].map((fuel) =>
                  results.filter((r) => r.displayFuel === fuel),
                );
            for (const matching of groups) {
              const fuel = matching[0].displayFuel;
              for (let index = 0; index < 12; index++) {
                const rows = matching.map((r) => r.rows[index]);
                const sum = (values: (string | undefined)[]) =>
                  values.every((v) => v !== undefined)
                    ? values.reduce((total, value) => total.plus(value!), new Decimal(0)).toFixed()
                    : null;
                const originals = rows.map((r) => siteReadings.find((reading) => reading.id === r.readingId));
                const currencies = new Set(originals.map((r) => r?.currency).filter((value) => value != null));
                output.push({
                  siteId: site.id,
                  siteName: site.name,
                  fuel,
                  month: rows[0].month,
                  consumption: sum(rows.map((r) => r.normalizedKwh)),
                  emissions: sum(rows.map((r) => r.kgCO2e)),
                  cost: currencies.size === 1 ? sum(originals.map((r) => r?.netCost?.toString())) : null,
                  grossCost: currencies.size === 1 ? sum(originals.map((r) => r?.grossCost?.toString())) : null,
                  currency: currencies.size === 1 ? [...currencies][0]! : null,
                  notes: [...new Set(rows.filter((r) => r.issue).map((r) => r.issue!))],
                  zeroFilled: originals.some(
                    (r) =>
                      Array.isArray(r?.qualityFlags) &&
                      r.qualityFlags.includes('Missing month filled with 0 after confirmation'),
                  ),
                  ...(detail
                    ? {
                        meterId: matching[0].meter.id,
                        endUse:
                          [
                            ...new Set(
                              siteReadings
                                .filter(
                                  (r) => r.meterId === matching[0].meter.id && r.periodStart.getUTCFullYear() === year,
                                )
                                .map((r) => r.endUse),
                            ),
                          ].join(', ') || matching[0].meter.name,
                      }
                    : {}),
                });
              }
            }
          }
        }
        return output.sort(
          (a, b) =>
            a.month.localeCompare(b.month) || a.siteName.localeCompare(b.siteName) || a.fuel.localeCompare(b.fuel),
        );
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }
}
