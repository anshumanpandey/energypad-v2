import { describe, it, expect } from 'vitest';
import {
  checkVerificationPeriod,
  verificationEligibility,
  requireVerifiedEligibility,
  verificationInput,
  verificationOptionsInput,
} from '../src/domain/opportunity-verification';
import type { AnalyticsReport } from '../src/domain/analytics-report';
const id = 'b2ccdcb4-255e-484b-81a4-287aa7b2f618';
const report: AnalyticsReport = {
  reportVersion: 'analytics-report-v1',
  family: 'savings',
  organisationId: id,
  siteId: id,
  period: { firstMonth: '2021-01', lastMonth: '2021-02' },
  status: 'UNVALIDATED',
  note: '',
  units: { postKwh: 'kWh' },
  summary: { resultStatus: 'CALCULATED', postKwh: '0' },
  rows: [],
  evidence: {},
};
describe('verification evidence gates', () => {
  it('validates picker dates and scoped cursors without accepting caller-defined scope', () => {
    const query = { implementationDate: '2020-12-31', runId: id, cursor: id };
    expect(verificationOptionsInput.safeParse(query).success).toBe(true);
    for (const extra of [{ implementationDate: '2020-02-30' }, { cursor: 'bad' }, { siteId: id }, { baselineId: id }])
      expect(verificationOptionsInput.safeParse({ ...query, ...extra }).success).toBe(false);
  });
  it('requires dated, scoped evidence with references', () => {
    const input = {
      previousId: null,
      eventId: id,
      workVersionId: id,
      runId: id,
      implementationDate: '2020-12-31',
      note: 'Installation completed with references',
      references: ['Work order 42'],
      requestKey: id,
    };
    expect(verificationInput.safeParse(input).success).toBe(true);
    expect(verificationInput.safeParse({ ...input, implementationDate: '2020-02-30' }).success).toBe(false);
    expect(verificationInput.safeParse({ ...input, references: [] }).success).toBe(false);
    expect(verificationInput.safeParse({ ...input, verifiedKwh: '100' }).success).toBe(false);
  });
  it('requires full months after implementation and no overlap with detection', () => {
    const source = { ...report, period: { firstMonth: '2020-05', lastMonth: '2020-06' } };
    expect(() => checkVerificationPeriod(source, report, '2020-12-31')).not.toThrow();
    expect(() => checkVerificationPeriod(source, report, '2021-01-01')).toThrow();
    expect(() => checkVerificationPeriod(report, report, '2020-12-31')).toThrow();
  });
  it('never turns experimental, zero or negative variance into verified savings', () => {
    for (const postKwh of ['0', '-1', '100']) {
      const result = verificationEligibility({ ...report, summary: { ...report.summary, postKwh } });
      expect(result.status).toBe('BLOCKED');
      expect(result.verifiedKwh).toBeNull();
      expect(() => requireVerifiedEligibility(report)).toThrow();
    }
  });
  it('does not treat a forged compatibility label or numeric tolerance as methodology approval', () => {
    const result = verificationEligibility({
      ...report,
      status: 'VALIDATED',
      summary: { ...report.summary, tolerance: '0.99' },
    });
    expect(result.issues.some((i) => i.code === 'METHODOLOGY_UNAPPROVED')).toBe(true);
  });
  it('adds explicit incomplete-result blockers', () => {
    expect(
      verificationEligibility({ ...report, summary: { resultStatus: 'INCOMPLETE', postKwh: null } }).issues.some(
        (i) => i.code === 'INCOMPLETE_RESULT',
      ),
    ).toBe(true);
  });
});
