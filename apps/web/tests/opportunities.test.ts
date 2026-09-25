import { describe, expect, it } from 'vitest';
import {
  checkOpportunityTransition,
  opportunityInput,
  opportunityReviewInput,
  opportunityWorkInput,
  checkWorkChange,
} from '../src/domain/opportunities';
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
  it('enforces sequential operational stages without exposing verification', () => {
    for (const [from, to] of [
      ['DETECTED', 'REVIEWING'],
      ['DETECTED', 'REJECTED'],
      ['REVIEWING', 'REJECTED'],
      ['REVIEWING', 'APPROVED'],
      ['APPROVED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'IMPLEMENTED'],
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
        status: 'VERIFICATION',
        note: 'Check source records',
        requestKey: id,
      }).success,
    ).toBe(false);
  });
});

describe('opportunity work contracts', () => {
  const action = {
    id,
    title: 'Repair boiler schedule',
    ownerMembershipId: id,
    dueDate: '2026-10-01',
    status: 'TODO' as const,
    completionEvidence: '',
  };
  const input = {
    previousId: null,
    eventId: id,
    ownerMembershipId: id,
    actions: [action],
    note: 'Assign operational work',
    requestKey: id,
  };
  it('validates action identity, dates and completion evidence', () => {
    expect(opportunityWorkInput.safeParse(input).success).toBe(true);
    expect(opportunityWorkInput.safeParse({ ...input, actions: [action, action] }).success).toBe(false);
    expect(opportunityWorkInput.safeParse({ ...input, actions: [{ ...action, dueDate: '2026-02-30' }] }).success).toBe(
      false,
    );
    expect(opportunityWorkInput.safeParse({ ...input, actions: [{ ...action, status: 'DONE' }] }).success).toBe(false);
    expect(
      opportunityWorkInput.safeParse({
        ...input,
        actions: [{ ...action, completionEvidence: 'Invented completed work' }],
      }).success,
    ).toBe(false);
  });
  it('freezes approved action descriptions, IDs and dates', () => {
    expect(() => checkWorkChange('APPROVED', [action], [{ ...action, title: 'Different work' }])).toThrow();
    expect(() => checkWorkChange('IN_PROGRESS', [action], [])).toThrow();
    expect(() => checkWorkChange('APPROVED', [action], [{ ...action, dueDate: null }])).toThrow();
    expect(() => checkWorkChange('REVIEWING', [action], [])).not.toThrow();
  });
  it('allows forward progress only during implementation and preserves completed evidence', () => {
    const done = { ...action, status: 'DONE' as const, completionEvidence: 'Verified installation log reference' };
    expect(() => checkWorkChange('REVIEWING', [action], [done])).toThrow();
    expect(() => checkWorkChange('IN_PROGRESS', [action], [done])).not.toThrow();
    expect(() => checkWorkChange('IN_PROGRESS', [done], [action])).toThrow();
    expect(() =>
      checkWorkChange('IN_PROGRESS', [done], [{ ...done, completionEvidence: 'Different supporting evidence' }]),
    ).toThrow();
  });
  it('keeps terminal opportunities read-only', () => {
    expect(() => checkWorkChange('IMPLEMENTED', [action], [action])).toThrow();
    expect(() => checkWorkChange('REJECTED', [action], [action])).toThrow();
  });
});
