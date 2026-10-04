export type UtilityGraphRow = {
  siteId: string;
  siteName: string;
  fuel: string;
  month: string;
  consumption: string | null;
  emissions: string | null;
  cost: string | null;
  currency: string | null;
  notes: string[];
  zeroFilled: boolean;
};

export function filterUtilityRows(
  rows: UtilityGraphRow[],
  filters: { site: string; year: string; month: string; fuel: string },
) {
  return rows.filter(
    (row) =>
      (!filters.site || row.siteId === filters.site) &&
      (!filters.year || row.month.slice(0, 4) === filters.year) &&
      (!filters.month || row.month.slice(5, 7) === filters.month) &&
      (!filters.fuel || row.fuel === filters.fuel),
  );
}
