import { z } from 'zod';
import { calculationReviewDependencies, regressionFixtures } from './fixture-readiness';
import { compatibilityPolicy } from './compatibility-policy';
import { workbookRegistry } from './workbook-registry';

// Known result families covered by the user-approved absolute tolerance.
const standardFamilies = new Set([
  'coefficients',
  'fitted',
  'residuals',
  'squaredResiduals',
  'ssResidual',
  'ssTotal',
  'regressionSE',
  'coefficientSE',
  'tStatistics',
  'expected',
  'variance',
  'nraFactor',
  'adjustedExpected',
  'preNraVariance',
  'postNraVariance',
  'significanceThreshold',
]);
export function reviewComparison(family: string, expected: number | null, actual: number | null) {
  const tolerance =
    standardFamilies.has(family) || ['degreesOfFreedom', 'rSquared', 'pValues'].includes(family)
      ? { absolute: compatibilityPolicy.absolute, relative: compatibilityPolicy.relative }
      : null;
  const flags: string[] = [];
  if (!tolerance) flags.push('NO_APPROVED_TOLERANCE');
  if (expected === null || actual === null || !Number.isFinite(expected) || !Number.isFinite(actual))
    return { tolerance, difference: null, limit: null, flags: [...flags, 'UNAVAILABLE'] };
  const difference = Math.abs(actual - expected);
  const limit = tolerance ? tolerance.absolute + tolerance.relative * Math.abs(expected) : null;
  if (!Number.isFinite(difference) || (limit !== null && !Number.isFinite(limit))) flags.push('UNREPRESENTABLE');
  else if (limit !== null && difference > limit) flags.push('OUTSIDE_APPROVED_TOLERANCE');
  if (expected !== 0 && actual !== 0 && Math.sign(expected) !== Math.sign(actual)) flags.push('SIGN_CHANGE');
  if (family === 'pValues' && (expected === 0) !== (actual === 0)) flags.push('ZERO_NONZERO_PROBABILITY');
  return { tolerance, difference, limit, flags };
}
const cell = z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,5}$/);
const characterization = z.object({
  fixtureId: z.enum(['single', 'multi', 'multi-nra']),
  kind: z.literal('CACHE_CHARACTERIZATION'),
  approved: z.literal(false),
  readyForCompatibilityAcceptance: z.literal(false),
  nativeRecalculationPerformed: z.literal(false),
  tolerancePolicy: z.null(),
  source: z.object({ sha256: z.string(), sheet: z.literal('Regression Analysis') }),
  algorithm: z.string(),
  reportingAlgorithm: z.string(),
  assumptions: z.string(),
  coverageGaps: z.array(z.string()).default([]),
  comparisons: z
    .array(
      z.object({
        family: z.string(),
        cell,
        expected: z.number().finite().nullable(),
        actual: z.number().finite().nullable(),
      }),
    )
    .max(1000),
  classifications: z
    .array(z.object({ cell, expected: z.enum(['YES', 'NO']), actual: z.enum(['YES', 'NO']) }))
    .max(1000),
});
const escape = (text: string) => text.replace(/[\\`*_{}\[\]<>|]/g, (c) => `\\${c}`).replace(/[\r\n]+/g, ' ');
const number = (value: number | null) => (value === null ? 'unavailable' : String(value));
export function renderWorkbookReview(input: unknown) {
  const report = z
    .object({ acceptance: z.literal('BLOCKED'), characterizations: z.array(characterization).max(3) })
    .parse(input);
  const seen = new Set<string>();
  const lines = [
    '# Sprint 4 workbook compatibility review',
    '',
    '**Full compatibility acceptance: BLOCKED pending methodology/coverage review. Numerical comparisons use the user-approved absolute tolerance of 0.99 (relative tolerance 0).**',
    '',
    'Rule: abs(engine − saved result) ≤ 0.99, inclusive, without rounding. Differences are recomputed from values. Sign and zero/nonzero probability flags remain visible separately from numerical tolerance results.',
    '',
    'The user confirmed that all three supplied workbooks were fully recalculated. This is a recorded user attestation, not an Excel operation independently observed by the checker. Comparisons use saved results from the hash-pinned files. Units, periods, driver order, p-value boundaries and R² labels still need approval. Covariance and undefined/edge cases require supplemental acceptance fixtures.',
    '',
  ];
  for (const item of report.characterizations) {
    const fixture = regressionFixtures.find((f) => f.id === item.fixtureId)!;
    if (seen.has(item.fixtureId) || item.source.sha256 !== fixture.recordedSha256)
      throw Error('Duplicate fixture or unrecognized source hash.');
    seen.add(item.fixtureId);
    const numericKeys = item.comparisons.map((c) => `${c.family}:${c.cell}`);
    if (new Set(numericKeys).size !== numericKeys.length) throw Error('Duplicate numerical comparison.');
    lines.push(
      `## ${fixture.file}`,
      '',
      `Source SHA-256: \`${fixture.recordedSha256}\``,
      '',
      `Algorithms: ${escape(item.algorithm)} / ${escape(item.reportingAlgorithm)}.`,
      '',
      escape(item.assumptions),
      '',
    );
    for (const gap of item.coverageGaps) lines.push(`Coverage gap: ${escape(gap)}`, '');
    const reviews = item.comparisons.map((c) => ({ ...c, review: reviewComparison(c.family, c.expected, c.actual) }));
    const classificationChanges = item.classifications.filter((c) => c.expected !== c.actual);
    const numericalFailures = reviews.filter((c) =>
      c.review.flags.some((f) => !['SIGN_CHANGE', 'ZERO_NONZERO_PROBABILITY'].includes(f)),
    );
    lines.push(
      `${reviews.length - numericalFailures.length}/${reviews.length} numerical values within the approved absolute tolerance.`,
      '',
      `${reviews.length} numerical comparisons; ${reviews.filter((c) => c.review.flags.length).length} require attention. ${item.classifications.length} significance comparisons; ${classificationChanges.length} changed.`,
      '',
      '| Family | Count | Maximum absolute difference | Approved absolute | Approved relative | Flagged cells |',
      '| --- | ---: | ---: | ---: | ---: | --- |',
    );
    for (const family of [...new Set(reviews.map((r) => r.family))]) {
      const rows = reviews.filter((r) => r.family === family);
      const differences = rows.flatMap((r) => (r.review.difference === null ? [] : [r.review.difference]));
      const tolerance = rows[0].review.tolerance;
      lines.push(
        `| ${escape(family)} | ${rows.length} | ${differences.length ? Math.max(...differences) : 'unavailable'} | ${number(tolerance?.absolute ?? null)} | ${number(tolerance?.relative ?? null)} | ${
          rows
            .filter((r) => r.review.flags.length)
            .map((r) => r.cell)
            .join(', ') || 'none'
        } |`,
      );
    }
    lines.push(
      '',
      '### Cell-by-cell numerical evidence',
      '',
      '| Family | Cell | Saved result | Engine | Absolute difference | Approved limit | Review flags |',
      '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    );
    for (const c of reviews)
      lines.push(
        `| ${escape(c.family)} | ${c.cell} | ${number(c.expected)} | ${number(c.actual)} | ${number(c.review.difference)} | ${number(c.review.limit)} | ${c.review.flags.join(', ') || 'none'} |`,
      );
    lines.push(
      '',
      '### Significance evidence',
      '',
      '| Cell | Saved result | Engine | Review |',
      '| --- | --- | --- | --- |',
    );
    for (const c of item.classifications)
      lines.push(
        `| ${c.cell} | ${c.expected} | ${c.actual} | ${c.expected === c.actual ? 'agrees' : 'CLASSIFICATION_CHANGE'} |`,
      );
    lines.push('');
  }
  for (const fixture of regressionFixtures)
    if (!seen.has(fixture.id)) lines.push(`Missing characterization: ${fixture.file}.`, '');
  lines.push('## Required review evidence', '');
  for (const dependency of calculationReviewDependencies)
    lines.push(
      `- [${['TOLERANCES', 'NATIVE_RECALCULATION'].includes(dependency.code) ? 'x' : ' '}] ${dependency.code}: ${dependency.detail}`,
    );
  lines.push(
    '- [x] User confirmed full recalculation of all three workbooks. Excel build/action logs were not independently observed.',
    '- [x] User approved absolute tolerance 0.99 with relative tolerance 0 across numerical comparisons.',
    '- [ ] Register approved fixtures and execute the golden suite, including supplemental edge cases, before changing application compatibility status.',
    '',
    'This report is a review aid. Editing it does not approve fixtures or change application results.',
    '',
  );
  return lines.join('\n');
}

