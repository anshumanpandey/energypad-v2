import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

export const regressionFixtures = [
  {
    id: 'single',
    file: 'Single Routine Adjustment V2.xlsx',
    recordedSha256: '40dfaa6aaaeed910fa49552bab2d9ef629adf91b6982796372cf8f941e7821cd',
  },
  {
    id: 'multi',
    file: 'Multi Routine Adjustment V2.xlsx',
    recordedSha256: '96d03f58b3caf94429f86b257ddb316cb4f3bf96f4e11cf8c3bbaf7a4c2a77cb',
  },
  {
    id: 'multi-nra',
    file: 'Multi Routine Adjustment Plus NRA V2.xlsx',
    recordedSha256: '427df495d5858f091616ea3709125a305a2d7212ac6ce8ac5b54c9100f53caed',
  },
] as const;

// Presence and integrity are discovery evidence, never methodology approval.
// Keep review dependencies explicit until reviewed fixtures/results replace them.
export const calculationReviewDependencies = [
  { code: 'EXPECTED_RESULTS', detail: 'Record reviewed expected cells/results and provenance for all three fixtures.' },
  {
    code: 'NATIVE_RECALCULATION',
    detail:
      'Record native recalculation evidence for the reference workbooks. CD11 shifting-range claim was withdrawn after direct XML inspection; the NRA source still requires result/methodology review.',
  },
  { code: 'TOLERANCES', detail: 'Record approved absolute/relative tolerances for each numerical result family.' },
  {
    code: 'CALCULATION_POLICIES',
    detail:
      'Resolve Sprint 4 decisions CD01–05, CD09–15, including boundaries and undefined numerical cases. CD06 is weather; CD07–08 are Sprint 5.',
  },
] as const;

export async function inspectRegressionFixtures(directory: string) {
  const fixtures = await Promise.all(
    regressionFixtures.map(async (fixture) => {
      const file = path.join(directory, fixture.file);
      let bytes = 0;
      let sha256: string | null = null;
      let status: 'missing' | 'unreadable' | 'not-file' | 'too-large' | 'changed' | 'recorded' | 'unreviewed' =
        'missing';
      try {
        const info = await stat(file);
        if (!info.isFile()) status = 'not-file';
        else if (info.size > 20_000_000) status = 'too-large';
        else {
          const digest = createHash('sha256');
          // Stream with a cap as the source may grow after stat. Never parse or resave originals.
          for await (const chunk of createReadStream(file)) {
            bytes += chunk.length;
            if (bytes > 20_000_000) {
              status = 'too-large';
              break;
            }
            digest.update(chunk);
          }
          if (status !== 'too-large') {
            sha256 = digest.digest('hex');
            status =
              fixture.recordedSha256 === null
                ? 'unreviewed'
                : sha256 === fixture.recordedSha256
                  ? 'recorded'
                  : 'changed';
          }
        }
      } catch (error) {
        status = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unreadable';
      }
      return { ...fixture, status, bytes, sha256, approved: false as const };
    }),
  );
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    readyForCompatibilityAcceptance: false as const,
    fixtures,
    reviewDependencies: calculationReviewDependencies,
    note: 'Read-only file availability/integrity report. Recorded hashes are discovery evidence, not approved fixtures. No calculations or workbook recalculation were performed.',
  };
}
