import { writeFile } from 'node:fs/promises';
import { inspectRegressionFixtures } from '../src/server/analysis/fixture-readiness';
const [directory, output, ...extra] = process.argv.slice(2);
try {
  if (!directory || extra.length) throw new Error('Usage');
  const report = await inspectRegressionFixtures(directory);
  const text = JSON.stringify(report, null, 2) + '\n';
  if (output) await writeFile(output, text, { mode: 0o600, flag: 'wx' });
  else process.stdout.write(text);
  process.exitCode = 2;
} catch {
  console.error(
    'Readiness check failed. Usage: npm run sprint4:readiness -- <fixture-directory> [new-report.json]. Check access and use a new output filename; existing reports are never overwritten.',
  );
  process.exitCode = 1;
}
