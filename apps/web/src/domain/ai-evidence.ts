import { z } from 'zod';
import type { AnalyticsReport } from './analytics-report';
import { DomainError } from './policy';
export const aiEvidenceInput = z
  .object({
    tool: z.enum(['saved_baseline', 'saved_savings', 'saved_opportunity']),
    resourceId: z.uuid(),
    question: z.string().trim().min(5).max(2000),
    requestKey: z.uuid(),
  })
  .strict();
export type EvidenceTool = z.infer<typeof aiEvidenceInput>['tool'];
export type EvidenceFact = {
  id: string;
  label: string;
  value: string | number | null;
  unit: string | null;
  citationId: string;
};
export type EvidenceCitation = {
  id: string;
  tool: EvidenceTool;
  resourceId: string;
  fingerprint: string;
  period: { firstMonth: string; lastMonth: string };
  status: string;
};
export type EvidencePreview = {
  version: 'ai-evidence-v1';
  mode: 'EVIDENCE_PREVIEW';
  sourceSnapshot?: AnalyticsReport;
  facts: EvidenceFact[];
  citations: EvidenceCitation[];
  limitations: string[];
  usage: { provider: null; model: null; inputTokens: 0; outputTokens: 0; providerCalls: 0; toolCalls: 1 };
};
export function evidencePreview(
  report: AnalyticsReport,
  tool: EvidenceTool,
  resourceId: string,
  fingerprint: string,
): EvidencePreview {
  const savings = tool === 'saved_savings';
  const opportunity = tool === 'saved_opportunity';
  if (
    report.family !== (opportunity ? 'opportunity' : savings ? 'savings' : 'baseline') ||
    report.summary[opportunity ? 'opportunityId' : savings ? 'runId' : 'baselineId'] !== resourceId
  )
    throw new DomainError('EVIDENCE_SCOPE', 'The saved evidence does not match the selected tool.');
  const specs = opportunity
    ? [
        ['stage', 'Investigation stage', null],
        ['actionCount', 'Saved actions', 'actions'],
        ['completedActionCount', 'Completed actions', 'actions'],
        ['supportingRecordCount', 'Current supporting records', 'records'],
        ['verificationRevisionCount', 'Verification submissions', 'revisions'],
        ['verifiedKwh', 'Verified savings', 'kWh'],
      ]
    : savings
      ? [
          ['preKwh', 'Energy variance before NRA', 'kWh'],
          ['postKwh', 'Energy variance after NRA', 'kWh'],
          ['preCost', 'Estimated cost variance before NRA', String(report.summary.currency ?? 'Unavailable')],
          ['postCost', 'Estimated cost variance after NRA', String(report.summary.currency ?? 'Unavailable')],
          ['preCarbon', 'Estimated carbon variance before NRA', 'kgCO2e'],
          ['postCarbon', 'Estimated carbon variance after NRA', 'kgCO2e'],
        ]
      : [
          ['sampleSize', 'Baseline sample size', 'observations'],
          ['rSquared', 'Baseline R squared', null],
          ['residualStandardError', 'Residual standard error', 'kWh'],
        ];
  const facts: EvidenceFact[] = specs.map(([key, label, unit]) => {
    const value = report.summary[key!];
    if (
      (value !== null && typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      throw new DomainError('EVIDENCE_VALUE', 'A stored result has an unsupported value.');
    return { id: key!, label: label!, value, unit, citationId: 'source-1' };
  });
  return {
    ...(opportunity ? { sourceSnapshot: report } : {}),
    version: 'ai-evidence-v1',
    mode: 'EVIDENCE_PREVIEW',
    facts,
    citations: [{ id: 'source-1', tool, resourceId, fingerprint, period: report.period, status: report.status }],
    limitations: [
      'This is a deterministic evidence preview. No AI answer has been generated.',
      report.note,
      'Verified savings remain unavailable pending methodological approval.',
      'Only the explicitly selected saved result is included. Missing values remain unavailable.',
    ],
    usage: { provider: null, model: null, inputTokens: 0, outputTokens: 0, providerCalls: 0, toolCalls: 1 },
  };
}
// A future model may select facts, but cannot supply values, SQL, URLs or citation targets.
export function resolveEvidenceSelection(input: unknown, preview: EvidencePreview) {
  const selection = z
    .object({ factIds: z.array(z.string()).min(1).max(20) })
    .strict()
    .parse(input);
  if (new Set(selection.factIds).size !== selection.factIds.length)
    throw new DomainError('CITATION_INVALID', 'Duplicate fact selections are not allowed.');
  return selection.factIds.map((id) => {
    const fact = preview.facts.find((f) => f.id === id);
    if (!fact || !preview.citations.some((c) => c.id === fact.citationId))
      throw new DomainError('CITATION_INVALID', 'Every selected fact must have a supplied evidence citation.');
    return fact;
  });
}
