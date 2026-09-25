import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderWorkbookReview } from '../src/server/analysis/workbook-review';

const [directory, output, ...extra] = process.argv.slice(2);
let temporary: string | undefined;
try {
  if (!directory || !output || extra.length)
    throw Error('Usage: npm run sprint4:review -- <fixture-directory> <new-review.md>');
  temporary = await mkdtemp(path.join(tmpdir(), 'energiepad-sprint4-review-'));
  const evidence = path.join(temporary, 'verification.json');
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(new URL('./sprint4-verify.ts', import.meta.url)), directory, evidence],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 1000000 },
  );
  if (result.error || result.status !== 2)
    throw Error('Fresh workbook characterization failed. Run sprint4:verify for details.');
  const markdown = renderWorkbookReview(JSON.parse(await readFile(evidence, 'utf8')));
  await writeFile(output, markdown, { flag: 'wx', mode: 0o600 });
  console.log(
    'Review written using approved absolute tolerance 0.99 and user-confirmed recalculation. Full methodology/coverage acceptance remains separate.',
  );
  process.exitCode = 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Review failed');
  process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
