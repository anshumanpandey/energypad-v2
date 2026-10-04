export type ConsumptionSortKey = 'month' | 'utility' | 'source' | 'energy' | 'cost';
export type ConsumptionSort = { key: ConsumptionSortKey; direction: 'asc' | 'desc' };
type SortableReading = {
  id: string;
  meterId: string;
  periodStart: string;
  fuel: string;
  sourceQuantity: string;
  normalizedKwh: string;
  grossCost: string | null;
};

export function utilityLabel(fuel: string) {
  if (fuel === 'ALL') return 'All site utilities';
  if (fuel === 'SOLAR_PV') return 'Solar PV';
  if (fuel === 'ELECTRICITY') return 'Grid electricity';
  if (fuel === 'LPG') return 'LPG';
  if (fuel === 'BIODIESEL') return 'Bio Diesel';
  return fuel.charAt(0) + fuel.slice(1).toLowerCase();
}

export function sortConsumption<T extends SortableReading>(records: T[], sort: ConsumptionSort): T[] {
  return [...records].sort((a, b) => {
    let compared = 0;
    if (sort.key === 'month') compared = a.periodStart.localeCompare(b.periodStart);
    else if (sort.key === 'utility') compared = utilityLabel(a.fuel).localeCompare(utilityLabel(b.fuel));
    else {
      const field = { source: 'sourceQuantity', energy: 'normalizedKwh', cost: 'grossCost' }[sort.key] as
        'sourceQuantity' | 'normalizedKwh' | 'grossCost';
      // Unknown costs remain last in either direction; a known zero is still a value.
      if (a[field] === null && b[field] !== null) return 1;
      if (b[field] === null && a[field] !== null) return -1;
      compared = Number(a[field]) - Number(b[field]);
    }
    return (
      compared * (sort.direction === 'asc' ? 1 : -1) ||
      b.periodStart.localeCompare(a.periodStart) ||
      utilityLabel(a.fuel).localeCompare(utilityLabel(b.fuel)) ||
      a.meterId.localeCompare(b.meterId) ||
      a.id.localeCompare(b.id)
    );
  });
}
