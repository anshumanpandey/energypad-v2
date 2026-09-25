import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inspectRegressionFixtures, regressionFixtures } from '../src/server/analysis/fixture-readiness';
import { characterizeNra } from '../src/server/analysis/nra-characterization';
import { characterizeRoutine } from '../src/server/analysis/routine-characterization';
import { assessWorkbookNumbers } from '../src/server/analysis/workbook-review';
const [directory, output, ...extra] = process.argv.slice(2);
let temporary: string | undefined;
try {
  if (!directory || !output || extra.length) throw Error('Usage');
  const readiness = await inspectRegressionFixtures(directory);
  const characterizations = [];
  temporary = await mkdtemp(path.join(tmpdir(), 'energiepad-workbook-review-'));
  for (const fixture of readiness.fixtures) {
    if (fixture.status !== 'recorded') continue;
    const nra = fixture.id === 'multi-nra';
    const evidence = path.join(temporary, `${fixture.id}.json`);
    execFileSync(
      process.env.SPRINT4_PYTHON ?? 'python3',
      [
        fileURLToPath(
          new URL(
            nra ? '../../../scripts/extract_nra_evidence.py' : '../../../scripts/extract_routine_evidence.py',
            import.meta.url,
          ),
        ),
        path.join(directory, fixture.file),
        evidence,
      ],
      { stdio: 'pipe', timeout: 30000, maxBuffer: 1000000 },
    );
    const input = JSON.parse(await readFile(evidence, 'utf8'));
    characterizations.push({ fixtureId: fixture.id, ...(nra ? characterizeNra(input) : characterizeRoutine(input)) });
  }
  const report = {
    ...readiness,
    characterizations,
    numericalVerification: assessWorkbookNumbers(characterizations),
    acceptance: 'BLOCKED',
    note: 'User-approved absolute tolerance 0.99 with no relative allowance. User confirmed full recalculation of all three workbooks; the checker reads their saved results without independently observing Excel. Full compatibility acceptance remains separate from numerical agreement and pending methodology/coverage decisions.',
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(
    `Numerical comparison ${report.numericalVerification.status}; full compatibility acceptance remains blocked. Characterized ${characterizations.length}/${regressionFixtures.length} references; ${characterizations.reduce((n, c) => n + c.comparisons.length, 0)} numeric comparisons. Report written without changing originals.`,
  );
  process.exitCode = 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unknown verification failure');
  console.error(
    'Verification failed. Use: npm run sprint4:verify -- <fixture-directory> <new-report.json>. Check source integrity, Python availability and a new output filename.',
  );
  process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
