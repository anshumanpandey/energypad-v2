import { describe, it, expect } from 'vitest';
import { supportingEvidenceInput } from '../src/domain/opportunity-supporting';
const id = '10000000-0000-4000-8000-000000000001';
const common = {
  previousId: null,
  eventId: id,
  workVersionId: null,
  actionId: null,
  note: 'Evidence reviewed against the original source.',
  requestKey: id,
};
const programme = {
  ...common,
  kind: 'PROGRAMME',
  energyUseId: id,
  source: 'Original review',
  title: 'Heating checklist',
  question: 'Is the timer correct?',
  answers: ['Yes', 'Checked against occupancy'],
};
describe('supporting evidence contracts', () => {
  it('requires explicit scoped log revisions and rejects client snapshots', () => {
    expect(supportingEvidenceInput.safeParse({ ...common, kind: 'LOG', operationalEventId: id }).success).toBe(true);
    expect(
      supportingEvidenceInput.safeParse({
        ...common,
        kind: 'LOG',
        operationalEventId: id,
        snapshot: { verified: true },
      }).success,
    ).toBe(false);
  });
  it('preserves multiple programme answers with source and end use', () => {
    expect(supportingEvidenceInput.parse(programme)).toMatchObject({ answers: programme.answers });
    for (const change of [{ answers: [] }, { source: '' }, { energyUseId: '' }, { answers: Array(21).fill('yes') }])
      expect(supportingEvidenceInput.safeParse({ ...programme, ...change }).success).toBe(false);
  });
  it('requires complete legacy identity and a saved plan for action links', () => {
    expect(supportingEvidenceInput.safeParse({ ...programme, legacyId: '12' }).success).toBe(false);
    expect(
      supportingEvidenceInput.safeParse({ ...programme, legacyId: '12', legacySource: 'legacy/programmes' }).success,
    ).toBe(true);
    expect(supportingEvidenceInput.safeParse({ ...programme, actionId: id }).success).toBe(false);
  });
  it('requires tip month and provenance, with no measured-saving inputs', () => {
    const tip = {
      ...common,
      kind: 'TIP',
      energyUseId: id,
      source: 'Facilities guide',
      category: 'Heating',
      text: 'Review timer settings',
      month: '2026-09',
    };
    expect(supportingEvidenceInput.safeParse(tip).success).toBe(true);
    expect(supportingEvidenceInput.safeParse({ ...tip, month: '2026-13' }).success).toBe(false);
    expect(supportingEvidenceInput.safeParse({ ...tip, verifiedKwh: 100 }).success).toBe(false);
  });
});
