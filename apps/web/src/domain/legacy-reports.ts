import type { UtilityGraphRow, UtilityCostTarget } from './utility-graphs';
import { utilityComparison } from './utility-comparison';
import type { WastePreview } from './analysis/waste-preview';
import { csvCell } from './carbon-report';

export type OverviewReportRow = UtilityGraphRow & {
  variance: number | null;
  wasteCost: number | null;
  calculationNote: string;
};

export function overviewReportRows(rows: UtilityGraphRow[], preview: WastePreview | null): OverviewReportRow[] {
  return rows.map((row) => {
    const calculation = preview?.meters
      .find((meter) => meter.id === row.meterId)
      ?.rows.find((month) => month.month === row.month);
    return {
      ...row,
      variance: calculation?.variance ?? null,
      wasteCost: calculation?.cost ?? null,
      calculationNote: calculation?.note ?? 'No matching waste calculation is available.',
    };
  });
}

export const reportSortOptions = [
  ['month', 'Date'],
  ['consumption-desc', 'Highest Consumption'],
  ['consumption-asc', 'Lowest Consumption'],
  ['emissions-desc', 'Highest Emission'],
  ['emissions-asc', 'Lowest Emission'],
  ['waste-asc', 'Lowest Waste'],
  ['waste-desc', 'Highest Waste'],
  ['saving-asc', 'Lowest Saving'],
  ['saving-desc', 'Highest Saving'],
] as const;

export function sortOverviewReports(rows: OverviewReportRow[], sort: string) {
  const amount = (row: OverviewReportRow) => {
    if (sort.startsWith('consumption')) return row.consumption === null ? null : Number(row.consumption);
    if (sort.startsWith('emissions')) return row.emissions === null ? null : Number(row.emissions);
    if (row.variance === null) return null;
    return sort.startsWith('waste') ? Math.max(0, -row.variance) : Math.max(0, row.variance);
  };
  return [...rows].sort((a, b) => {
    if (sort !== 'month') {
      const left = amount(a),
        right = amount(b);
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      if (left !== null && right !== null && left !== right) return (left - right) * (sort.endsWith('desc') ? -1 : 1);
    }
    return (
      a.month.localeCompare(b.month) || a.fuel.localeCompare(b.fuel) || (a.endUse ?? '').localeCompare(b.endUse ?? '')
    );
  });
}

export function reportCoverage(rows: UtilityGraphRow[], year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const records = rows.filter((row) => row.month === month);
    return { month, available: records.length > 0 && records.every((row) => row.consumption !== null) };
  });
}

export function overviewReportCsv(rows: OverviewReportRow[]) {
  const fields = [
    [
      'Site',
      'Date',
      'Energy',
      'Utility',
      'Total utility consumption (kWh)',
      'Financial cost (net)',
      'Currency',
      'Carbon impacts (kgCO2e)',
      'Avoided (+) / wasted (-) energy (kWh)',
      'Avoided / wasted cost (GBP)',
      'Calculation status',
    ],
    ...rows.map((r) => [
      r.siteName,
      r.month,
      r.endUse ?? '',
      r.fuel,
      r.consumption,
      r.cost,
      r.currency,
      r.emissions,
      r.variance,
      r.wasteCost,
      r.calculationNote,
    ]),
  ];
  return fields.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function dashboardReportCsv(
  rows: OverviewReportRow[],
  targets: UtilityCostTarget[],
  fuel: string,
  coverage: ReturnType<typeof reportCoverage>,
) {
  const comparison = utilityComparison(rows, targets, fuel);
  const sections = [
    ['Target comparison'],
    [
      'Month',
      'Actual energy (kWh)',
      'Target energy (kWh)',
      'Actual carbon (kgCO2e)',
      'Target carbon (kgCO2e)',
      'Target scope',
    ],
    ...comparison.map((row) => [
      row.month,
      row.consumption,
      row.targetEnergy,
      row.emissions,
      row.targetCarbon,
      row.targetScope,
    ]),
    [],
    ['Number Of Reports'],
    ['Month', 'Consumption coverage'],
    ...coverage.map((row) => [row.month, row.available ? 'Available' : 'Missing / incomplete']),
  ];
  return overviewReportCsv(rows) + '\r\n' + sections.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
