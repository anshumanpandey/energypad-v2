"""Generate synthetic test references independently of the TypeScript QR/beta algorithms.

Standard-library Fraction matrix inversion + adaptive Simpson integration of the
Student-t density after t=sqrt(df)*cot(theta). Not approved workbook evidence.
"""
from fractions import Fraction as F
import argparse
import json
import math
from pathlib import Path


def tail(t, df):
    if t == 0:
        return 1.0
    angle = math.atan(math.sqrt(df) / abs(t))
    log_sin = math.log(math.sin(angle))

    def f(x):
        if df == 1:
            return 1.0
        if x == 0:
            return 0.0
        return math.exp((df - 1) * (math.log(math.sin(angle * x)) - log_sin))

    def integrate(a, b, fa, fm, fb, area, tolerance, depth):
        middle = (a + b) / 2
        left_mid = f((a + middle) / 2)
        right_mid = f((middle + b) / 2)
        left = (middle - a) / 6 * (fa + 4 * left_mid + fm)
        right = (b - middle) / 6 * (fm + 4 * right_mid + fb)
        error = left + right - area
        if abs(error) <= 15 * tolerance:
            return left + right + error / 15
        if depth == 0:
            raise ValueError('Independent quadrature did not converge')
        return (integrate(a, middle, fa, left_mid, fm, left, tolerance / 2, depth - 1)
                + integrate(middle, b, fm, right_mid, fb, right, tolerance / 2, depth - 1))

    fa, fm, fb = f(0), f(0.5), f(1)
    integral = integrate(0, 1, fa, fm, fb, (fa + 4 * fm + fb) / 6, 2e-14, 30)
    log_probability = (math.log(2) + math.lgamma((df + 1) / 2) - math.lgamma(df / 2)
                       - 0.5 * math.log(math.pi) + math.log(angle)
                       + (df - 1) * log_sin + math.log(integral))
    return math.exp(log_probability)


def reference():
    fixture = json.loads((Path(__file__).resolve().parents[1] / 'apps/web/tests/fixtures/regression-rational.json').read_text())
    rows = [[F(1)] + list(map(F, r)) for r in fixture['x']]
    k = len(rows[0])
    augmented = [[sum(r[i] * r[j] for r in rows) for j in range(k)]
                 + [F(int(i == j)) for j in range(k)] for i in range(k)]
    for i in range(k):
        pivot = next(j for j in range(i, k) if augmented[j][i])
        augmented[i], augmented[pivot] = augmented[pivot], augmented[i]
        scale = augmented[i][i]
        augmented[i] = [v / scale for v in augmented[i]]
        for j in range(k):
            if j != i:
                scale = augmented[j][i]
                augmented[j] = [v - scale * w for v, w in zip(augmented[j], augmented[i])]
    inverse = [r[k:] for r in augmented]
    coefficients = list(map(F, fixture['coefficientFractions']))
    residuals = [F(y) - sum(v * b for v, b in zip(r, coefficients)) for r, y in zip(rows, fixture['y'])]
    df = len(rows) - k
    variance = sum(r*r for r in residuals) / df
    covariance = [[float(v * variance) for v in row] for row in inverse]
    errors = [math.sqrt(covariance[i][i]) for i in range(k)]
    t_values = [float(v) / error for v, error in zip(coefficients, errors)]
    return {
        'purpose': 'Synthetic inference reference: exact rational covariance and independent adaptive Simpson Student-t integration. Not a golden workbook.',
        'covariance': covariance, 'standardErrors': errors, 'tStatistics': t_values,
        'pValues': [tail(t, df) for t in t_values],
        'studentT': [{'df': df, 't': t, 'p': tail(t, df)}
                     for df in [1, 2, 3, 8, 30, 120, 2398]
                     for t in [0, 0.001, 1, 2.5, 10, 30]],
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', help='New JSON fixture file')
    args = parser.parse_args()
    with Path(args.output).open('x') as stream:
        json.dump(reference(), stream, indent=2, allow_nan=False)
        stream.write('\n')
