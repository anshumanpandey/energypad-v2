import { z } from 'zod';
const text = (max: number) => z.string().trim().min(1).max(max);
const common = {
  previousId: z.uuid().nullable(),
  eventId: z.uuid(),
  workVersionId: z.uuid().nullable(),
  actionId: z.uuid().nullable(),
  note: text(2000).min(10),
  requestKey: z.uuid(),
};
const provenance = {
  energyUseId: z.uuid(),
  source: text(500),
  legacySource: z.string().trim().max(200).default(''),
  legacyId: z.string().trim().max(200).default(''),
};
export const supportingEvidenceInput = z
  .discriminatedUnion('kind', [
    z.object({ ...common, kind: z.literal('LOG'), operationalEventId: z.uuid() }).strict(),
    z
      .object({
        ...common,
        ...provenance,
        kind: z.literal('PROGRAMME'),
        title: text(200),
        question: text(2000),
        answers: z.array(text(1000)).min(1).max(20),
      })
      .strict(),
    z
      .object({
        ...common,
        ...provenance,
        kind: z.literal('TIP'),
        category: text(200),
        text: text(2500),
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      })
      .strict(),
  ])
  .superRefine((data, ctx) => {
    if (data.actionId && !data.workVersionId)
      ctx.addIssue({ code: 'custom', message: 'An action requires its saved plan.', path: ['actionId'] });
    if ('legacyId' in data && Boolean(data.legacyId) !== Boolean(data.legacySource))
      ctx.addIssue({ code: 'custom', message: 'Provide both legacy source and identity.', path: ['legacyId'] });
  });
