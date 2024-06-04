import Decimal from 'decimal.js';

export const calculateIncreasePercentage = (p: { passValue: number; currentValue: number }) => {
  const oldValue = p.passValue === 0 ? 1 : p.passValue;
  const step1 = new Decimal(p.currentValue).minus(oldValue).toNumber();
  const step2 = new Decimal(step1).dividedBy(oldValue).toNumber();
  const percentage = new Decimal(step2).times(100).toDecimalPlaces(2).toNumber();
  return percentage;
};

export const toInt = (i: string) => {
  return new Decimal(i).toNumber();
};
export const getAverage = (vals: number[], total?: number) => {
  const avg = new Decimal(0);
  for (let idx = 0; idx < vals.length; idx++) {
    avg.add(vals[idx]);
  }
  return avg
    .dividedBy(total ? total : vals.length)
    .toDecimalPlaces(2)
    .toNumber();
};

export const totalOf = (vals: number[]) => {
  return vals.reduce((a, b) => new Decimal(a).add(b).toNumber());
};

export const sumProduct = (vector1: number[], vector2: number[]) => {
  let total = 0;
  for (let i = 0; i < vector1.length; i++) {
    const A = vector1[i];
    const B = vector2[i];
    if (!B) {
      continue;
    }
    const mul = new Decimal(A).times(B);
    total = mul.add(total).toNumber();
  }

  return total;
};
