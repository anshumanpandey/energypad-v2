import { formatEnergyValue } from './format-energy-value';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { carbonSummaryInput } from '@/domain/carbon';
import { factorBases } from '@/domain/emission-factors';
import type { Actor } from '@/server/foundation';
import { accessible } from '@/server/page-auth';
import { analysisService, carbonService } from '@/server/services';
import { MetricChart, type ChartPoint } from './metric-chart';
import { GraphMonthProvider, GraphMonthSelect } from './graph-month';
import { Button } from './ui/button';

export async function Graphs({
  actor,
  organisationId,
  sites,
  query,
}: {
  actor: Actor;
  organisationId: string;
  sites: { id: string; name: string }[];
  query: Record<string, string | string[] | undefined>;
}) {
  const text = (key: string, fallback = '') => (typeof query[key] === 'string' ? (query[key] as string) : fallback);
  const siteId = text('site', sites[0]?.id);
  if (siteId && !sites.some((site) => site.id === siteId)) notFound();
  const definition = carbonSummaryInput.safeParse({
    year: Number(text('year', String(new Date().getUTCFullYear()))),
    geography: text('geography', 'GB'),
    basis: text('basis', 'LOCATION_BASED'),
  });
  const base = `/org/${organisationId}`;
  const data =
    siteId && definition.success
      ? await accessible(async () => {
          const [overview, emissions, runs] = await Promise.all([
            carbonService.overview(actor, organisationId, siteId, definition.data),
            carbonService.chartEmissions(actor, organisationId, siteId, definition.data),
            analysisService.wasteRuns(actor, organisationId, siteId, { limit: 50 }),
          ]);
          const runId = text('run') || runs.items[0]?.id;
          const waste = runId ? await analysisService.wasteSummary(actor, organisationId, siteId, runId) : null;
          return { overview, emissions, runs, waste, runId };
        })
      : null;
  const year = definition.success ? definition.data.year : null;
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const wastePoints: ChartPoint[] = months.map((month) => {
    const row = data?.waste?.impact.rows.find((r) => r.month === month);
    return {
      month,
      value: row?.status === 'CALCULATED' ? row.postNraVarianceKwh : null,
      note: !row
        ? 'No saved reporting result for this month'
        : row.status === 'BLOCKED'
          ? row.issues.map((issue) => issue.message).join('; ')
          : `${row.direction.replaceAll('_', ' ')} · actual ${formatEnergyValue(row.actualKwh)} kWh · adjusted expected ${formatEnergyValue(row.adjustedExpectedKwh)} kWh`,
    };
  });
  return (
    <GraphMonthProvider>
      <div className="graphs-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">PERFORMANCE AT A GLANCE</span>
            <h1>Graphs</h1>
            <p>Explore monthly consumption, emissions and calculated waste or savings.</p>
          </div>
        </div>
        {!sites.length ? (
          <section className="panel">
            <h2>Add a site to view charts</h2>
            <p>Your charts will appear as readings and calculations become available.</p>
            <Link href={`${base}/sites`}>Manage sites</Link>
          </section>
        ) : (
          <>
            <form method="get" className="panel stack-form" aria-label="Graph filters">
              <div className="form-grid">
                <label>
                  Site
                  <select name="site" defaultValue={siteId}>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Calendar year
                  <input
                    type="number"
                    name="year"
                    min="1900"
                    max="2199"
                    required
                    defaultValue={text('year', String(new Date().getUTCFullYear()))}
                  />
                </label>
                <GraphMonthSelect />
                <label>
                  Carbon geography
                  <input
                    name="geography"
                    required
                    pattern="[A-Za-z0-9_-]{2,40}"
                    defaultValue={text('geography', 'GB')}
                  />
                </label>
                <label>
                  Carbon reporting basis
                  <select name="basis" defaultValue={text('basis', 'LOCATION_BASED')}>
                    {factorBases.map((basis) => (
                      <option key={basis}>{basis}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Button type="submit">Update charts</Button>
            </form>
            {!definition.success && (
              <p role="alert">Choose a year from 1900 to 2199, a valid geography and reporting basis.</p>
            )}
            {data && (
              <>
                <p className="page-note">
                  {sites.find((s) => s.id === siteId)?.name} · January–December {year}. Consumption and emissions
                  include registered active meters, which may overlap; these are not a net site inventory.
                </p>
                <div className="graphs-grid">
                  <MetricChart
                    title="Consumption"
                    unit="kWh"
                    tone="energy"
                    description="Monthly consumption with complete active-meter coverage."
                    points={data.overview.energy.months.map((m) => ({
                      month: m.month,
                      value: m.kwh,
                      note: m.kwh === null ? 'Incomplete coverage' : '',
                    }))}
                  />
                  <MetricChart
                    title="Emissions"
                    unit="kgCO2e"
                    tone="carbon"
                    description="Calculated from current consumption × matching emission factors. No saved carbon run is required."
                    points={data.emissions.map((m) => ({
                      month: m.month,
                      value: m.kgCO2e,
                      note: `${m.readyMeters}/${m.expectedMeters} meters ready${m.issues.length ? ` · ${m.issues.join('; ')}` : ''}`,
                    }))}
                  />
                </div>
                <section className="panel stack-form">
                  <h2>Choose waste calculation</h2>
                  <p>
                    Waste is measured against a saved expected-consumption baseline for one meter. It is experimental
                    and does not represent verified savings. The chart shows only months in the selected calendar year.
                  </p>
                  <form method="get" className="stack-form" aria-label="Waste calculation selection">
                    <input type="hidden" name="site" value={siteId} />
                    <input type="hidden" name="year" value={String(year)} />
                    <input type="hidden" name="geography" value={text('geography', 'GB')} />
                    <input type="hidden" name="basis" value={text('basis', 'LOCATION_BASED')} />
                    <label>
                      Saved analysis run
                      <input
                        name="run"
                        list="graph-waste-runs"
                        defaultValue={data.runId ?? ''}
                        placeholder="Select or paste a saved run ID"
                      />
                    </label>
                    <datalist id="graph-waste-runs">
                      {data.runs.items.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.createdAt.toISOString()} · meter {r.meterId}
                        </option>
                      ))}
                    </datalist>
                    <p>Latest 50 runs suggested. Paste an older saved run ID to view it.</p>
                    <Button type="submit">Show waste chart</Button>
                  </form>
                  {data.waste ? (
                    <p>
                      Meter {data.waste.meterId} · saved {data.waste.createdAt} · run {data.waste.runId}
                    </p>
                  ) : (
                    <p>No saved analysis runs for this site.</p>
                  )}
                  <Link href={`${base}/analysis`}>Create or review an analysis run</Link>
                </section>
                <MetricChart
                  title="Waste & savings"
                  unit="kWh"
                  tone="waste"
                  description="Adjusted expected minus actual consumption: positive values indicate potential savings; negative values indicate waste. Includes saved non-routine adjustments."
                  points={wastePoints}
                />
                <div className="graph-source-links">
                  <Link href={`${base}/energy`}>Consumption records</Link>
                  <Link href={`${base}/carbon`}>Carbon calculations</Link>
                  <Link href={`${base}/waste-savings?site=${siteId}${data.runId ? `&run=${data.runId}` : ''}`}>
                    Waste calculation details
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </GraphMonthProvider>
  );
}
