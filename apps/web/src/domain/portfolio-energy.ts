import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { fuels } from './tariffs';
import { uuid } from './policy';
import type { overviewEnergy } from './overview';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export const portfolioEnergyInput = z
  .object({
    year: z.number().int().min(1900).max(2199),
    fuel: z.enum(['ALL', ...fuels]).default('ALL'),
    siteId: uuid.optional(),
  })
  .strict();
export type SiteEnergy = {
  id: string;
  name: string;
  code: string;
  meters: { id: string; name: string; fuel: string }[];
  energy: ReturnType<typeof overviewEnergy>;
};
export function aggregatePortfolioEnergy(year: number, sites: SiteEnergy[]) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const values = sites.map((s) => s.energy.months[i]);
    const complete = values.length > 0 && values.every((m) => m.kwh !== null);
    const currencies = new Set(values.map((m) => m.currency));
    const costComplete =
      complete && values.every((m) => m.netCost !== null && m.currency !== null) && currencies.size === 1;
    return {
      month: `${year}-${String(i + 1).padStart(2, '0')}`,
      completeSites: values.filter((m) => m.complete).length,
      kwh: complete ? values.reduce((sum, m) => sum.plus(m.kwh!), new Decimal(0)).toString() : null,
      netCost: costComplete ? values.reduce((sum, m) => sum.plus(m.netCost!), new Decimal(0)).toString() : null,
      currency: costComplete ? values[0].currency : null,
      estimated: values.reduce((sum, m) => sum + m.estimated, 0),
    };
  });
  const complete = sites.length > 0 && months.every((m) => m.kwh !== null);
  const currencies = new Set(months.map((m) => m.currency));
  const costComplete = complete && months.every((m) => m.netCost !== null) && currencies.size === 1;
  return {
    status: sites.length === 0 ? 'EMPTY' : complete ? 'COMPLETE' : 'INCOMPLETE',
    kwh: complete ? months.reduce((sum, m) => sum.plus(m.kwh!), new Decimal(0)).toString() : null,
    netCost: costComplete ? months.reduce((sum, m) => sum.plus(m.netCost!), new Decimal(0)).toString() : null,
    currency: costComplete ? months[0].currency : null,
    months,
  };
}
export type PortfolioEnergyResult = ReturnType<typeof aggregatePortfolioEnergy> & {
  portfolio: { id: string; name: string };
  definition: z.infer<typeof portfolioEnergyInput>;
  checkedAt: string;
  scope: string;
  availableSites: { id: string; name: string; code: string }[];
  sites: SiteEnergy[];
};
