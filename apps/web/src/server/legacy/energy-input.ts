import { z } from 'zod';
import { uuid } from '../../domain/policy';
const id = z.string().trim().min(1).max(160);
const decimal = z.union([
  z.string().regex(/^\d{1,16}(\.\d{1,12})?$/),
  z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
]);
const reference = z.string().trim().min(3).max(500);
const scope = { siteId: id, fuelSourceId: id, usedInId: id };
const timestamp = z.iso.datetime({ offset: true }).nullable();
export const legacyEnergyBundle = z
  .object({
    source: z.string().trim().min(1).max(100),
    reference,
    tables: z
      .object({
        BusinessFuelsSize: z.array(z.object({ id, meters: z.string().min(1).max(4000), ...scope })).max(500),
        UtilityConsumptions: z
          .array(
            z.object({
              id,
              ...scope,
              date: z.string().min(1).max(100),
              consumption: decimal,
              totalCost: decimal.nullable(),
              vat: decimal.nullable(),
              vatCost: decimal.nullable(),
              conversionFactor: decimal.nullable(),
              fuelUnit: z.string().min(1).max(40),
              created_at: timestamp,
              updated_at: timestamp,
              population: decimal.nullable(),
              workingHours: decimal.nullable(),
            }),
          )
          .max(500),
      })
      .strict(),
    decisions: z
      .object({
        meters: z
          .array(
            z
              .object({
                legacyId: id,
                siteId: uuid,
                energyUseCode: z.string().trim().toUpperCase().min(1).max(40),
                format: z.enum(['SINGLE', 'COMMA', 'SEMICOLON', 'NEWLINE']),
                tokens: z
                  .array(z.object({ token: z.string().trim().min(1).max(160), meterId: uuid }).strict())
                  .min(1)
                  .max(100),
                reason: reference,
              })
              .strict(),
          )
          .max(500),
        readings: z
          .array(
            z
              .object({
                legacyId: id,
                meterListId: id,
                meterId: uuid,
                month: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
                sourceUnit: z.enum(['kWh', 'MWh', 'm3', 'litre', 'kg']),
                estimated: z.boolean(),
                currency: z
                  .string()
                  .toUpperCase()
                  .regex(/^[A-Z]{3}$/),
                costBasis: z.enum(['NET', 'GROSS']),
                vatBasis: z.enum(['PERCENT', 'FRACTION']),
                conversionVersion: z.string().min(1).max(100),
                factorBasis: z.enum(['KWH_PER_SOURCE_UNIT', 'PRESERVE_ONLY']),
                acceptCostDifference: z.boolean(),
                population: z.enum(['PRESERVE_ONLY', 'MONTHLY_AVERAGE']),
                workingHours: z.enum(['PRESERVE_ONLY', 'MONTHLY_TOTAL']),
                reason: reference,
              })
              .strict(),
          )
          .max(500),
        existingDrivers: z.enum(['REJECT', 'REUSE_EQUAL']),
      })
      .strict(),
  })
  .strict()
  .refine((v) => v.tables.BusinessFuelsSize.length + v.tables.UtilityConsumptions.length > 0, 'Provide source rows.');
export type LegacyEnergyBundle = z.output<typeof legacyEnergyBundle>;
