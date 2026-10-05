import type { ClassificationValues } from '../driver-classifications';

export const classificationDrivers = {
  heating: 'HDD',
  cooling: 'CDD',
  population: 'POPULATION',
  operatingHours: 'OPERATING_HOURS',
  daylighting: 'DAYLIGHT',
} as const;
export function classificationMethod(values: Record<keyof ClassificationValues, string> | null | undefined) {
  const routine = Object.entries(classificationDrivers)
    .filter(([field]) => values?.[field as keyof ClassificationValues] === 'R')
    .map(([, code]) => code);
  const hasNra = values ? Object.values(values).includes('NR') : false;
  const nra = !hasNra
    ? 'NONE'
    : values?.population === 'NR' && values?.operatingHours === 'NR'
      ? 'HOURS_AND_POPULATION'
      : values?.population === 'NR'
        ? 'POPULATION'
        : values?.operatingHours === 'NR'
          ? 'HOURS'
          : 'NONE';
  return {
    routine,
    hasNra,
    nra,
    unsupportedNra: values
      ? Object.entries(values)
          .filter(([field, value]) => value === 'NR' && !['population', 'operatingHours'].includes(field))
          .map(([field]) => field)
      : [],
    name: hasNra
      ? 'Multiple routine adjustment + NRA'
      : routine.length === 1
        ? 'Single routine adjustment'
        : 'Multiple routine adjustment',
    defaultDrivers: routine.filter((code) => code === 'HDD' || code === 'CDD'),
  };
}
