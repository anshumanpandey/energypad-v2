import { describe, expect, it } from 'vitest';
import {
  overviewReportRows,
  overviewReportCsv,
  reportCoverage,
  sortOverviewReports,
} from '../src/domain/legacy-reports';
import type { UtilityGraphRow } from '../src/domain/utility-graphs';
import type { WastePreview } from '../src/domain/analysis/waste-preview';
import { energyTips } from '../src/domain/energy-tips';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const row = (changes: Partial<UtilityGraphRow> = {}): UtilityGraphRow => ({
  siteId: 'site',
  siteName: '=unsafe site',
  meterId: 'heating',
  endUse: 'Heating',
  fuel: 'GAS',
  month: '2025-01',
  consumption: '100',
  emissions: '20',
  cost: '10',
  currency: 'GBP',
  notes: [],
  zeroFilled: false,
  ...changes,
});
const preview: WastePreview = {
  year: 2025,
  years: [2025],
  drivers: ['HDD'],
  method: 'Single routine adjustment',
  meters: [
    {
      id: 'heating',
      name: 'Heating',
      fuel: 'GAS',
      issues: [],
      downloadable: true,
      rows: [
        { month: '2025-01', actual: 100, expected: 90, adjusted: 90, variance: -10, cost: -1, note: 'Calculated' },
      ],
    },
  ],
};
describe('legacy Reports overview', () => {
  it('matches waste evidence by meter and month, preserving missing values and signed waste', () => {
    const report = overviewReportRows([row(), row({ meterId: 'cooling' }), row({ month: '2026-01' })], preview);
    expect(report.map((r) => r.variance)).toEqual([-10, null, null]);
    expect(report[0].wasteCost).toBe(-1);
    expect(overviewReportCsv(report)).toContain('"\'=unsafe site"');
    expect(overviewReportCsv(report)).toContain('Calculated');
  });
  it('requires every selected meter reading for coverage without counting zero as missing', () => {
    const rows = [row({ consumption: '0' }), row({ meterId: 'cooling', consumption: null }), row({ month: '2025-02' })];
    const coverage = reportCoverage(rows, 2025);
    expect(coverage).toHaveLength(12);
    expect(coverage.slice(0, 3).map((r) => r.available)).toEqual([false, true, false]);
    expect(reportCoverage(rows, 2026).every((r) => !r.available)).toBe(true);
  });
  it('sorts magnitude of waste and savings and places unavailable values last', () => {
    const rows = overviewReportRows([row(), row({ month: '2025-02' }), row({ month: '2025-03' })], preview);
    rows[1].variance = 50;
    expect(sortOverviewReports(rows, 'waste-desc').map((r) => r.month)).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(sortOverviewReports(rows, 'saving-desc').map((r) => r.month)).toEqual(['2025-02', '2025-01', '2025-03']);
  });
});
it('restores the complete legacy tips catalogue with all available illustrations', () => {
  expect(energyTips).toHaveLength(42);
  expect([...new Set(energyTips.map((tip) => tip.category))].sort()).toEqual(['Cooling', 'Heating', 'Power']);
  for (const tip of energyTips) if (tip.imageUrl) expect(existsSync(join('public', tip.imageUrl))).toBe(true);
});
