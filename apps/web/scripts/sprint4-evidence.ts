import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectNativeEvidence } from '../src/server/analysis/native-evidence';

const [manifest, output, ...extra] = process.argv.slice(2);
try {
  if (!manifest || !output || extra.length)
    throw Error('Usage: npm run sprint4:evidence -- <manifest.json> <new-report.json>');
  if ((await stat(manifest)).size > 1_000_000) throw Error('Manifest exceeds 1 MB.');
  const report = await inspectNativeEvidence(
    JSON.parse(await readFile(manifest, 'utf8')),
    path.dirname(path.resolve(manifest)),
  );
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(
    `Evidence checklist ${report.evidenceChecklistComplete ? 'complete' : 'incomplete'}; compatibility acceptance remains blocked.`,
  );
  process.exitCode = 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Evidence inspection failed');
  process.exitCode = 1;
}
