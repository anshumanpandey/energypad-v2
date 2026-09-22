import { z } from 'zod';
import { uuid } from './policy';
import { correctionReason } from './energy';
export const fuels = ['ELECTRICITY', 'GAS', 'OIL', 'LPG', 'BIOMASS', 'HEAT', 'OTHER'] as const;
export const rateUnits = ['kWh', 'MWh', 'm3', 'litre', 'kg'] as const;
const legacyId = z.string().trim().max(160).default('');
const source = z.string().trim().min(3).max(500);
export const energyUseInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{1,40}$/, 'Use letters, numbers, hyphens or underscores.'),
    name: z.string().trim().min(1).max(100),
    fuel: z.enum(fuels),
    source,
    fuelCatalogId: uuid.nullish(),
    endUseCatalogId: uuid.nullish(),
    legacySource: z.string().trim().max(100).default(''),
    fuelLegacyId: legacyId,
    endUseLegacyId: legacyId,
    associationLegacyId: legacyId,
    associationLegacyTable: z.enum(['', 'BusinessFuelUses', 'UsedInToFuelSourceToSite']).default(''),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.fuelLegacyId || v.endUseLegacyId || v.associationLegacyId) && !v.legacySource)
      ctx.addIssue({
        code: 'custom',
        path: ['legacySource'],
        message: 'Name the source system for legacy identities.',
      });
    if (!!v.associationLegacyId !== !!v.associationLegacyTable)
      ctx.addIssue({
        code: 'custom',
        path: ['associationLegacyTable'],
        message: 'Provide both the association table and source ID.',
      });
  });
const date = z
  .string()
  .regex(/^(19|20|21)\d{2}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  }, 'Enter a valid calendar date.');
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const endClock = z.union([clock, z.literal('24:00')]);
export const tariffBandInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    days: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .refine((v) => new Set(v).size === v.length, 'Select each weekday once.'),
    startTime: clock,
    endTime: endClock,
    rate: z
      .string()
      .trim()
      .regex(/^\d{1,8}(\.\d{1,6})?$/, 'Use a non-negative rate with up to six decimals.'),
    legacyId,
  })
  .strict()
  .refine((v) => v.endTime > v.startTime, 'Use an end time after the start; split overnight bands across weekdays.');
export const tariffInput = z
  .object({
    energyUseId: uuid,
    name: z.string().trim().min(1).max(100),
    firstDay: date,
    lastDay: date,
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    rateUnit: z.enum(rateUnits),
    taxBasis: z.enum(['NET', 'GROSS']),
    vatPercent: z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,3})?$/)
      .refine((v) => Number(v) <= 100, 'VAT must be between 0 and 100.'),
    timezone: z
      .string()
      .trim()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: v });
          return !!v;
        } catch {
          return false;
        }
      }, 'Enter an IANA timezone.'),
    source,
    legacySource: z.string().trim().max(100).default(''),
    pricingLegacyId: legacyId,
    bands: z.array(tariffBandInput).min(1).max(32),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.lastDay < v.firstDay)
      ctx.addIssue({ code: 'custom', path: ['lastDay'], message: 'Last day cannot precede first day.' });
    if ((v.pricingLegacyId || v.bands.some((b) => b.legacyId)) && !v.legacySource)
      ctx.addIssue({
        code: 'custom',
        path: ['legacySource'],
        message: 'Name the source system for legacy identities.',
      });
    const ids = v.bands.map((b) => b.legacyId).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', path: ['bands'], message: 'Legacy band IDs must be unique within a tariff.' });
    v.bands.forEach((b, i) =>
      v.bands.slice(0, i).forEach((a) => {
        if (b.days.some((d) => a.days.includes(d)) && b.startTime < a.endTime && a.startTime < b.endTime)
          ctx.addIssue({ code: 'custom', path: ['bands', i], message: 'Time bands overlap on a selected weekday.' });
      }),
    );
  });
export const tariffCorrectionInput = z.object({ tariff: tariffInput, reason: correctionReason }).strict();
