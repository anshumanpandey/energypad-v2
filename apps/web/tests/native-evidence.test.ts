import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/server/analysis/fixture-readiness', async () => {
  const { createHash } = await import('node:crypto');
  return {
    regressionFixtures: ['single', 'multi', 'multi-nra'].map((id) => ({
      id,
      recordedSha256: createHash('sha256').update('original').digest('hex'),
    })),
  };
});
import { inspectNativeEvidence } from '../src/server/analysis/native-evidence';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'native-evidence-test-'));
  directories.push(directory);
  const ref = async (file: string, value: string) => {
    await writeFile(path.join(directory, file), value);
    return { file, sha256: createHash('sha256').update(value).digest('hex') };
  };
  const original = await ref('original.xlsx', 'original');
  const recalculated = await ref('recalculated.xlsx', 'recalculated');
  const evidence = await ref('review.txt', 'Synthetic test attestation, not native Excel proof');
  return {
    directory,
    manifest: {
      schemaVersion: 1,
      fixtures: ['single', 'multi', 'multi-nra'].map((fixtureId) => ({
        fixtureId,
        original,
        recalculated,
        excel: {
          version: 'test',
          build: 'test',
          platform: 'Windows',
          calculationMode: 'automatic',
          fullRebuildPerformed: true,
          performedAt: '2026-09-24T10:00:00Z',
        },
        review: {
          reviewer: 'Test reviewer',
          reviewedAt: '2026-09-24T11:00:00Z',
          evidence,
          unchangedInputsConfirmed: true,
        },
        perturbationChecks: [
          {
            sheet: 'Regression Analysis',
            inputCell: 'B6',
            outputCell: 'B23',
            originalInput: 10,
            changedInput: 11,
            originalOutput: 20,
            changedOutput: 22,
            restoredOutput: 20,
            restorationAbsoluteTolerance: 0,
            originalInputRestored: true,
          },
        ],
      })),
    },
  };
}
it('lists missing evidence without fabricating approvals', async () => {
  const result = await inspectNativeEvidence({ schemaVersion: 1, fixtures: [] }, '.');
  expect(result.fixtures).toHaveLength(3);
  expect(result.fixtures.every((f) => f.issues.includes('MISSING_FIXTURE'))).toBe(true);
  expect(result.evidenceChecklistComplete).toBe(false);
  expect(result.acceptance).toBe('BLOCKED');
});
it('verifies hashes and attestation structure without equating completeness with acceptance', async () => {
  const { directory, manifest } = await fixture();
  const result = await inspectNativeEvidence(manifest, directory);
  expect(result.evidenceChecklistComplete).toBe(true);
  expect(result.acceptance).toBe('BLOCKED');
  expect(result.note).toContain('does not run Excel');
  expect(await readFile(path.join(directory, 'original.xlsx'), 'utf8')).toBe('original');
  await writeFile(path.join(directory, 'recalculated.xlsx'), 'changed');
  expect((await inspectNativeEvidence(manifest, directory)).fixtures[0].issues).toContain('RECALCULATED_HASH_MISMATCH');
  await rm(path.join(directory, 'review.txt'));
  expect((await inspectNativeEvidence(manifest, directory)).fixtures[0].issues).toContain('REVIEW_MISSING_FILE');
});
it('rejects incomplete or inconsistent records and unsafe restoration assumptions', async () => {
  const { directory, manifest } = await fixture();
  manifest.fixtures[0].original.sha256 = '0'.repeat(64);
  manifest.fixtures[0].recalculated = manifest.fixtures[0].original;
  manifest.fixtures[0].review.reviewedAt = '2026-09-23T11:00:00Z';
  manifest.fixtures[0].perturbationChecks[0].changedOutput = 20;
  manifest.fixtures[0].perturbationChecks[0].restoredOutput = 21;
  const issues = (await inspectNativeEvidence(manifest, directory)).fixtures[0].issues;
  for (const code of [
    'UNRECOGNIZED_ORIGINAL_HASH',
    'ORIGINAL_HASH_MISMATCH',
    'RECALCULATED_COPY_REQUIRED',
    'REVIEW_PREDATES_REBUILD',
    'CHECK_1_NO_OBSERVED_CHANGE',
    'CHECK_1_RESTORATION_MISMATCH',
  ])
    expect(issues).toContain(code);
});
it('rejects duplicate entries, alternative engines and invalid numeric evidence', async () => {
  const { directory, manifest } = await fixture();
  const duplicate = structuredClone(manifest);
  duplicate.fixtures[1] = duplicate.fixtures[0];
  await expect(inspectNativeEvidence(duplicate, directory)).rejects.toThrow('Duplicate fixture');
  manifest.fixtures[0].excel.platform = 'LibreOffice';
  await expect(inspectNativeEvidence(manifest, directory)).rejects.toThrow();
  manifest.fixtures[0].excel.platform = 'Windows';
  manifest.fixtures[0].perturbationChecks[0].changedInput = Infinity;
  await expect(inspectNativeEvidence(manifest, directory)).rejects.toThrow();
});
