import { z } from 'zod';

export const apiImportSettings = z
  .object({
    url: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
        } catch {
          return false;
        }
      }, 'Use an HTTPS URL without embedded credentials or a fragment.'),
  })
  .strict();
const amount = z.number().finite().nonnegative();
const month = z.object({
  site: z.string().trim().min(1).max(160),
  year: z.number().int().min(1900).max(2199),
  month: z.number().int().min(1).max(12),
});
const classification = z.enum(['R', 'NR', 'N/A']);
export const apiImportPayload = z
  .object({
    version: z.literal(1),
    consumption: z
      .array(
        month
          .extend({
            energyUse: z.string().min(1),
            utility: z.string().min(1),
            consumption: amount,
            unit: z.string().min(1),
            totalCost: amount.nullable(),
            vatCost: amount.nullable(),
            conversionFactor: z.number().finite().positive(),
            population: amount.nullable(),
            operatingHours: amount.max(24).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(10000),
    emissions: z
      .array(month.extend({ emissionFactor: amount }).strict())
      .min(1)
      .max(10000),
    targets: z
      .array(month.extend({ energy: amount, carbon: amount }).strict())
      .min(1)
      .max(10000),
    drivers: z
      .array(
        month
          .omit({ month: true })
          .extend({
            heating: classification,
            cooling: classification,
            population: classification,
            operatingHours: classification,
            daylighting: classification,
            buildingSize: classification,
          })
          .strict(),
      )
      .min(1)
      .max(10000),
  })
  .strict();
export const apiImportExample = {
  version: 1,
  consumption: [
    {
      site: 'Example site',
      year: 2025,
      month: 1,
      energyUse: 'Heating',
      utility: 'Gas',
      consumption: 1250,
      unit: 'kWh',
      totalCost: 150,
      vatCost: 25,
      conversionFactor: 1,
      population: 20,
      operatingHours: 8,
    },
  ],
  emissions: [{ site: 'Example site', year: 2025, month: 1, emissionFactor: 0.183 }],
  targets: [{ site: 'Example site', year: 2025, month: 1, energy: 1200, carbon: 220 }],
  drivers: [
    {
      site: 'Example site',
      year: 2025,
      heating: 'R',
      cooling: 'N/A',
      population: 'NR',
      operatingHours: 'R',
      daylighting: 'N/A',
      buildingSize: 'NR',
    },
  ],
};
