import { describe, expect, it } from 'vitest';
import { calculateMonthlyPerformance } from '../src/domain/analysis/monthly-performance';
import { fitRegression } from '../src/domain/analysis/regression';
import { calculateReporting, projectReportingModel, type ReportingInput } from '../src/domain/analysis/reporting';

const site = { organisationId: '11111111-1111-4111-8111-111111111111', siteId: '22222222-2222-4222-8222-222222222222' };
const scope = { ...site, meterId: '33333333-3333-4333-8333-333333333333', energyUseId: null };

describe('monthly performance', () => {
  it('calculates the combined HDD and CDD expected use, baseload anomaly and performance from a saved run', () => {
    const fit = fitRegression({
      responseUnit: 'kWh',
      policy: { version: 'test', relativeRankTolerance: 1e-10 },
      drivers: [
        { code: 'HDD', unit: 'C·day' },
        { code: 'CDD', unit: 'C·day' },
      ],
      observations: [
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
        [3, 1],
        [1, 3],
      ].map(([hdd, cdd], index) => ({
        id: `baseline-${index}`,
        response: 10 + 2 * hdd + 3 * cdd,
        drivers: [hdd, cdd],
      })),
    });
    expect(fit.status).toBe('FITTED');
    if (fit.status !== 'FITTED') throw new Error(fit.message);
    const model = projectReportingModel(fit);
    if (!model) throw new Error('Expected a reporting model.');
    const input: ReportingInput = {
      baseline: {
        id: 'baseline-1',
        scope,
        period: { firstMonth: '2020-01', lastMonth: '2020-12' },
        model,
        referenceObservations: [],
      },
      period: { firstMonth: '2021-01', lastMonth: '2021-01' },
      policy: {
        version: 'test',
        nra: 'NONE',
        significanceBasis: 'POST_NRA',
        comparison: 'AT_LEAST',
        sigmaMultiplier: 2,
        zeroThreshold: 'UNDEFINED',
        negativePrediction: 'BLOCK',
        extrapolation: 'BLOCK',
      },
      rows: [
        {
          consumption: { id: 'consumption-1', scope, month: '2021-01', kwh: 18 },
          drivers: [
            { id: 'hdd-1', scope: site, month: '2021-01', code: 'HDD', unit: 'C·day', value: 3 },
            { id: 'cdd-1', scope: site, month: '2021-01', code: 'CDD', unit: 'C·day', value: 2 },
          ],
          nraReferenceMonth: null,
          nraObservations: [],
        },
      ],
    };
    const report = calculateReporting(input);
    expect(report.status).toBe('CALCULATED');
    const [row] = calculateMonthlyPerformance(fit, report);

    expect(row).toMatchObject({ model: 'HDD_AND_CDD', actualKwh: 18, significant: true, issues: [] });
    expect(row.expectedKwh).toBeCloseTo(22);
    expect(row.heatingComponentKwh).toBeCloseTo(6);
    expect(row.coolingComponentKwh).toBeCloseTo(6);
    expect(row.impliedBaseloadKwh).toBeCloseTo(6);
    expect(row.baselineBaseloadKwh).toBeCloseTo(10);
    expect(row.baseloadAnomalyKwh).toBeCloseTo(-4);
    expect(row.performanceKwh).toBeCloseTo(4);
  });
});
