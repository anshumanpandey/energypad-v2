import Decimal from 'decimal.js';

const SUPPORTED_UNITS = ['L', 'm3', 'kWh'] as const;
export const SupportedUnits = Array.from(SUPPORTED_UNITS.values());

export const litersToKwh = (liters: number) => {
  return new Decimal(liters).times(6.9).toNumber();
};

export const m3ToKwh = (meters: number) => {
  return new Decimal(meters).times(10.55).toNumber();
};

export type ConversionResolverFn = (value: number, unit?: typeof SupportedUnits[number]) => number;

export const resolveUnitConversion: ConversionResolverFn = (value, unit?) => {
  let result = value;
  if (unit === 'L') {
    result = litersToKwh(value);
  }
  if (unit === 'm3') {
    result = m3ToKwh(value);
  }
  return result;
};
