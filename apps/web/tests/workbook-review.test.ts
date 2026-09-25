import { expect, it } from 'vitest';
import { renderWorkbookReview, reviewComparison, assessWorkbookNumbers } from '../src/server/analysis/workbook-review';
import { workbookRegistry } from '../src/server/analysis/workbook-registry';
import { regressionFixtures } from '../src/server/analysis/fixture-readiness';

function report() {
  return {
    acceptance: 'BLOCKED',
    characterizations: [
      {
        fixtureId: 'multi',
        kind: 'CACHE_CHARACTERIZATION',
        approved: false,
        readyForCompatibilityAcceptance: false,
        nativeRecalculationPerformed: false,
        tolerancePolicy: null,
        source: { sha256: String(regressionFixtures[1].recordedSha256), sheet: 'Regression Analysis' },
        algorithm: 'synthetic-regression',
        reportingAlgorithm: 'synthetic-reporting',
        assumptions: 'Test | metadata',
        comparisons: [{ family: 'pValues', cell: 'F43', expected: 0, actual: 4e-14, absoluteDifference: 0 }],
        classifications: [{ cell: 'B66', expected: 'YES', actual: 'NO', matches: true }],
      },
    ],
  };
}
it('checks the approved absolute boundary without rounding or relative allowance', () => {
  expect(reviewComparison('coefficients', 0, 0.99).flags).toEqual([]);
  expect(reviewComparison('coefficients', 0, 0.9900001).flags).toContain('OUTSIDE_APPROVED_TOLERANCE');
  expect(reviewComparison('degreesOfFreedom', 9, 10).flags).toContain('OUTSIDE_APPROVED_TOLERANCE');
  expect(reviewComparison('coefficients', 100, 100).limit).toBe(0.99);
  expect(reviewComparison('coefficients', 1_000_000, 1_000_001).flags).toContain('OUTSIDE_APPROVED_TOLERANCE');
  expect(reviewComparison('pValues', 0, 0.5).limit).toBe(0.99);
});
it('flags meaningful changes even inside the approved tolerance and never defaults unknown families', () => {
  expect(reviewComparison('pValues', 0, 4e-14).flags).toEqual(['ZERO_NONZERO_PROBABILITY']);
  expect(reviewComparison('residuals', -1e-12, 1e-12).flags).toContain('SIGN_CHANGE');
  expect(reviewComparison('newFamily', 1, 1).flags).toEqual(['NO_APPROVED_TOLERANCE']);
  expect(reviewComparison('expected', null, 0).flags).toContain('UNAVAILABLE');
  expect(reviewComparison('expected', Infinity, 0).flags).toContain('UNAVAILABLE');
  expect(reviewComparison('expected', -Number.MAX_VALUE, Number.MAX_VALUE).flags).toContain('UNREPRESENTABLE');
});
it('recomputes numerical differences and classification changes and always retains the acceptance gate', () => {
  const markdown = renderWorkbookReview(report());
  expect(markdown).toContain('compatibility acceptance: BLOCKED');
  expect(markdown).toContain('ZERO_NONZERO_PROBABILITY');
  expect(markdown).toContain('4e-14');
  expect(markdown).toContain('CLASSIFICATION_CHANGE');
  expect(markdown).toContain('Missing characterization: Single');
  expect(markdown).toContain('Test \\| metadata');
  expect(markdown).toContain('NATIVE_RECALCULATION');
  const matching = report();
  matching.characterizations[0].comparisons[0].actual = 0;
  matching.characterizations[0].classifications[0].actual = 'YES';
  expect(renderWorkbookReview(matching)).toContain('compatibility acceptance: BLOCKED');
});
it('refuses fabricated approvals, wrong hashes, duplicate fixtures/cells, and malformed evidence', () => {
  for (const key of ['approved', 'readyForCompatibilityAcceptance', 'nativeRecalculationPerformed']) {
    const input = report();
    Object.assign(input.characterizations[0], { [key]: true });
    expect(() => renderWorkbookReview(input)).toThrow();
  }
  const changed = report();
  changed.characterizations[0].source.sha256 = 'changed';
  expect(() => renderWorkbookReview(changed)).toThrow('source hash');
  const duplicate = report();
  duplicate.characterizations.push(duplicate.characterizations[0]);
  expect(() => renderWorkbookReview(duplicate)).toThrow('Duplicate fixture');
  const cells = report();
  cells.characterizations[0].comparisons.push(cells.characterizations[0].comparisons[0]);
  expect(() => renderWorkbookReview(cells)).toThrow('Duplicate numerical');
  const invalid = report();
  invalid.characterizations[0].comparisons[0].actual = NaN;
  expect(() => renderWorkbookReview(invalid)).toThrow();
});

