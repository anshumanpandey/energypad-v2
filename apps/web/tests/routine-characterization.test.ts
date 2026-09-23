import { expect, it } from 'vitest';
import { characterizeRoutine } from '../src/server/analysis/routine-characterization';
import { regressionFixtures } from '../src/server/analysis/fixture-readiness';

// Independent balanced design: intercept 100, slopes 2 and (multi only) 3,
// orthogonal ±0.5 residuals. Synthetic caches are deliberately unrelated zeros.
function evidence(single: boolean) {
  const cells: Record<string, { type: string; storedValue: string | null; resolvedValue: string }> = {};
  const put = (a: string, value: number | string) => {
    cells[a] = {
      type: typeof value === 'number' ? 'n' : 'str',
      storedValue: String(value),
      resolvedValue: String(value),
    };
  };
  for (const [i, c] of [...'BCDEFGHIJKLM'].entries()) {
    const hdd = 10 + Math.floor(i / 4),
      cdd = 20 + (i % 4 < 2 ? -1 : 1);
    const y = 100 + 2 * hdd + (single ? 0 : 3 * cdd) + (i % 2 ? 0.5 : -0.5);
    put(`${c}6`, hdd);
    if (!single) put(`${c}7`, cdd);
    put(`${c}${single ? 7 : 8}`, y);
    put(`${c}${single ? 46 : 49}`, hdd);
    if (!single) put(`${c}50`, cdd);
    put(`${c}${single ? 47 : 51}`, y);
    for (const row of single ? [23, 24, 25, 49, 51, 58] : [27, 28, 29, 53, 55, 62]) put(`${c}${row}`, 0);
    put(`${c}${single ? 62 : 66}`, 'NO');
  }
  for (const address of single
    ? ['L17', 'J17', 'A29', 'D29', 'G29', 'A32', 'C39', 'E39', 'G39', 'I39']
    : [
        'J21',
        'K21',
        'L21',
        'A33',
        'D33',
        'G33',
        'A36',
        ...[41, 42, 43].flatMap((r) => [...'CDEF'].map((c) => `${c}${r}`)),
      ])
    put(address, 0);
  return {
    schemaVersion: 1,
    extractor: 'routine-source-evidence-v1',
    approved: false,
    nativeRecalculationPerformed: false,
    source: { sha256: regressionFixtures[single ? 0 : 1].recordedSha256, sheet: 'Regression Analysis' },
    sections: { synthetic: { cells } },
  };
}

it.each([true, false])(
  'independently computes the %s single-driver layout without interpreting cache agreement as approval',
  (single) => {
    const input = evidence(single),
      result = characterizeRoutine(input);
    expect(result.comparisons).toHaveLength(single ? 82 : 91);
    expect(result.classifications.every((c) => c.matches)).toBe(true);
    expect(result.comparisons.find((c) => c.cell === (single ? 'L17' : 'J21'))!.actual).toBeCloseTo(100, 9);
    expect(result.comparisons.find((c) => c.cell === (single ? 'J17' : 'K21'))!.actual).toBeCloseTo(2, 9);
    if (!single) expect(result.comparisons.find((c) => c.cell === 'L21')!.actual).toBeCloseTo(3, 9);
    expect(result.approved).toBe(false);
    expect(result.readyForCompatibilityAcceptance).toBe(false);
    expect(result.tolerancePolicy).toBeNull();
    expect(result.coverageGaps).toHaveLength(single ? 1 : 0);
    const address = single ? 'L17' : 'J21';
    input.sections.synthetic.cells[address].storedValue = '999';
    input.sections.synthetic.cells[single ? 'B62' : 'B66'].resolvedValue = 'YES';
    const changed = characterizeRoutine(input);
    expect(changed.comparisons.find((c) => c.cell === address)!.actual).toBeCloseTo(100, 9);
    expect(changed.comparisons.find((c) => c.cell === address)!.expected).toBe(999);
    expect(changed.classifications[0].matches).toBe(false);
  },
);

it.each([true, false])('rejects missing/nonfinite evidence and false provenance for layout %s', (single) => {
  for (const bad of [null, '', ' ', 'NaN', 'Infinity']) {
    const input = evidence(single);
    input.sections.synthetic.cells.B6.storedValue = bad;
    expect(() => characterizeRoutine(input)).toThrow();
  }
  const input = evidence(single);
  expect(() => characterizeRoutine({ ...input, approved: true })).toThrow();
  expect(() => characterizeRoutine({ ...input, nativeRecalculationPerformed: true })).toThrow();
  expect(() => characterizeRoutine({ ...input, source: { ...input.source, sha256: 'bad' } })).toThrow();
  delete input.sections.synthetic.cells[single ? 'I39' : 'F43'];
  expect(() => characterizeRoutine(input)).toThrow();
});
