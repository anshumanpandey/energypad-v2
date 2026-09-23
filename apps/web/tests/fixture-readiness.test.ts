import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { inspectRegressionFixtures, regressionFixtures } from '../src/server/analysis/fixture-readiness';
it('reports missing fixtures without implying approval or acceptance', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fixture-readiness-'));
  try {
    const report = await inspectRegressionFixtures(directory);
    expect(report.fixtures.map((f) => f.status)).toEqual(['missing', 'missing', 'missing']);
    expect(report.readyForCompatibilityAcceptance).toBe(false);
    expect(report.reviewDependencies.map((d) => d.code)).toContain('NATIVE_RECALCULATION');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it('hashes files unchanged, flags altered evidence and never mistakes file presence for a valid golden workbook', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fixture-readiness-'));
  try {
    const bytes = Buffer.from('synthetic bytes, deliberately not an approved workbook');
    for (const fixture of regressionFixtures) await writeFile(path.join(directory, fixture.file), bytes);
    const report = await inspectRegressionFixtures(directory);
    expect(report.fixtures.map((f) => f.status)).toEqual(['changed', 'changed', 'changed']);
    for (const fixture of report.fixtures) {
      expect(fixture.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(fixture.approved).toBe(false);
      expect(await readFile(path.join(directory, fixture.file))).toEqual(bytes);
    }
    expect(report.readyForCompatibilityAcceptance).toBe(false);
    await rm(path.join(directory, regressionFixtures[0].file));
    await mkdir(path.join(directory, regressionFixtures[0].file));
    expect((await inspectRegressionFixtures(directory)).fixtures[0].status).toBe('not-file');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
