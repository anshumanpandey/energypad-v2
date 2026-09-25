import { z } from 'zod';
import { DomainError } from './policy';
import type { AnalyticsReport } from './analytics-report';
export const verificationInput = z
  .object({
    previousId: z.uuid().nullable(),
    eventId: z.uuid(),
    workVersionId: z.uuid(),
    runId: z.uuid(),
    carbonRunId: z.uuid().optional(),
    implementationDate: z.iso.date(),
    note: z.string().trim().min(10).max(4000),
    references: z.array(z.string().trim().min(3).max(500)).min(1).max(10),
    requestKey: z.uuid(),
  })
  .strict();
export function checkVerificationPeriod(
  source: AnalyticsReport,
  candidate: AnalyticsReport,
  implementationDate: string,
) {
  if (candidate.period.firstMonth <= source.period.lastMonth)
    throw new DomainError(
      'VERIFICATION_PERIOD',
      'Choose a reporting period entirely after the original investigation period.',
    );
  if (implementationDate >= `${candidate.period.firstMonth}-01`)
    throw new DomainError(
      'VERIFICATION_PERIOD',
      'The reporting period must start in a full month after implementation.',
    );
}
export function verificationEligibility(report: AnalyticsReport) {
  // Numerical workbook tolerance is not methodological approval. No production methodology
  // has passed that separate acceptance gate; a report label cannot grant approval.
  const issues = [
    {
      code: 'METHODOLOGY_UNAPPROVED',
      message: 'Methodological approval is still open. Experimental results cannot be marked as verified savings.',
    },
  ];
  if (report.status !== 'VALIDATED')
    issues.push({ code: 'UNVALIDATED_RESULT', message: 'The selected saved result is unvalidated.' });
  if (report.family !== 'savings' || report.summary.resultStatus !== 'CALCULATED' || report.summary.postKwh === null)
    issues.push({ code: 'INCOMPLETE_RESULT', message: 'Complete saved reporting results are required.' });
  return { policy: 'opportunity-verification-gate-v1', status: 'BLOCKED' as const, verifiedKwh: null, issues };
}
export function requireVerifiedEligibility(report: AnalyticsReport): never {
  const eligibility = verificationEligibility(report);
  throw new DomainError('VERIFICATION_BLOCKED', eligibility.issues.map((i) => i.message).join(' '), 409);
}

export const verificationOptionsInput = z
  .object({
    implementationDate: z.iso.date(),
    cursor: z.uuid().optional(),
    runId: z.uuid().optional(),
  })
  .strict();
export type VerificationOption = {
  id: string;
  label: string;
  eligible: boolean;
  reason: string | null;
};
export type VerificationOptions = {
  meter: string;
  baselineId: string;
  items: VerificationOption[];
  nextCursor: string | null;
};
