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
    status: z.enum(['REVIEWING', 'REJECTED']),
    note: z.string().trim().min(10).max(4000),
    requestKey: z.uuid(),
  })
  .strict();
export type OpportunityStatus = 'DETECTED' | 'REVIEWING' | 'REJECTED';
export function checkOpportunityTransition(from: string, to: string) {
  if (!((from === 'DETECTED' && ['REVIEWING', 'REJECTED'].includes(to)) || (from === 'REVIEWING' && to === 'REJECTED')))
    throw new DomainError(
      'OPPORTUNITY_TRANSITION',
      'This investigation cannot move to that state. Approval, actions and verification are not available yet.',
      409,
    );
}
