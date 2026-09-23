export type TailProbability =
  | { status: 'OK'; value: number; logValue: number }
  | { status: 'UNDERFLOW'; value: null; logValue: number }
  | { status: 'INVALID_INPUT' | 'NO_CONVERGENCE' | 'NUMERICAL_RANGE'; value: null; logValue: null };

// B(df/2, 1/2), using integer/half-integer recurrence. Avoids a new special-function dependency.
function logBetaHalf(df: number) {
  let a = df % 2 ? 0.5 : 1;
  let value = df % 2 ? Math.log(Math.PI) : Math.log(2);
  while (a < df / 2) {
    value += Math.log1p(-0.5 / (a + 0.5));
    a++;
  }
  return value;
}

// Modified Lentz evaluation of the incomplete-beta continued fraction (DLMF 8.17(v)).
function betaFraction(a: number, b: number, x: number): number | null {
  const floor = (value: number) => (Math.abs(value) < 1e-300 ? (value < 0 ? -1e-300 : 1e-300) : value);
  let c = 1;
  let d = 1 / floor(1 - ((a + b) * x) / (a + 1));
  let h = d;
  for (let m = 1; m <= 512; m++) {
    const even = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 / floor(1 + even * d);
    c = floor(1 + even / c);
    h *= d * c;
    const odd = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 / floor(1 + odd * d);
    c = floor(1 + odd / c);
    const delta = d * c;
    h *= delta;
    if (!Number.isFinite(h) || h <= 0) return null;
    if (Math.abs(delta - 1) <= 8 * Number.EPSILON) return h;
  }
  return null;
}

/** Two-sided Student t probability, supported for the kernel's integer df range.
 * No significance labels or threshold policy. Tail underflow is explicit, never a fabricated exact zero.
 */
export function studentTTwoSided(t: number, df: number): TailProbability {
  const failure = (status: 'INVALID_INPUT' | 'NO_CONVERGENCE' | 'NUMERICAL_RANGE'): TailProbability => ({
    status,
    value: null,
    logValue: null,
  });
  if (!Number.isFinite(t) || !Number.isInteger(df) || df < 1 || df > 2398) return failure('INVALID_INPUT');
  const magnitude = Math.abs(t);
  if (magnitude === 0) return { status: 'OK', value: 1, logValue: 0 };
  if (df === 1) {
    const value = (2 / Math.PI) * Math.atan(1 / magnitude);
    return { status: 'OK', value, logValue: Math.log(value) };
  }
  const ratio = magnitude / Math.sqrt(df);
  const square = ratio * ratio;
  const logX = Number.isFinite(square) ? -Math.log1p(square) : -2 * Math.log(ratio);
  const x = Math.exp(logX);
  // Form the complement directly for t near zero instead of subtracting x from 1.
  const complement = Number.isFinite(square) ? square / (1 + square) : 1;
  const a = df / 2,
    b = 0.5;
  const logBeta = logBetaHalf(df);
  let logValue: number;
  if (x < (a + 1) / (a + b + 2)) {
    const fraction = betaFraction(a, b, x);
    if (fraction === null) return failure('NO_CONVERGENCE');
    logValue = a * logX + b * Math.log1p(-x) - logBeta + Math.log(fraction / a);
  } else {
    if (complement === 0) return { status: 'OK', value: 1, logValue: 0 };
    const fraction = betaFraction(b, a, complement);
    if (fraction === null) return failure('NO_CONVERGENCE');
    const otherLog = b * Math.log(complement) + a * Math.log1p(-complement) - logBeta + Math.log(fraction / b);
    const other = Math.exp(otherLog);
    if (other >= 1 || !Number.isFinite(other)) return failure('NUMERICAL_RANGE');
    logValue = Math.log1p(-other);
  }
  if (!Number.isFinite(logValue) || logValue > 0) return failure('NUMERICAL_RANGE');
  const value = Math.exp(logValue);
  return value === 0 ? { status: 'UNDERFLOW', value: null, logValue } : { status: 'OK', value, logValue };
}
