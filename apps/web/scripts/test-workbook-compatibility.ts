import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assessWorkbookNumbers } from '../src/server/analysis/workbook-review';

const [directory, output, ...extra] = process.argv.slice(2);
let temporary: string | undefined;
try {
  if (!directory || !output || extra.length)
    throw Error('Usage: npm run test:compatibility -- <workbook-directory> <new-report.json>');
  temporary = await mkdtemp(path.join(tmpdir(), 'energiepad-compatibility-test-'));
  const evidence = path.join(temporary, 'evidence.json');
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(new URL('./sprint4-verify.ts', import.meta.url)), directory, evidence],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 1000000 },
  );
  if (result.error || result.status !== 2)
    throw Error('Fresh source verification failed. Run sprint4:verify for details.');
  const source = JSON.parse(await readFile(evidence, 'utf8'));
  const numerical = assessWorkbookNumbers(source.characterizations);
  const report = {
    schemaVersion: 1,
    scope: 'WORKBOOK_NUMERICAL_COMPATIBILITY',
    checkedAt: source.checkedAt,
    sourceFiles: source.fixtures,
    ...numerical,
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  for (const fixture of report.fixtures) console.log(`${fixture.fixtureId}: ${fixture.status}`);
  console.log(
    `Workbook numerical compatibility: ${report.status}. Absolute tolerance 0.99; significance decisions must match exactly.`,
  );
  console.log(
    'Scope: registered workbook cells only. This does not relabel application snapshots or approve broader methodology/coverage.',
  );
  process.exitCode = report.status === 'PASS' ? 0 : report.status === 'FAIL' ? 1 : 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Compatibility test failed');
  process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
