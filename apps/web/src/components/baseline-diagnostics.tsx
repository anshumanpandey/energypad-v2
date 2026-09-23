import type { RegressionInterpretation } from '../domain/analysis/interpretation';
import type { RegressionResult } from '../domain/analysis/regression';
import type { CoefficientStatistic } from '../domain/analysis/inference';

function Value({ value }: { value: number }) {
  const magnitude = Math.abs(value);
  const text =
    magnitude > 0 && (magnitude < 0.001 || magnitude >= 1e7)
      ? value.toExponential(5)
      : value.toLocaleString('en-US', { maximumSignificantDigits: 6 });
  return <span title={String(value)}>{text}</span>;
}
const reasons = {
  ZERO_RESIDUAL_VARIANCE: 'Undefined: zero residual variance',
  T_OVERFLOW: 'Unavailable: t statistic exceeds numeric range',
  INVALID_INPUT: 'Unavailable: invalid statistical input',
  NO_CONVERGENCE: 'Unavailable: probability did not converge',
  NUMERICAL_RANGE: 'Unavailable: numeric range exceeded',
};
function Probability({ statistic }: { statistic: CoefficientStatistic | undefined }) {
  if (!statistic) return <span>{reasons.NUMERICAL_RANGE}</span>;
  const p = statistic.probability;
  if (p.status === 'OK') return <Value value={p.value} />;
  if (p.status === 'UNDERFLOW')
    return (
      <span>
        Below numeric range; ln(p) = <Value value={p.logValue} />
      </span>
    );
  return <span>{reasons[p.status]}</span>;
}
export function BaselineDiagnostics({
  fit,
  observations,
  interpretation,
}: {
  fit: RegressionResult;
  interpretation?: RegressionInterpretation;
  observations: { consumption: { id: string; month: string } }[];
}) {
  if (fit.status !== 'FITTED') return null;
  const months = new Map(observations.map(({ consumption }) => [consumption.id, consumption.month]));
  const terms = [
    { code: null, label: 'Intercept', value: fit.intercept, unit: fit.responseUnit },
    ...fit.coefficients.map((c) => ({
      code: c.code,
      label: c.code,
      value: c.value,
      unit: `${fit.responseUnit} / ${c.unit}`,
    })),
  ];
  return (
    <details>
      <summary>Regression diagnostics</summary>
      <p>
        Experimental · unvalidated. Values are displayed to six significant digits; full precision remains in
        provenance. No statistical acceptance decision is implied.
      </p>
      {interpretation ? (
        <div role="note" aria-label="Saved statistical interpretation">
          <p>
            <strong>R² verdict: {interpretation.rSquared.label}</strong>
          </p>
          <p>
            Saved policy: {interpretation.policy.version} · {interpretation.policy.status.toLowerCase()}. These labels
            do not approve a model, verify savings or replace workbook acceptance.
          </p>
          <details>
            <summary>Saved interpretation rules</summary>
            <p>{interpretation.policy.pValueSource}</p>
            <ul>
              {interpretation.policy.pBands.map((b) => (
                <li key={b.code}>
                  p ≤ {b.maximumInclusive}: {b.label} (first matching band)
                </li>
              ))}
            </ul>
            <p>{interpretation.policy.rSquaredSource}</p>
            <ul>
              {interpretation.policy.rSquaredBands.map((b) => (
                <li key={b.code}>
                  R² ≥ {b.minimumInclusive}: {b.label} (first matching band)
                </li>
              ))}
            </ul>
            <p>Otherwise: {interpretation.policy.rSquaredFallback.label}. Undefined statistics are not classified.</p>
          </details>
        </div>
      ) : (
        <p>No interpretation policy was saved with this baseline. Historical values have not been relabelled.</p>
      )}
      <p>
        Residual degrees of freedom: {fit.residualDegreesOfFreedom} · SSE: <Value value={fit.ssResidual} />{' '}
        {fit.responseUnit}² · SST: <Value value={fit.ssTotal} /> {fit.responseUnit}²
      </p>
      {fit.warnings.includes('CONSTANT_RESPONSE') && <p>Consumption is constant; R² is undefined.</p>}
      {fit.warnings.includes('NEGATIVE_FITTED_VALUE') && <p>The model has negative fitted consumption values.</p>}
      <div className="analysis-table" role="region" aria-label="Coefficient diagnostics" tabIndex={0}>
        <table>
          <caption>Model coefficients</caption>
          <thead>
            <tr>
              <th scope="col">Term</th>
              <th scope="col">Unit</th>
              <th scope="col">Estimate</th>
              <th scope="col">Standard error</th>
              <th scope="col">Signed t</th>
              <th scope="col">Two-sided p</th>
              <th scope="col">Saved p-value band</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => {
              const statistic = fit.inference.terms.find((t) =>
                term.code === null ? t.kind === 'INTERCEPT' : t.kind === 'DRIVER' && t.driverCode === term.code,
              );
              return (
                <tr key={term.label}>
                  <th scope="row">{term.label}</th>
                  <td>{term.unit}</td>
                  <td>
                    <Value value={term.value} />
                  </td>
                  <td>{statistic ? <Value value={statistic.standardError} /> : reasons.NUMERICAL_RANGE}</td>
                  <td>
                    {statistic?.tStatistic != null ? (
                      <Value value={statistic.tStatistic} />
                    ) : statistic?.probability.status === 'ZERO_RESIDUAL_VARIANCE' ? (
                      reasons.ZERO_RESIDUAL_VARIANCE
                    ) : statistic?.probability.status === 'T_OVERFLOW' ? (
                      reasons.T_OVERFLOW
                    ) : (
                      reasons.NUMERICAL_RANGE
                    )}
                  </td>
                  <td>
                    <Probability statistic={statistic} />
                  </td>
                  <td>
                    {interpretation?.coefficients.find((t) =>
                      term.code === null ? t.kind === 'INTERCEPT' : t.kind === 'DRIVER' && t.driverCode === term.code,
                    )?.label ?? 'Not recorded'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>Residual = actual − fitted consumption. Source IDs identify the frozen consumption revisions.</p>
      <div className="analysis-table" role="region" aria-label="Baseline residuals" tabIndex={0}>
        <table>
          <caption>Baseline residuals ({fit.responseUnit})</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Actual</th>
              <th scope="col">Fitted</th>
              <th scope="col">Residual</th>
              <th scope="col">Source revision</th>
            </tr>
          </thead>
          <tbody>
            {fit.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{months.get(row.id) ?? 'Month unavailable'}</th>
                <td>
                  <Value value={row.actual} />
                </td>
                <td>
                  <Value value={row.fitted} />
                </td>
                <td>
                  <Value value={row.residual} />
                </td>
                <td>{row.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Coefficient covariance</summary>
        <p>
          Rows and columns follow the coefficient order above. Each cell has the product of its row and column
          coefficient units.
        </p>
        {fit.inference.covariance ? (
          <div className="analysis-table" role="region" aria-label="Coefficient covariance" tabIndex={0}>
            <table>
              <caption>Coefficient covariance matrix</caption>
              <thead>
                <tr>
                  <th scope="col">Term</th>
                  {terms.map((t) => (
                    <th scope="col" key={t.label}>
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fit.inference.covariance.map((row, i) => (
                  <tr key={terms[i].label}>
                    <th scope="row">{terms[i].label}</th>
                    {row.map((value, j) => (
                      <td key={terms[j].label}>
                        <Value value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{reasons.NUMERICAL_RANGE}</p>
        )}
      </details>
    </details>
  );
}