function comparisons() {
  return workbookRegistry.fixtures.map((fixture) => ({
    ...report().characterizations[0],
    fixtureId: fixture.id,
    source: { sha256: fixture.recordedSha256, sheet: 'Regression Analysis' },
    algorithm: 'ols-qr-experimental-v3',
    reportingAlgorithm: 'energy-reporting-experimental-v1',
    comparisons: fixture.numerical.map(({ family, cell }) => ({
      family,
      cell,
      expected: 1,
      actual: 1,
      absoluteDifference: 0,
    })),
    classifications: fixture.classifications.map((cell) => ({
      cell,
      expected: 'YES',
      actual: 'YES',
      matches: true,
    })),
  }));
}
it('requires all three complete fixtures and applies the approved absolute boundary', () => {
  const input = comparisons();
  expect(assessWorkbookNumbers(input).status).toBe('PASS');
  expect(assessWorkbookNumbers(input).policy.relative).toBe(0);
  input[0].comparisons[0].actual = 1.990001;
  expect(assessWorkbookNumbers(input).status).toBe('FAIL');
  expect(assessWorkbookNumbers(input.slice(1)).status).toBe('BLOCKED');
  input[0].comparisons.pop();
  expect(assessWorkbookNumbers(input).status).toBe('BLOCKED');
});
it('requires exact significance agreement while retaining probability advisories', () => {
  const input = comparisons();
  Object.assign(
    input[1].comparisons.find((c) => c.family === 'pValues' && c.cell === 'F43')!,
    { expected: 0, actual: 4.34e-14 },
  );
  const result = assessWorkbookNumbers(input);
  expect(result.status).toBe('PASS');
  expect(result.fixtures[1].advisories).toHaveLength(1);
  input[1].classifications[0].actual = 'NO';
  expect(assessWorkbookNumbers(input).status).toBe('FAIL');
});
it('refuses unknown algorithms, hashes and duplicate or missing comparison coverage', () => {
  const input = comparisons();
  input[0].algorithm = 'unknown';
  expect(() => assessWorkbookNumbers(input)).toThrow('algorithm');
  input[0].algorithm = 'ols-qr-experimental-v3';
  input[0].comparisons[1] = input[0].comparisons[0];
  expect(assessWorkbookNumbers(input).status).toBe('BLOCKED');
  expect(() => assessWorkbookNumbers([input[0], input[0]])).toThrow('Duplicate');
});

it('pins the exact workbook cells rather than accepting matching comparison counts', () => {
  expect(workbookRegistry.fixtures.map((f) => f.numerical.length)).toEqual([82, 91, 132]);
  const wrongCell = comparisons();
  wrongCell[0].comparisons[0].cell = 'Z999';
  expect(assessWorkbookNumbers(wrongCell).status).toBe('BLOCKED');
  const wrongFamily = comparisons();
  wrongFamily[0].comparisons[0].family = 'expected';
  expect(assessWorkbookNumbers(wrongFamily).status).toBe('BLOCKED');
  const wrongClass = comparisons();
  wrongClass[0].classifications[0].cell = 'Z999';
  expect(assessWorkbookNumbers(wrongClass).status).toBe('BLOCKED');
  const reordered = comparisons();
  reordered.reverse();
  for (const f of reordered) {
    f.comparisons.reverse();
    f.classifications.reverse();
  }
  expect(assessWorkbookNumbers(reordered).status).toBe('PASS');
});
