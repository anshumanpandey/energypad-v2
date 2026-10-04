export type MissingImportMonth = { site: string; month: string; scope: string };

// Infer annual coverage only for groups actually represented by the workbook.
export function missingImportMonths<T extends { month: string }>(
  records: T[],
  identity: (row: T) => { site: string; scope: string },
  zero: (row: T, month: string) => T,
  fill: boolean,
) {
  const groups = new Map<string, { sample: T; months: Set<string>; site: string; scope: string }>();
  for (const row of records) {
    const { site, scope } = identity(row);
    const key = JSON.stringify([site.toLowerCase(), row.month.slice(0, 4), scope]);
    const group = groups.get(key) ?? { sample: row, months: new Set<string>(), site, scope };
    group.months.add(row.month);
    groups.set(key, group);
  }
  const missingMonths: MissingImportMonth[] = [];
  const extra: T[] = [];
  for (const group of groups.values()) {
    for (let i = 1; i <= 12; i++) {
      const month = `${group.sample.month.slice(0, 4)}-${String(i).padStart(2, '0')}`;
      if (group.months.has(month)) continue;
      missingMonths.push({ site: group.site, month, scope: group.scope });
      if (fill) extra.push(zero(group.sample, month));
    }
  }
  return { records: [...records, ...extra], missingMonths };
}
