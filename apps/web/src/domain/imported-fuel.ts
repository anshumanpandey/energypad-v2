// Older imports used OIL for diesel. Keep stored calculation codes intact and
// recover the specific fuel label from the immutable workbook provenance.
export function importedFuel(fuel: string, provenance: unknown): string {
  if (fuel !== 'OIL' || !provenance || typeof provenance !== 'object') return fuel;
  const label = (provenance as { utilityType?: unknown }).utilityType;
  if (typeof label !== 'string') return fuel;
  const normalized = label.trim().toLowerCase();
  if (normalized === 'diesel') return 'DIESEL';
  if (normalized === 'petrol') return 'PETROL';
  return fuel;
}
