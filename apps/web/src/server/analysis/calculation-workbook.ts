import ExcelJS from 'exceljs';
import type { AnalysisService } from './service';
import type { BaselineDefinition } from './contract';
import type { RegressionResult } from '../../domain/analysis/regression';
import type { ReportingResult } from '../../domain/analysis/reporting';
import { DomainError } from '../../domain/policy';

type Snapshot = {
  definition: BaselineDefinition;
  assembly: { rows: { consumption: { month: string; kwh: number }; drivers: { code: string; value: number }[] }[] };
};
export async function calculationWorkbook(run: Awaited<ReturnType<AnalysisService['readRun']>>, siteName: string) {
  const fit = run.baseline.fit as unknown as RegressionResult;
  const snapshot = run.baseline.snapshot as unknown as Snapshot;
  const output = run.result?.output as unknown as ReportingResult;
  if (fit.status !== 'FITTED' || !output || output.status === 'BLOCKED')
    throw new DomainError('CALCULATION_UNAVAILABLE', 'A fitted baseline and saved reporting result are required.', 409);
  const book = new ExcelJS.Workbook();
  book.creator = 'EnergiePad';
  book.calcProperties.fullCalcOnLoad = true;
  const sheet = book.addWorksheet('Regression Analysis');
  const baseline = snapshot.assembly.rows;
  const reporting = output.rows;
  const k = fit.coefficients.length;
  const width = Math.max(baseline.length, reporting.length) + 1;
  const section = (row: number, title: string) => {
    sheet.mergeCells(row, 1, row, width);
    const cell = sheet.getCell(row, 1);
    cell.value = title;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173D45' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    sheet.getRow(row).height = 28;
  };
  const input = (row: number, label: string, values: (number | string | null)[]) => {
    sheet.getCell(row, 1).value = label;
    values.forEach((value, index) => {
      const cell = sheet.getCell(row, index + 2);
      cell.value = value;
      cell.font = { color: { argb: 'FF245AB3' } };
      cell.numFmt = '0.00';
    });
  };
  const formula = (row: number, column: number, expression: string, result: number | string | boolean | null) => {
    const cell = sheet.getCell(row, column);
    cell.value = result === null ? null : { formula: expression, result };
    cell.numFmt = typeof result === 'boolean' || typeof result === 'string' ? 'General' : '0.00';
  };
  const method =
    output.inputSnapshot.policy.nra !== 'NONE'
      ? 'Multiple Routine Adjustment + NRA'
      : k === 1
        ? 'Single Routine Adjustment'
        : 'Multiple Routine Adjustment';
  section(1, `${siteName} · ${method}`);
  section(
    2,
    `Baseline ${snapshot.definition.period.firstMonth} – ${snapshot.definition.period.lastMonth} · Reporting ${output.inputSnapshot.period.firstMonth} – ${output.inputSnapshot.period.lastMonth}`,
  );
  section(4, 'A · Baseline inputs');
  input(
    5,
    'Month',
    baseline.map((row) => row.consumption.month),
  );
  fit.coefficients.forEach((coefficient, index) =>
    input(
      6 + index,
      `${coefficient.code} (${coefficient.unit})`,
      baseline.map((row) => row.drivers.find((driver) => driver.code === coefficient.code)?.value ?? null),
    ),
  );
  const actualRow = 6 + k;
  input(
    actualRow,
    'Actual consumption (kWh)',
    baseline.map((row) => row.consumption.kwh),
  );
  const coeffRow = actualRow + 4;
  section(coeffRow - 2, 'B · Regression coefficients and diagnostics');
  const end = sheet.getColumn(baseline.length + 1).letter;
  const responseRange = `B${actualRow}:${end}${actualRow}`;
  const driverRange = `B6:${end}${5 + k}`;
  input(coeffRow, 'Intercept / baseload', [fit.intercept]);
  formula(coeffRow, 2, `INDEX(LINEST(${responseRange},${driverRange},TRUE,TRUE),1,${k + 1})`, fit.intercept);
  fit.coefficients.forEach((coefficient, index) => {
    input(coeffRow + 1 + index, `${coefficient.code} coefficient`, [coefficient.value]);
    formula(
      coeffRow + 1 + index,
      2,
      `INDEX(LINEST(${responseRange},${driverRange},TRUE,TRUE),1,${k - index})`,
      coefficient.value,
    );
  });
  const diagnosticRow = coeffRow + k + 2;
  input(diagnosticRow, 'R²', [fit.rSquared]);
  formula(diagnosticRow, 2, `INDEX(LINEST(${responseRange},${driverRange},TRUE,TRUE),3,1)`, fit.rSquared);
  input(diagnosticRow + 1, 'Regression standard error (kWh)', [fit.residualStandardError]);
  formula(
    diagnosticRow + 1,
    2,
    `INDEX(LINEST(${responseRange},${driverRange},TRUE,TRUE),3,2)`,
    fit.residualStandardError,
  );
  input(diagnosticRow + 2, 'Residual degrees of freedom', [fit.residualDegreesOfFreedom]);
  const fittedRow = diagnosticRow + 5;
  input(
    fittedRow - 1,
    'Month',
    baseline.map((row) => row.consumption.month),
  );
  input(fittedRow, 'Fitted baseline (kWh)', []);
  input(fittedRow + 1, 'Residual (kWh)', []);
  input(fittedRow + 2, 'Residual squared', []);
  baseline.forEach((row, index) => {
    const column = index + 2,
      letter = sheet.getColumn(column).letter;
    const result = fit.rows.find((item) => item.id === (row.consumption as { id?: string }).id) ?? fit.rows[index];
    formula(
      fittedRow,
      column,
      `$B$${coeffRow}+${fit.coefficients.map((_, j) => `$B$${coeffRow + 1 + j}*${letter}${6 + j}`).join('+')}`,
      result.fitted,
    );
    formula(fittedRow + 1, column, `${letter}${actualRow}-${letter}${fittedRow}`, result.residual);
    formula(fittedRow + 2, column, `${letter}${fittedRow + 1}^2`, result.residual ** 2);
  });
  const start = fittedRow + 5;
  section(start, 'C · Reporting inputs, expected consumption and waste / savings');
  input(
    start + 1,
    'Month',
    reporting.map((row) => row.month),
  );
  fit.coefficients.forEach((coefficient, index) =>
    input(
      start + 2 + index,
      `${coefficient.code} (${coefficient.unit})`,
      reporting.map(
        (row) =>
          output.inputSnapshot.rows
            .find((item) => item.consumption.month === row.month)
            ?.drivers.find((driver) => driver.code === coefficient.code)?.value ?? null,
      ),
    ),
  );
  const actual = start + 2 + k,
    expected = actual + 2,
    multiplier = expected + 1,
    adjusted = expected + 2;
  input(
    actual,
    'Actual consumption (kWh)',
    reporting.map((row) => (row.status === 'CALCULATED' ? row.actualKwh : null)),
  );
  input(expected, 'Expected consumption (kWh)', []);
  input(multiplier, 'NRA multiplier', []);
  input(adjusted, 'NRA-adjusted expected (kWh)', []);
  input(adjusted + 1, 'Savings (+) / Waste (−) before NRA', []);
  input(adjusted + 2, 'Savings (+) / Waste (−) after NRA', []);
  input(adjusted + 3, 'Significance threshold (kWh)', []);
  input(adjusted + 4, 'Significant?', []);
  const adjustmentKinds = [
    ...new Set(
      reporting.flatMap((row) => (row.status === 'CALCULATED' ? row.adjustments.map((item) => item.kind) : [])),
    ),
  ];
  const nraStart = adjusted + 7;
  if (adjustmentKinds.length) section(nraStart - 1, 'D · Non-routine adjustment source inputs');
  adjustmentKinds.forEach((kind, index) => {
    input(
      nraStart + index * 3,
      `${kind} · baseline reference`,
      reporting.map((row) =>
        row.status === 'CALCULATED'
          ? (row.adjustments.find((item) => item.kind === kind)?.referenceValue ?? null)
          : null,
      ),
    );
    input(
      nraStart + index * 3 + 1,
      `${kind} · reporting`,
      reporting.map((row) =>
        row.status === 'CALCULATED'
          ? (row.adjustments.find((item) => item.kind === kind)?.reportingValue ?? null)
          : null,
      ),
    );
    input(
      nraStart + index * 3 + 2,
      `${kind} · reference month`,
      reporting.map((row) =>
        row.status === 'CALCULATED'
          ? (row.adjustments.find((item) => item.kind === kind)?.referenceMonth ?? null)
          : null,
      ),
    );
  });
  reporting.forEach((row, index) => {
    if (row.status !== 'CALCULATED') {
      sheet.getCell(actual, index + 2).value = 'Unavailable';
      return;
    }
    const column = index + 2,
      letter = sheet.getColumn(column).letter;
    formula(
      expected,
      column,
      `$B$${coeffRow}+${fit.coefficients.map((_, j) => `$B$${coeffRow + 1 + j}*${letter}${start + 2 + j}`).join('+')}`,
      row.expectedKwh,
    );
    formula(
      multiplier,
      column,
      adjustmentKinds.length
        ? adjustmentKinds.map((_, j) => `(${letter}${nraStart + j * 3 + 1}/${letter}${nraStart + j * 3})`).join('*')
        : '1',
      row.nraMultiplier,
    );
    formula(adjusted, column, `${letter}${expected}*${letter}${multiplier}`, row.adjustedExpectedKwh);
    formula(adjusted + 1, column, `${letter}${expected}-${letter}${actual}`, row.preNraVarianceKwh);
    formula(adjusted + 2, column, `${letter}${adjusted}-${letter}${actual}`, row.postNraVarianceKwh);
    formula(adjusted + 3, column, `2*$B$${diagnosticRow + 1}`, row.significance.thresholdKwh);
    const variance = row.significance.basis === 'POST_NRA' ? adjusted + 2 : adjusted + 1;
    const operator = output.inputSnapshot.policy.comparison === 'AT_LEAST' ? '>=' : '>';
    formula(
      adjusted + 4,
      column,
      `ABS(${letter}${variance})${operator}${letter}${adjusted + 3}`,
      row.significance.significant,
    );
  });
  sheet.getColumn(1).width = 45;
  for (let column = 2; column <= width; column++) sheet.getColumn(column).width = 16;
  sheet.eachRow((row) => {
    row.height = Math.max(row.height ?? 22, 22);
    row.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
  });
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 5 }];
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const evidence = book.addWorksheet('Saved evidence');
  evidence.columns = [{ width: 32 }, { width: 100 }, { width: 20 }, { width: 20 }, { width: 20 }];
  evidence.addRows([
    ['Site', siteName],
    ['Run ID', run.id],
    ['Baseline ID', run.baseline.id],
    ['Input hash', run.inputHash],
    ['Saved at', run.createdAt.toISOString()],
    ['Method', method],
    ['Regression algorithm', fit.algorithm],
    ['Reporting algorithm', output.algorithm],
    ['Classification', 'Experimental · unvalidated'],
    ['Significance comparison', output.inputSnapshot.policy.comparison],
    ['NRA policy', output.inputSnapshot.policy.nra],
    [
      'Formula behaviour',
      'Saved results are cached. Excel recalculates the fitted model when baseline inputs are edited.',
    ],
    ['Coefficient', 'Estimate', 'Standard error', 't statistic', 'p value'],
    ...fit.inference.terms.map((term) => [
      term.driverCode ?? 'INTERCEPT',
      term.estimate,
      term.standardError,
      term.tStatistic,
      term.probability.value,
    ]),
  ]);
  evidence.eachRow((row) => {
    row.getCell(1).font = { bold: true };
    row.alignment = { vertical: 'top', wrapText: true };
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}
