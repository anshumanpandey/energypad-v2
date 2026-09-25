import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { regressionFixtures } from './fixture-readiness';

const nonempty = z.string().trim().min(1).max(500);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reference = z.object({ file: nonempty, sha256: hash }).strict();
const address = z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,5}$/);
export const nativeEvidenceManifest = z
  .object({
    schemaVersion: z.literal(1),
    fixtures: z
      .array(
        z
          .object({
            fixtureId: z.enum(['single', 'multi', 'multi-nra']),
            original: reference,
            recalculated: reference.nullable(),
            excel: z
              .object({
                version: nonempty,
                build: nonempty,
                platform: z.enum(['Windows', 'macOS']),
                calculationMode: z.literal('automatic'),
                fullRebuildPerformed: z.literal(true),
                performedAt: z.iso.datetime({ offset: true }),
              })
              .strict()
              .nullable(),
            review: z
              .object({
                reviewer: nonempty,
                reviewedAt: z.iso.datetime({ offset: true }),
                evidence: reference,
                unchangedInputsConfirmed: z.literal(true),
              })
              .strict()
              .nullable(),
            perturbationChecks: z
              .array(
                z
                  .object({
                    sheet: z.literal('Regression Analysis'),
                    inputCell: address,
                    outputCell: address,
                    originalInput: z.number().finite(),
                    changedInput: z.number().finite(),
                    originalOutput: z.number().finite(),
                    changedOutput: z.number().finite(),
                    restoredOutput: z.number().finite(),
                    restorationAbsoluteTolerance: z.number().finite().nonnegative(),
                    originalInputRestored: z.literal(true),
                  })
                  .strict(),
              )
              .max(50),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();

// Bounded, read-only hashing. A successful hash check establishes file identity, not Excel execution.
async function inspectFile(base: string, ref: z.infer<typeof reference>) {
  try {
    const file = path.resolve(base, ref.file);
    const info = await stat(file);
    if (!info.isFile() || info.size > 20_000_000) return { status: 'INVALID_FILE', sha256: null };
    const digest = createHash('sha256');
    let bytes = 0;
    for await (const chunk of createReadStream(file)) {
      bytes += chunk.length;
      if (bytes > 20_000_000) return { status: 'INVALID_FILE', sha256: null };
      digest.update(chunk);
    }
    const sha256 = digest.digest('hex');
    return { status: sha256 === ref.sha256 ? 'MATCH' : 'HASH_MISMATCH', sha256 };
  } catch (error) {
    return {
      status: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'MISSING_FILE' : 'UNREADABLE_FILE',
      sha256: null,
    };
  }
}
export async function inspectNativeEvidence(input: unknown, base: string) {
  const manifest = nativeEvidenceManifest.parse(input);
  if (new Set(manifest.fixtures.map((f) => f.fixtureId)).size !== manifest.fixtures.length)
    throw Error('Duplicate fixture ID.');
  const fixtures = [];
  for (const expected of regressionFixtures) {
    const entry = manifest.fixtures.find((f) => f.fixtureId === expected.id);
    if (!entry) {
      fixtures.push({ fixtureId: expected.id, issues: ['MISSING_FIXTURE'] });
      continue;
    }
    const issues: string[] = [];
    if (entry.original.sha256 !== expected.recordedSha256) issues.push('UNRECOGNIZED_ORIGINAL_HASH');
    const original = await inspectFile(base, entry.original);
    if (original.status !== 'MATCH') issues.push(`ORIGINAL_${original.status}`);
    const recalculated = entry.recalculated ? await inspectFile(base, entry.recalculated) : null;
    if (!recalculated) issues.push('MISSING_RECALCULATED_FILE');
    else if (recalculated.status !== 'MATCH') issues.push(`RECALCULATED_${recalculated.status}`);
    if (entry.recalculated && path.resolve(base, entry.original.file) === path.resolve(base, entry.recalculated.file))
      issues.push('RECALCULATED_COPY_REQUIRED');
    if (!entry.excel) issues.push('MISSING_EXCEL_REBUILD_RECORD');
    const reviewEvidence = entry.review ? await inspectFile(base, entry.review.evidence) : null;
    if (!entry.review) issues.push('MISSING_REVIEW');
    else if (reviewEvidence?.status !== 'MATCH') issues.push(`REVIEW_${reviewEvidence?.status}`);
    if (entry.review && entry.excel && Date.parse(entry.review.reviewedAt) < Date.parse(entry.excel.performedAt))
      issues.push('REVIEW_PREDATES_REBUILD');
    if (!entry.perturbationChecks.length) issues.push('MISSING_PERTURBATION_CHECKS');
    for (const [index, check] of entry.perturbationChecks.entries()) {
      if (check.originalInput === check.changedInput || check.originalOutput === check.changedOutput)
        issues.push(`CHECK_${index + 1}_NO_OBSERVED_CHANGE`);
      if (Math.abs(check.restoredOutput - check.originalOutput) > check.restorationAbsoluteTolerance)
        issues.push(`CHECK_${index + 1}_RESTORATION_MISMATCH`);
    }
    fixtures.push({
      fixtureId: expected.id,
      original,
      recalculated,
      reviewEvidence,
      excel: entry.excel,
      review: entry.review,
      perturbationChecks: entry.perturbationChecks,
      issues,
    });
  }
  return {
    schemaVersion: 1,
    acceptance: 'BLOCKED',
    evidenceChecklistComplete: fixtures.every((f) => !f.issues.length),
    fixtures,
    remainingGates: [
      'Independent review of the native Excel evidence and unchanged input cells',
      'Approved expected outputs and methodological decisions',
      'Explicit per-family absolute/relative tolerances',
      'Approved golden registry and numerical acceptance suite',
    ],
    note: 'File hashes and supplied attestations only. This checker does not run Excel, prove recalculation, approve evidence, or change application compatibility status. A complete checklist is not compatibility acceptance.',
  };
}
