import Link from 'next/link';

export function Performance({ organisationId }: { organisationId: string }) {
  return (
    <div className="performance-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MONTHLY PERFORMANCE</span>
          <h1>Performance</h1>
          <p>
            Use the monthly model below to interpret space-conditioning consumption and investigate baseload changes.
          </p>
        </div>
      </div>

      <section className="panel performance-introduction" aria-labelledby="performance-method-title">
        <h2 id="performance-method-title">Monthly performance method</h2>
        <p>
          Fixed baseline coefficients are applied to each reporting month. The calculation is available only after the
          selected regression model passes its workbook validity checks for R², coefficient p-values and model error.
        </p>
        <div
          className="analysis-table performance-table"
          role="region"
          aria-label="Monthly performance model"
          tabIndex={0}
        >
          <table>
            <caption>Monthly space-conditioning performance model</caption>
            <thead>
              <tr>
                <th scope="col">Data item</th>
                <th scope="col">Heating-only model</th>
                <th scope="col">Cooling-only model</th>
                <th scope="col">Combined HDD + CDD model</th>
                <th scope="col">Interpretation and control</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Expected consumption</th>
                <td>c + b × HDD</td>
                <td>c + b × CDD</td>
                <td>b₀ + (b₁ × HDD) + (b₂ × CDD)</td>
                <td>The fixed baseline expectation for the reporting month, in kWh.</td>
              </tr>
              <tr>
                <th scope="row">Space-conditioning component</th>
                <td>b × HDD</td>
                <td>b × CDD</td>
                <td>Heating: b₁ × HDD; cooling: b₂ × CDD</td>
                <td>
                  Use a heating or cooling label only when the meter is dedicated to, or dominated by, that end use.
                </td>
              </tr>
              <tr>
                <th scope="row">Actual consumption</th>
                <td>Recorded monthly consumption</td>
                <td>Recorded monthly consumption</td>
                <td>Recorded monthly consumption</td>
                <td>
                  Compare like-for-like monthly kWh values. Normalise to kWh/day when billing periods have different
                  lengths.
                </td>
              </tr>
              <tr>
                <th scope="row">Performance result</th>
                <td>Expected − actual</td>
                <td>Expected − actual</td>
                <td>Expected − actual</td>
                <td>
                  Positive is a saving and negative is waste. This is the one total variance reported for the month.
                </td>
              </tr>
              <tr>
                <th scope="row">Current implied baseload</th>
                <td>Actual − (b × HDD)</td>
                <td>Actual − (b × CDD)</td>
                <td>Actual − (b₁ × HDD) − (b₂ × CDD)</td>
                <td>The current non-weather portion of consumption.</td>
              </tr>
              <tr>
                <th scope="row">Baseload anomaly</th>
                <td>Current implied baseload − c</td>
                <td>Current implied baseload − c</td>
                <td>Current implied baseload − b₀</td>
                <td>
                  Positive means above baseline and negative means below baseline. It is diagnostic only and is never
                  added to the saving or waste result.
                </td>
              </tr>
              <tr>
                <th scope="row">Significance and boundary</th>
                <td colSpan={3}>Flag only when |saving/waste| ≥ 2 × SEreg.</td>
                <td>
                  For a combined HDD + CDD meter, do not allocate the single total variance to heating, cooling or
                  baseload unless suitable submeters or an agreed end-use method exists. Use occupancy-hours as an
                  investigation aid, not proof of cause.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel performance-next-steps" aria-labelledby="performance-next-steps-title">
        <h2 id="performance-next-steps-title">Run a monthly calculation</h2>
        <p>
          Set up a baseline and reporting run with the relevant HDD and CDD inputs, then review the resulting monthly
          saving, waste and baseload diagnostic values.
        </p>
        <div className="button-row">
          <Link className="button button-primary" href={`/org/${organisationId}/analysis`}>
            Open Advanced Analysis
          </Link>
          <Link className="button button-secondary" href={`/org/${organisationId}/waste-savings`}>
            View Waste &amp; Savings
          </Link>
        </div>
      </section>
    </div>
  );
}
