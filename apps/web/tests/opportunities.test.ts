import { describe, expect, it } from 'vitest';
import { checkOpportunityTransition, opportunityInput, opportunityReviewInput } from '../src/domain/opportunities';
const id = 'b2ccdcb4-255e-484b-81a4-287aa7b2f618';
describe('opportunity investigation contract', () => {
  it('requires a saved source and meaningful rationale', () => {
    expect(
      opportunityInput.parse({
        runId: id,
        title: '  Investigate boiler  ',
        rationale: 'Compare operating hours',
        requestKey: id,
      }).title,
    ).toBe('Investigate boiler');
    expect(opportunityInput.safeParse({ runId: 'bad', title: 'x', rationale: 'why', requestKey: id }).success).toBe(
      false,
    );
    expect(
      opportunityInput.safeParse({
        runId: id,
        title: 'Boiler',
        rationale: 'Compare hours',
        requestKey: id,
        verified: true,
      }).success,
    ).toBe(false);
  });
  it('allows investigation and rejection but never promotes experimental results to approval or verification', () => {
    for (const [from, to] of [
      ['DETECTED', 'REVIEWING'],
      ['DETECTED', 'REJECTED'],
      ['REVIEWING', 'REJECTED'],
    ])
      expect(() => checkOpportunityTransition(from, to)).not.toThrow();
    for (const [from, to] of [
      ['REVIEWING', 'REVIEWING'],
      ['REJECTED', 'REVIEWING'],
      ['DETECTED', 'APPROVED'],
      ['REVIEWING', 'VERIFIED'],
    ])
      expect(() => checkOpportunityTransition(from, to)).toThrow();
  });
  it('requires an exact previous event and explanation for review', () => {
    expect(
      opportunityReviewInput.safeParse({
        previousId: id,
        status: 'REVIEWING',
        note: 'Check source records',
        requestKey: id,
      }).success,
    ).toBe(true);
    expect(opportunityReviewInput.safeParse({ status: 'REJECTED', note: '', requestKey: id }).success).toBe(false);
    expect(
      opportunityReviewInput.safeParse({
        previousId: id,
        status: 'APPROVED',
        note: 'Check source records',
        requestKey: id,
      }).success,
    ).toBe(false);
  });
});
