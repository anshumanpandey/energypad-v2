import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { monthlyCarbonRows } from '../domain/carbon-monthly';
import type { UtilityGraphRow } from '../domain/utility-graphs';

const Decimal = Prisma.Decimal.clone({ precision: 50 });

export class UtilityGraphService extends FoundationService {
  async records(actor: Actor, organisationId: string) {
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
              rows: monthlyCarbonRows(
                year,
                siteReadings.filter((r) => r.meterId === meter.id),
                factors,
              ),
            }));
            for (const fuel of new Set(yearMeters.map((m) => m.fuel))) {
              const matching = results.filter((r) => r.meter.fuel === fuel);
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
                  currency: currencies.size === 1 ? [...currencies][0]! : null,
                  notes: [...new Set(rows.filter((r) => r.issue).map((r) => r.issue!))],
                  zeroFilled: originals.some(
                    (r) =>
                      Array.isArray(r?.qualityFlags) &&
                      r.qualityFlags.includes('Missing month filled with 0 after confirmation'),
                  ),
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
