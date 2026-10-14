type MonthlyValue = { month: string; value: string | number | null };

export function monthlyChartChange(points: MonthlyValue[], active: MonthlyValue) {
  const [year, month] = active.month.split('-').map(Number);
  const previousMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const previous = points.find((point) => point.month === previousMonth);
  if (
    !previous ||
    previous.value === null ||
    active.value === null ||
    !Number.isFinite(Number(previous.value)) ||
    !Number.isFinite(Number(active.value))
  )
    return null;
  const difference = Number(active.value) - Number(previous.value);
  const percentage = Number(previous.value) === 0 ? null : (difference / Math.abs(Number(previous.value))) * 100;
  return {
    previousMonth,
    difference,
    percentage,
    direction: difference < 0 ? 'down' : difference > 0 ? 'up' : 'equal',
  };
}
