import { z } from 'zod';
import { correctionReason } from './energy';
import { fuels } from './tariffs';
export const catalogInput = z
  .object({
    kind: z.enum(['FUEL', 'END_USE']),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{1,40}$/),
    fuel: z.enum(fuels),
    name: z.string().trim().min(1).max(100),
    color: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^#[0-9A-F]{6}$/, 'Use a six-digit hex colour.'),
    source: z.string().trim().min(3).max(500),
    legacySource: z.string().trim().max(100).default(''),
    legacyId: z.string().trim().max(160).default(''),
    retired: z.boolean().default(false),
  })
  .strict()
  .refine((v) => !v.legacyId || !!v.legacySource, 'Name the source system for a legacy ID.');
export const catalogCorrectionInput = z.object({ entry: catalogInput, reason: correctionReason }).strict();