/** Numeric agreement under the approved tolerance; methodology/coverage approval remains separate. */
export function assessWorkbookNumbers(input: unknown) {
  const items = z.array(characterization).max(3).parse(input);
  if (new Set(items.map((c) => c.fixtureId)).size !== items.length) throw Error('Duplicate fixture.');
  const fixtures = workbookRegistry.fixtures.map((fixture) => {
    const item = items.find((c) => c.fixtureId === fixture.id);
    if (!item) return { fixtureId: fixture.id, status: 'BLOCKED', reason: 'MISSING_FIXTURE' };
    if (item.source.sha256 !== fixture.recordedSha256) throw Error('Unrecognized source hash.');
    if (
      item.algorithm !== workbookRegistry.algorithm ||
      item.reportingAlgorithm !== workbookRegistry.reportingAlgorithm
    )
      throw Error('Unrecognized algorithm version.');
    const uniqueNumbers = new Set(item.comparisons.map((c) => `${c.family}:${c.cell}`));
    const uniqueClasses = new Set(item.classifications.map((c) => c.cell));
    if (
      item.comparisons.length !== fixture.numerical.length ||
      uniqueNumbers.size !== fixture.numerical.length ||
      fixture.numerical.some((c) => !uniqueNumbers.has(`${c.family}:${c.cell}`)) ||
      item.classifications.length !== fixture.classifications.length ||
      uniqueClasses.size !== fixture.classifications.length ||
      fixture.classifications.some((cell) => !uniqueClasses.has(cell))
    )
      return { fixtureId: fixture.id, status: 'BLOCKED', reason: 'INCOMPLETE_OR_DUPLICATE_COVERAGE' };
    const results = item.comparisons.map((c) => ({ ...c, ...reviewComparison(c.family, c.expected, c.actual) }));
    const failures = results.filter((r) =>
      r.flags.some((f) => !['SIGN_CHANGE', 'ZERO_NONZERO_PROBABILITY'].includes(f)),
    );
    const classificationChanges = item.classifications.filter((c) => c.expected !== c.actual);
    return {
      fixtureId: fixture.id,
      status: failures.length || classificationChanges.length ? 'FAIL' : 'PASS',
      numericalComparisons: results.length,
      classificationComparisons: item.classifications.length,
      failures,
      classificationChanges,
      advisories: results.filter((r) => r.flags.some((f) => ['SIGN_CHANGE', 'ZERO_NONZERO_PROBABILITY'].includes(f))),
    };
  });
  return {
    registryVersion: workbookRegistry.version,
    policy: compatibilityPolicy,
    status: fixtures.some((f) => f.status === 'FAIL')
      ? 'FAIL'
      : fixtures.every((f) => f.status === 'PASS')
        ? 'PASS'
        : 'BLOCKED',
    fixtures,
    note: 'Numerical tolerance agreement only. Sign changes and zero/nonzero probabilities remain review advisories; significance classifications must agree exactly. This does not approve untested outputs or methodological differences.',
  };
}
