const formatter = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

// Format presentation only; calculations, saved values and edit fields retain full precision.
export function formatEnergyValue(value: unknown, missing = 'Unknown'): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim()))
    return missing;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatter.format(numeric === 0 ? 0 : numeric) : missing;
}
