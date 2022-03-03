import Decimal from 'decimal.js';

export const calculateIncreasePercentage = (p: { passValue: number; currentValue: number }) => {
  const oldValue = p.passValue === 0 ? 1 : p.passValue;
  const step1 = new Decimal(p.currentValue).minus(oldValue).toNumber();
  const step2 = new Decimal(step1).dividedBy(oldValue).toNumber();
  const percentage = new Decimal(step2).times(100).toDecimalPlaces(2).toNumber();
  return percentage;
};

export const toInt = (i: string) => {
  return parseInt(i, 10);
};
