'use client';
import type { UtilityGraphRow, UtilityCostTarget } from '@/domain/utility-graphs';
import { utilityComparison } from '@/domain/utility-comparison';
import { carbonRollingComparison, carbonRecentSummary } from '@/domain/carbon-footprint';
import { utilityLabel } from '@/domain/consumption-sort';
import { formatEnergyValue } from './format-energy-value';
import { UtilityBars } from './utility-bars';

const colors = ['#168578', '#4989c6', '#cd7334', '#9b4c9e', '#578138', '#b74655'];
export function CarbonFootprintCharts({
  rows,
  history,
  targets,
  year,
  month,
  fuel,
  view,
}: {
  rows: UtilityGraphRow[];
  history: UtilityGraphRow[];
  targets: UtilityCostTarget[];
  year: string;
  month: string;
  fuel: string;
  view: 'graph' | 'table';
}) {
  const comparison = utilityComparison(rows, targets, fuel);
  const recent = carbonRollingComparison(history, targets, year, month, fuel);
  const summary = carbonRecentSummary(recent);
  const fuels = [...new Set(history.filter((r) => recent.some((p) => p.month === r.month)).map((r) => r.fuel))].sort();
  const maximum = Math.max(
    1,
    ...history.filter((r) => recent.some((p) => p.month === r.month)).map((r) => Number(r.emissions ?? 0)),
  );
  const gaugeMaximum = Math.max(100, ...recent.map((p) => Number(p.percent ?? 0)));
  return (
    <>
      {view === 'graph' ? (
        <UtilityBars
          points={comparison.map((r) => ({ month: r.month, actual: r.emissions, target: r.targetCarbon }))}
          title="Actual vs target emissions"
          unit="kgCO2e"
          diverging
          selectedMonth={month}
        />
      ) : (
        <section className="panel">
          <h2>Actual vs target emissions</h2>
          <div className="analysis-table" role="region" aria-label="Actual vs target emissions table" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Actual (kgCO2e)</th>
                  <th>Target (kgCO2e)</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((r) => (
                  <tr key={r.month} className={r.month.slice(5, 7) === month ? 'utility-selected-month' : undefined}>
                    <th>{r.month}</th>
                    <td>{formatEnergyValue(r.emissions, 'Unavailable')}</td>
                    <td>{formatEnergyValue(r.targetCarbon, 'Unavailable')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {fuel && (
        <p className="page-note">
          A fuel-specific carbon target is required when a fuel is selected. Site-wide targets are shown with All fuels.
        </p>
      )}
      {!recent.length ? (
        <section className="panel">
          <p>Select a month to view the carbon gauge and recent emissions comparison.</p>
        </section>
      ) : (
        <div className="graphs-grid">
          <section className="panel utility-lines" aria-label="Carbon gauge">
            <h2>Carbon gauge</h2>
            <p>
              Actual emissions as a percentage of the carbon target, for the selected month and preceding three months.
              100% meets the target; higher values exceed it.
            </p>
            <p>
              Comparison through {year}-{month}.
            </p>
            {view === 'graph' ? (
              <div className="utility-chart-scroll">
                <svg
                  viewBox="0 0 760 310"
                  role="img"
                  aria-label="Carbon gauge for selected month and previous three months"
                >
                  <title>Monthly emissions as percentage of target</title>
                  {recent.map((point, index) => {
                    const x = 130 + index * 170;
                    const selected = point.month.slice(5, 7) === month;
                    const value = point.percent === null ? null : Number(point.percent);
                    const size = ((value ?? 0) / gaugeMaximum) * 175;
                    const targetY = 230 - (100 / gaugeMaximum) * 175;
                    const label = `${point.month}: ${point.percent === null ? point.issue : `${point.percent}% of target`}`;
                    return (
                      <g
                        key={point.month}
                        tabIndex={0}
                        role="img"
                        aria-label={label}
                        data-selected-month={selected ? point.month : undefined}
                      >
                        <title>{label}</title>
                        {selected && <rect x={x - 72} y="20" width="145" height="275" rx="12" fill="#e9f3dc" />}
                        <text x={x} y="40" textAnchor="middle" fontSize="14" fontWeight={selected ? 'bold' : 'normal'}>
                          {point.month}
                        </text>
                        <rect x={x - 22} y="55" width="44" height="175" rx="22" fill="#edf1ef" />
                        {value !== null && (
                          <rect
                            x={x - 22}
                            y={230 - size}
                            width="44"
                            height={Math.max(value === 0 ? 3 : 0, size)}
                            rx="12"
                            fill={value > 100 ? '#b74655' : '#168578'}
                          />
                        )}
                        <line
                          x1={x - 32}
                          x2={x + 32}
                          y1={targetY}
                          y2={targetY}
                          stroke="#4b635c"
                          strokeDasharray="4 3"
                        />
                        <text x={x + 35} y={targetY + 5} fontSize="10">
                          100%
                        </text>
                        <text x={x} y="255" textAnchor="middle" fontSize="16" fontWeight="bold">
                          {point.percent !== null ? `${point.percent}%` : 'Unavailable'}
                        </text>
                        <text x={x} y="278" textAnchor="middle" fontSize="12">
                          {formatEnergyValue(point.actual, 'Unavailable')} kgCO2e
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="analysis-table" role="region" aria-label="Carbon gauge table" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Actual kgCO2e</th>
                      <th>Target kgCO2e</th>
                      <th>Target used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((p) => (
                      <tr
                        key={p.month}
                        className={p.month.slice(5, 7) === month ? 'utility-selected-month' : undefined}
                      >
                        <th>{p.month}</th>
                        <td>{formatEnergyValue(p.actual, 'Unavailable')}</td>
                        <td>{formatEnergyValue(p.target, 'Unavailable')}</td>
                        <td>{p.percent !== null ? `${p.percent}%` : p.issue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="page-note">
              Missing emissions or targets are unavailable. A zero target has no percentage ratio.
            </p>
          </section>
          <section className="panel utility-lines" aria-label="Recent carbon emissions">
            <h2>Carbon emissions · selected month vs previous three months</h2>
            <p>
              Selected month: {formatEnergyValue(summary.current, 'Unavailable')} kgCO2e. Previous three months average:{' '}
              {formatEnergyValue(summary.previousAverage, 'Unavailable')} kgCO2e.
            </p>
            {view === 'graph' ? (
              <div className="utility-chart-scroll">
                <svg
                  viewBox="0 0 760 310"
                  role="img"
                  aria-label="Carbon emissions by fuel for selected month and previous three months"
                >
                  <title>Monthly carbon emissions by fuel in kgCO2e</title>
                  {[0, 0.5, 1].map((fraction) => (
                    <g key={fraction}>
                      <line x1="80" x2="720" y1={240 - fraction * 180} y2={240 - fraction * 180} stroke="#dce5e3" />
                      <text x="70" y={244 - fraction * 180} textAnchor="end" fontSize="12">
                        {Intl.NumberFormat('en', { notation: 'compact' }).format(maximum * fraction)}
                      </text>
                    </g>
                  ))}
                  {recent.map((point, index) => (
                    <g
                      key={point.month}
                      data-selected-month={point.month.slice(5, 7) === month ? point.month : undefined}
                    >
                      {point.month.slice(5, 7) === month && (
                        <rect x={80 + index * 160} y="40" width="160" height="205" fill="#e9f3dc" />
                      )}
                      <text
                        x={160 + index * 160}
                        y="270"
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight={point.month.slice(5, 7) === month ? 'bold' : 'normal'}
                      >
                        {point.month}
                      </text>
                      {fuels.map((fuelName, fuelIndex) => {
                        const row = history.find((r) => r.month === point.month && r.fuel === fuelName);
                        const value = row?.emissions ?? null;
                        const width = 110 / Math.max(1, fuels.length);
                        const x = 100 + index * 160 + fuelIndex * width;
                        const size = (Number(value ?? 0) / maximum) * 180;
                        return (
                          <g
                            key={fuelName}
                            tabIndex={0}
                            role="img"
                            aria-label={`${point.month}, ${utilityLabel(fuelName)}: ${value ?? 'Unavailable'} kgCO2e`}
                          >
                            <title>
                              {point.month} · {utilityLabel(fuelName)}: {value ?? 'Unavailable'} kgCO2e
                            </title>
                            {value === null ? (
                              <text x={x + width / 2} y="235" textAnchor="middle">
                                —
                              </text>
                            ) : (
                              <>
                                <rect
                                  x={x}
                                  y={240 - size}
                                  width={width * 0.8}
                                  height={size}
                                  fill={colors[fuelIndex % colors.length]}
                                />
                                {Number(value) === 0 && (
                                  <circle
                                    cx={x + width * 0.4}
                                    cy="240"
                                    r="3"
                                    fill={colors[fuelIndex % colors.length]}
                                  />
                                )}
                              </>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  ))}
                </svg>
                <ul className="utility-chart-legend">
                  {fuels.map((f, i) => (
                    <li key={f}>
                      <span style={{ background: colors[i % colors.length] }} />
                      {utilityLabel(f)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="analysis-table" role="region" aria-label="Recent carbon emissions table" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Fuel</th>
                      <th>Emissions (kgCO2e)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.flatMap((p) =>
                      fuels.length
                        ? fuels.map((f) => (
                            <tr
                              key={`${p.month}-${f}`}
                              className={p.month.slice(5, 7) === month ? 'utility-selected-month' : undefined}
                            >
                              <th>{p.month}</th>
                              <td>{utilityLabel(f)}</td>
                              <td>
                                {formatEnergyValue(
                                  history.find((r) => r.month === p.month && r.fuel === f)?.emissions,
                                  'Unavailable',
                                )}
                              </td>
                            </tr>
                          ))
                        : [
                            <tr key={p.month}>
                              <th>{p.month}</th>
                              <td>—</td>
                              <td>Unavailable</td>
                            </tr>,
                          ],
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
