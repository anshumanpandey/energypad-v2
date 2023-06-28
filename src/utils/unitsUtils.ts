import Decimal from 'decimal.js';

const SUPPORTED_UNITS = ['L', 'm3', 'kWh'] as const;
export type ONE_OF_SUPPORTED_UNIT = typeof SupportedUnits[number];
export const SupportedUnits = Array.from(SUPPORTED_UNITS.values());

export type ConversionResolverFn = (value: number, unit?: typeof SupportedUnits[number]) => number;

export const resolveConsumptionToKwh = (p: {
  consumption: number;
  fuelUnit: typeof SupportedUnits[number];
  conversionFactor: number;
}) => {
  let val = p.consumption;
  switch (p.fuelUnit) {
    case 'L':
    case 'm3': {
      val = new Decimal(val).times(p.conversionFactor).toDP(2).toNumber();
    }
    default: {
      return val;
    }
  }
};
