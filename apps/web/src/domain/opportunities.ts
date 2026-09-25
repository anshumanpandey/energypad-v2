import { z } from 'zod';
import { DomainError } from './policy';
export const opportunityInput = z
  .object({
    runId: z.uuid(),
    carbonRunId: z.uuid().optional(),
    title: z.string().trim().min(3).max(160),
    rationale: z.string().trim().min(10).max(4000),
    requestKey: z.uuid(),
  })
  .strict();
export const opportunityReviewInput = z
  .object({
    previousId: z.uuid(),
    workVersionId: z.uuid().nullable().optional(),
    verificationId: z.uuid().nullable().optional(),
    status: z.enum(['REVIEWING', 'APPROVED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'REJECTED']),
    note: z.string().trim().min(10).max(4000),
    requestKey: z.uuid(),
  })
  .strict();
export const opportunityTransitions = {
  DETECTED: ['REVIEWING', 'REJECTED'],
  REVIEWING: ['APPROVED', 'REJECTED'],
  APPROVED: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['IMPLEMENTED', 'REJECTED'],
  IMPLEMENTED: ['VERIFICATION'],
  VERIFICATION: ['VERIFICATION', 'VERIFIED', 'REJECTED'],
  VERIFIED: [],
  REJECTED: [],
} as const;
export type OpportunityStatus = keyof typeof opportunityTransitions;
export function checkOpportunityTransition(from: string, to: string) {
  if (!(opportunityTransitions[from as OpportunityStatus] as readonly string[] | undefined)?.includes(to))
    throw new DomainError('OPPORTUNITY_TRANSITION', 'This investigation cannot move to that state.', 409);
}
const action = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(3).max(200),
    ownerMembershipId: z.uuid(),
    dueDate: z.iso.date().nullable(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
    completionEvidence: z.string().trim().max(2000),
  })
  .strict()
  .refine(
    (a) => a.status !== 'DONE' || a.completionEvidence.length >= 10,
    'Completed actions require evidence of at least 10 characters.',
  )
  .refine(
    (a) => a.status === 'DONE' || a.completionEvidence === '',
    'Only completed actions can carry completion evidence.',
  );
export const opportunityWorkInput = z
  .object({
    previousId: z.uuid().nullable(),
    eventId: z.uuid(),
    ownerMembershipId: z.uuid(),
    actions: z.array(action).max(20),
    note: z.string().trim().min(10).max(4000),
    requestKey: z.uuid(),
  })
  .strict()
  .refine((p) => new Set(p.actions.map((a) => a.id)).size === p.actions.length, 'Action IDs must be unique.');
export type OpportunityAction = z.infer<typeof action>;
export function checkWorkChange(stage: string, previous: OpportunityAction[], next: OpportunityAction[]) {
  if (['IMPLEMENTED', 'VERIFICATION', 'VERIFIED', 'REJECTED'].includes(stage))
    throw new DomainError('WORK_CLOSED', 'This opportunity is read-only.', 409);
  if (stage !== 'IN_PROGRESS' && next.some((a) => a.status !== 'TODO'))
    throw new DomainError('ACTION_STAGE', 'Start implementation before recording action progress.', 409);
  if (['APPROVED', 'IN_PROGRESS'].includes(stage)) {
    if (
      previous.length !== next.length ||
      previous.some((old) => {
        const updated = next.find((a) => a.id === old.id);
        return !updated || old.title !== updated.title || old.dueDate !== updated.dueDate;
      })
    )
      throw new DomainError('APPROVED_SCOPE', 'Approved action scope and dates cannot be changed.', 409);
    for (const old of previous) {
      const updated = next.find((a) => a.id === old.id)!;
      const order = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
      if (
        order[updated.status] < order[old.status] ||
        (old.status === 'DONE' && old.completionEvidence !== updated.completionEvidence)
      )
        throw new DomainError(
          'ACTION_HISTORY',
          'Completed evidence cannot be changed and action progress cannot go backwards.',
          409,
        );
    }
  }
}
