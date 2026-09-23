import { expect, it } from 'vitest';
import { characterizeNra } from '../src/server/analysis/nra-characterization';
import { regressionFixtures } from '../src/server/analysis/fixture-readiness';
// Synthetic parser/comparator fixture; the CLI separately verifies original workbook bytes.
function evidence() {
  const cells: Record<string, { type: string; storedValue: string | null; resolvedValue: string }> = {};
  const put = (a: string, value: number | string) => {
    cells[a] = {
      type: typeof value === 'number' ? 'n' : 'str',
      storedValue: String(value),
      resolvedValue: String(value),
    };
  };
  for (const [i, c] of [...'BCDEFGHIJKLM'].entries()) {
    const h = 10 + Math.floor(i / 4),
      cool = 20 + (i % 4 < 2 ? -1 : 1),
      day = 30 + (i % 2 ? -1 : 1);
    const actual = 100 + 2 * h + 3 * cool + 4 * day + (cool - 20) * (day - 30) * 0.5;
    for (const [r, v] of [
      [6, h],
      [7, cool],
      [8, day],
      [9, actual],
      [58, h],
      [59, cool],
      [60, day],
      [61, actual],
      [71, 8],
      [72, 8],
      [76, 100],
      [77, 100],
    ])
      put(`${c}${r}`, v);
    for (const r of [35, 36, 37, 63, 65, 81, 82, 84, 91]) put(`${c}${r}`, 0);
    put(`${c}95`, 'NO');
  }
  for (const a of ['A29', 'B29', 'C29', 'D29', 'A41', 'D41', 'G41', 'A44']) put(a, 0);
  for (const r of [49, 50, 51, 52]) for (const c of 'CDEF') put(`${c}${r}`, 0);
  return {
    schemaVersion: 1,
    extractor: 'nra-source-evidence-v1',
    approved: false,
    nativeRecalculationPerformed: false,
    source: { sha256: regressionFixtures[2].recordedSha256, sheet: 'Regression Analysis' },
    sections: { synthetic: { cells } },
  };
}
it('compares each mapped result family while always preserving unapproved status', () => {
  const report = characterizeNra(evidence());
  expect(report.comparisons).toHaveLength(132);
  expect(report.classifications).toHaveLength(12);
  expect(report.families).toHaveLength(18);
  expect(report.approved).toBe(false);
  expect(report.readyForCompatibilityAcceptance).toBe(false);
  expect(report.tolerancePolicy).toBeNull();
  expect(report.comparisons.find((c) => c.cell === 'A29')!.actual).toBeCloseTo(100, 9);
});
it('compares independent caches instead of using them to compute the model', () => {
  const input = evidence(),
    original = characterizeNra(input);
  input.sections.synthetic.cells.A29.storedValue = '999';
  input.sections.synthetic.cells.B95.resolvedValue = 'YES';
  const changed = characterizeNra(input);
  const before = original.comparisons.find((c) => c.cell === 'A29')!,
    after = changed.comparisons.find((c) => c.cell === 'A29')!;
  expect(after.actual).toBe(before.actual);
  expect(after.expected).toBe(999);
  expect(after.absoluteDifference).toBeGreaterThan(800);
  expect(changed.classifications[0].matches).toBe(false);
});
it('rejects missing/blank/nonfinite numeric evidence rather than manufacturing zero', () => {
  for (const bad of [null, '', ' ', 'NaN', 'Infinity']) {
    const input = evidence();
    input.sections.synthetic.cells.B6.storedValue = bad;
    expect(() => characterizeNra(input)).toThrow();
  }
  const missing = evidence();
  delete missing.sections.synthetic.cells.F49;
  expect(() => characterizeNra(missing)).toThrow();
});
it('rejects mismatched provenance or invented approval/recalculation claims', () => {
  const input = evidence();
  expect(() => characterizeNra({ ...input, source: { ...input.source, sha256: '0'.repeat(64) } })).toThrow();
  expect(() => characterizeNra({ ...input, approved: true })).toThrow();
  expect(() => characterizeNra({ ...input, nativeRecalculationPerformed: true })).toThrow();
});
