import { expect, it } from 'vitest';
import {
  baselineDefinition,
  runDefinition,
  nraReviewInput,
  periodMonths,
  analysisPeriod,
  snapshotHash,
  historyPageInput,
} from '../src/server/analysis/contract';
it('canonicalizes object keys while preserving values, explicit null and predictor order', () => {
  expect(snapshotHash({ b: [1, 2], a: null })).toBe(snapshotHash({ a: null, b: [1, 2] }));
  expect(snapshotHash({ a: null, b: [1, 2] })).not.toBe(snapshotHash({ a: null, b: [2, 1] }));
  expect(snapshotHash({ value: '1.000' })).not.toBe(snapshotHash({ value: 1 }));
  for (const bad of [undefined, NaN, Infinity, new Date(), { missing: undefined }])
    expect(() => snapshotHash(bad)).toThrow();
});
it('enumerates year boundaries and constrains calendar periods', () => {
  expect(periodMonths({ firstMonth: '2020-12', lastMonth: '2021-02' })).toEqual(['2020-12', '2021-01', '2021-02']);
  expect(analysisPeriod.safeParse({ firstMonth: '2020-01', lastMonth: '2030-01' }).success).toBe(false);
  expect(analysisPeriod.safeParse({ firstMonth: '2020-02', lastMonth: '2020-01' }).success).toBe(false);
});
it('requires explicit weather selection and unique predictor columns', () => {
  const value = {
    meterId: '33333333-3333-4333-8333-333333333333',
    energyUseId: null,
    period: { firstMonth: '2020-01', lastMonth: '2020-12' },
    drivers: ['HDD'],
    weather: null,
    fitPolicy: { version: 'test', relativeRankTolerance: 1e-10 },
    estimatedConsumption: 'BLOCK',
    supersedesId: null,
  };
  expect(baselineDefinition.safeParse(value).success).toBe(false);
  expect(baselineDefinition.safeParse({ ...value, drivers: ['POPULATION'] }).success).toBe(true);
  expect(baselineDefinition.safeParse({ ...value, drivers: ['POPULATION', 'POPULATION'] }).success).toBe(false);
});

it('bounds history requests and rejects malformed cursors', () => {
  expect(historyPageInput.parse({})).toEqual({ limit: 20 });
  expect(historyPageInput.parse({ limit: 100 }).limit).toBe(100);
  for (const limit of [0, 101, -1, 1.5, Infinity, '20', null])
    expect(historyPageInput.safeParse({ limit }).success).toBe(false);
  for (const cursor of ['', 'not-a-uuid', null]) expect(historyPageInput.safeParse({ cursor }).success).toBe(false);
});

it('requires NRA context and rejects empty rationale, evidence and review reasons', () => {
  const input = {
    period: { firstMonth: '2020-05', lastMonth: '2020-05' },
    policy: {
      version: 'test',
      nra: 'POPULATION',
      significanceBasis: 'POST_NRA',
      comparison: 'AT_LEAST',
      sigmaMultiplier: 2,
      zeroThreshold: 'UNDEFINED',
      negativePrediction: 'BLOCK',
      extrapolation: 'BLOCK',
    },
    references: [{ month: '2020-05', referenceMonth: '2020-01' }],
  };
  expect(runDefinition.safeParse(input).success).toBe(false);
  const context = { rationale: 'Changed occupancy', evidence: ['Observation register'] };
  expect(runDefinition.safeParse({ ...input, nraContext: context }).success).toBe(true);
  for (const nraContext of [
    { ...context, rationale: ' ' },
    { ...context, evidence: [] },
    { ...context, evidence: [' '] },
  ])
    expect(runDefinition.safeParse({ ...input, nraContext }).success).toBe(false);
  expect(
    runDefinition.safeParse({ ...input, policy: { ...input.policy, nra: 'NONE' }, references: [], nraContext: context })
      .success,
  ).toBe(false);
  expect(
    nraReviewInput.safeParse({ requestId: crypto.randomUUID(), previousId: null, decision: 'APPROVED', reason: ' ' })
      .success,
  ).toBe(false);
});
