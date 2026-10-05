export type WasteChartRow = {
  month: string;
  actual: number | null;
  adjusted: number | null;
  variance: number | null;
  cost: number | null;
  note?: string;
  observed?: boolean;
};

export function wasteGauge(rows: WasteChartRow[], selectedMonth = '') {
  const latest = [...rows]
    .filter((row) => row.actual !== null || row.observed)
    .sort((a, b) => a.month.localeCompare(b.month))
    .at(-1)?.month;
  const anchor = selectedMonth || latest;
  if (!anchor) return { months: [], percentage: null };
  const [year, month] = anchor.split('-').map(Number);
  const months = [2, 1, 0].map((offset) => new Date(Date.UTC(year, month - 1 - offset, 1)).toISOString().slice(0, 7));
  const selected = months.map((month) => rows.find((row) => row.month === month));
  if (selected.some((row) => !row || row.variance === null || row.adjusted === null))
    return { months, percentage: null };
  const expected = selected.reduce((sum, row) => sum + row!.adjusted!, 0);
  return {
    months,
    percentage: expected > 0 ? (selected.reduce((sum, row) => sum + row!.variance!, 0) / expected) * 100 : null,
  };
}

export function aggregateWasteRows(groups: WasteChartRow[][]): WasteChartRow[] {
  const months = [...new Set(groups.flatMap((rows) => rows.map((row) => row.month)))].sort();
  return months.map((month) => {
    const rows = groups.map((group) => group.find((row) => row.month === month));
    const total = (key: 'actual' | 'adjusted' | 'variance' | 'cost') =>
      rows.every((row) => row && row[key] !== null) ? rows.reduce((sum, row) => sum + row![key]!, 0) : null;
    return {
      month,
      actual: total('actual'),
      adjusted: total('adjusted'),
      variance: total('variance'),
      cost: total('cost'),
      observed: rows.some((row) => row?.actual !== null && row?.actual !== undefined),
      note: rows.some((row) => !row || row.variance === null)
        ? 'Calculation inputs are incomplete for one or more selected meters.'
        : 'Combined selected meter values.',
    };
  });
}
