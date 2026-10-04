export type UtilityChartSort = 'month' | 'high-to-low' | 'low-to-high';
export function sortChartValues<T extends { month: string }>(
  rows: T[],
  order: UtilityChartSort,
  value: (row: T) => string | null | undefined,
): T[] {
  return [...rows].sort((a, b) => {
    if (order === 'month') return a.month.localeCompare(b.month);
    const left = value(a);
    const right = value(b);
    if (left == null || right == null) {
      if (left == null && right != null) return 1;
      if (right == null && left != null) return -1;
      return a.month.localeCompare(b.month);
    }
    const difference = Number(left) - Number(right);
    return (order === 'high-to-low' ? -difference : difference) || a.month.localeCompare(b.month);
  });
}
