import type { RegressionResult } from './regression';
import type { ReportingResult } from './reporting';

export type MonthlyPerformanceRow = {
  month: string;
  model: 'HDD' | 'CDD' | 'HDD_AND_CDD' | 'UNSUPPORTED';
  actualKwh: number | null;
  expectedKwh: number | null;
  heatingComponentKwh: number | null;
  coolingComponentKwh: number | null;
  impliedBaseloadKwh: number | null;
  baselineBaseloadKwh: number | null;
  baseloadAnomalyKwh: number | null;
  performanceKwh: number | null;
  significanceThresholdKwh: number | null;
  significant: boolean | null;
  issues: string[];
};

const climateDrivers = new Set(['HDD', 'CDD']);

function modelFor(codes: string[]): MonthlyPerformanceRow['model'] {
  const hdd = codes.includes('HDD');
  const cdd = codes.includes('CDD');
  if (hdd && cdd) return 'HDD_AND_CDD';
  if (hdd) return 'HDD';
  if (cdd) return 'CDD';
  return 'UNSUPPORTED';
}

/**
 * Applies the monthly performance equations from the developer guide to a frozen reporting run.
 * The result deliberately omits the implied-baseload calculation when the model has other drivers,
 * because those drivers cannot be folded into the guide's HDD/CDD-only baseload equation.
 */
export function calculateMonthlyPerformance(fit: RegressionResult, report: ReportingResult): MonthlyPerformanceRow[] {
  if (fit.status !== 'FITTED' || report.status === 'BLOCKED') return [];
  const coefficients = new Map(fit.coefficients.map((coefficient) => [coefficient.code, coefficient.value]));
  const codes = fit.coefficients.map((coefficient) => coefficient.code);
  const model = modelFor(codes);
  const otherDrivers = codes.filter((code) => !climateDrivers.has(code));
  const sourceRows = new Map(report.inputSnapshot.rows.map((row) => [row.consumption.month, row]));
  const threshold = 2 * fit.residualStandardError;

  return report.rows.map((result) => {
    if (result.status !== 'CALCULATED')
      return {
        month: result.month,
        model,
        actualKwh: null,
        expectedKwh: null,
        heatingComponentKwh: null,
        coolingComponentKwh: null,
        impliedBaseloadKwh: null,
        baselineBaseloadKwh: null,
        baseloadAnomalyKwh: null,
        performanceKwh: null,
        significanceThresholdKwh: null,
        significant: null,
        issues: result.issues.map((issue) => issue.message),
      };

    const source = sourceRows.get(result.month);
    const values = new Map(source?.drivers.map((driver) => [driver.code, driver.value]));
    const inputsAvailable = codes.every((code) => typeof values.get(code) === 'number');
    const expectedKwh = inputsAvailable
      ? fit.intercept +
        fit.coefficients.reduce(
          (total, coefficient) => total + coefficient.value * (values.get(coefficient.code) ?? 0),
          0,
        )
      : null;
    const hdd = values.get('HDD');
    const cdd = values.get('CDD');
    const heatingComponentKwh =
      coefficients.has('HDD') && typeof hdd === 'number' ? coefficients.get('HDD')! * hdd : null;
    const coolingComponentKwh =
      coefficients.has('CDD') && typeof cdd === 'number' ? coefficients.get('CDD')! * cdd : null;
    const supportsBaseload = model !== 'UNSUPPORTED' && otherDrivers.length === 0;
    const impliedBaseloadKwh =
      supportsBaseload && heatingComponentKwh !== null
        ? result.actualKwh - heatingComponentKwh - (coolingComponentKwh ?? 0)
        : supportsBaseload && coolingComponentKwh !== null
          ? result.actualKwh - coolingComponentKwh
          : null;
    const baselineBaseloadKwh = supportsBaseload ? fit.intercept : null;
    const baseloadAnomalyKwh =
      impliedBaseloadKwh !== null && baselineBaseloadKwh !== null ? impliedBaseloadKwh - baselineBaseloadKwh : null;
    const performanceKwh = expectedKwh === null ? null : expectedKwh - result.actualKwh;
    const issues = [
      ...(inputsAvailable ? [] : ['A required reporting driver is missing.']),
      ...(model === 'UNSUPPORTED' ? ['This saved model does not contain an HDD or CDD term.'] : []),
      ...(otherDrivers.length
        ? [`The baseload equation is unavailable because this model also uses ${otherDrivers.join(', ')}.`]
        : []),
    ];

    return {
      month: result.month,
      model,
      actualKwh: result.actualKwh,
      expectedKwh,
      heatingComponentKwh,
      coolingComponentKwh,
      impliedBaseloadKwh,
      baselineBaseloadKwh,
      baseloadAnomalyKwh,
      performanceKwh,
      significanceThresholdKwh: threshold,
      significant: performanceKwh === null ? null : Math.abs(performanceKwh) >= threshold,
      issues,
    };
  });
}
