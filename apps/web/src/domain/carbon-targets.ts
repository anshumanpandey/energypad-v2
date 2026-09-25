import { z } from 'zod';
import { carbonInput } from './carbon';
import { correctionReason } from './energy';
import { uuid } from './policy';
export const carbonTargetInput = carbonInput
  .extend({
    name: z.string().trim().min(1).max(100),
    limitKgCO2e: z
      .string()
      .trim()
      .regex(/^\d{1,18}(\.\d{1,12})?$/, 'Enter a non-negative kgCO2e limit with up to twelve decimals.'),
    source: z.string().trim().min(3).max(1000),
  })
  .strict();
export const targetCorrectionInput = z.object({ target: carbonTargetInput, reason: correctionReason }).strict();
export const targetAssessmentInput = z.object({ runId: uuid }).strict();
