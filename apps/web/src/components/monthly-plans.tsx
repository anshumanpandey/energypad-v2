'use client';
import { useEffect, useRef, useState } from 'react';
import { request, useMutation } from './forms';
import { Button } from './ui/button';
import { CarbonImports } from './carbon-imports';
import { fuels } from '@/domain/tariffs';
import type { MonthlyPlanPayload } from '@/domain/monthly-plans';
type Row = {
  id: string;
  month: string;
  kind: string;
  fuel: string;
  unit: string;
  revision: number;
  correctionReason: string | null;
  replacement: { id: string } | null;
  payload: MonthlyPlanPayload;
};
export function MonthlyPlans({
  organisationId,
  sites,
  canWrite,
}: {
  organisationId: string;
  sites: { id: string; name: string; archived?: boolean }[];
  canWrite: boolean;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState('');
  const key = useRef<string | null>(null);
  const mutation = useMutation();
  const writable = canWrite && !sites.find((s) => s.id === siteId)?.archived;
  const base = `organisations/${organisationId}/sites/${siteId}`;
  useEffect(() => {
    let active = true;
    if (siteId && Number.isInteger(year) && year >= 1900 && year <= 2199)
      void request(`${base}/monthly-plans?year=${year}`, 'GET')
        .then((data) => {
          if (active) setRows(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [base, siteId, year, generation]);
  const reset = () => {
    setRows([]);
    setSelected(null);
    setError('');
    key.current = null;
  };
  const refresh = () => {
    reset();
    setGeneration((v) => v + 1);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TARGETS AND MONITORING</span>
          <h1>Monthly targets &amp; monitoring</h1>
          <p>
            Consumption/carbon targets and utility-monitoring plans are separate from actual readings, baseline
            predictions and verified savings.
          </p>
        </div>
      </div>
      {!sites.length ? (
        <p>Add a site to begin.</p>
      ) : (
        <>
          <section className="panel stack-form">
            <div className="form-grid">
              <label>
                Plan site
                <select
                  value={siteId}
                  disabled={mutation.disabled}
                  onChange={(e) => {
                    reset();
                    setSiteId(e.target.value);
                  }}
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.archived ? ' (archived)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Plan year
                <input
                  type="number"
                  min="1900"
                  max="2199"
                  value={year}
                  disabled={mutation.disabled}
                  onChange={(e) => {
                    reset();
                    setYear(Number(e.target.value));
                  }}
                />
              </label>
            </div>
          </section>
          {error && <p role="alert">{error}</p>}
          {writable && (
            <section className="panel stack-form">
              <h2>{selected ? 'Correct monthly record' : 'Add monthly record'}</h2>
              {mutation.feedback}
              <form
                key={`${siteId}-${year}-${generation}-${selected?.id ?? 'new'}`}
                className="stack-form"
                onChange={() => {
                  key.current = null;
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = Object.fromEntries(new FormData(form));
                  void mutation.run(async () => {
                    const { reason, ...fields } = data;
                    const plan = { ...fields, requestKey: key.current ?? (key.current = crypto.randomUUID()) };
                    await request(
                      `${base}/monthly-plans${selected ? `/${selected.id}/correct` : ''}`,
                      'POST',
                      selected ? { plan, reason } : plan,
                    );
                    form.reset();
                    key.current = null;
                    setSelected(null);
                    refresh();
                  }, 'Monthly records saved.');
                }}
              >
                <fieldset disabled={mutation.disabled} className="stack-form" style={{ border: 0, padding: 0 }}>
                  <div className="form-grid">
                    <label>
                      Record kind
                      <select name="kind" defaultValue={selected?.kind ?? 'TARGET'}>
                        {['TARGET', 'MONITORING'].map((kind) => (
                          <option key={kind}>{kind}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Month or all months
                      <input
                        name="month"
                        required
                        pattern="(19|20|21)[0-9]{2}-(0[1-9]|1[0-2]|ALL)"
                        defaultValue={selected?.month ?? `${year}-01`}
                      />
                    </label>
                    <label>
                      Fuel
                      <select name="fuel" defaultValue={selected?.fuel ?? 'ELECTRICITY'}>
                        {fuels.map((fuel) => (
                          <option key={fuel}>{fuel}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Source unit
                      <select name="unit" defaultValue={selected?.unit ?? 'kWh'}>
                        {['kWh', 'MWh', 'm3', 'litre', 'kg'].map((unit) => (
                          <option key={unit}>{unit}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Monthly energy quantity
                      <input name="energy" required inputMode="decimal" defaultValue={selected?.payload.energy} />
                    </label>
                    <label>
                      Monthly carbon kgCO2e
                      <input name="carbon" inputMode="decimal" defaultValue={selected?.payload.carbon} />
                    </label>
                    <label>
                      Conversion factor (kWh per source unit)
                      <input
                        name="conversionFactor"
                        required
                        defaultValue={selected?.payload.conversionFactor ?? '1'}
                      />
                    </label>
                    <label>
                      Monitoring end-use codes
                      <input
                        name="energyUseCodes"
                        placeholder="HEATING;LIGHTING"
                        defaultValue={selected?.payload.energyUseCodes}
                      />
                    </label>
                    <label>
                      Source / conversion reference
                      <input name="source" required minLength={3} defaultValue={selected?.payload.source} />
                    </label>
                    <label>
                      Legacy reference (optional)
                      <input name="externalLegacyId" defaultValue={selected?.payload.externalLegacyId} />
                    </label>
                    {selected && (
                      <label>
                        Correction reason
                        <input name="reason" required minLength={3} />
                      </label>
                    )}
                  </div>
                  <p>
                    Use YYYY-ALL to repeat the same monthly values twelve times. Carbon is optional for targets and
                    required for monitoring. Use 1 for kWh, 1000 for MWh, or an explicit sourced factor for physical
                    units. Monitoring end-use links are tags on one record; they do not multiply the quantity.
                    Corrections keep the same kind, month, fuel and unit.
                  </p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Button type="submit">{selected ? 'Save correction' : 'Save monthly records'}</Button>
                    {selected && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setSelected(null);
                          key.current = null;
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </fieldset>
              </form>
              <CarbonImports key={siteId} base={base} canFactors={false} monthlyOnly onCommitted={refresh} />
            </section>
          )}
          <section className="panel stack-form">
            <h2>Saved monthly records · {year}</h2>
            <p>
              Corrections append versions; previous values remain available. These plan values are not measured or
              verified results.
            </p>
            {!rows.length && <p>No records for this site/year.</p>}
            <div className="analysis-table" role="region" aria-label="Monthly plan history" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Month / kind</th>
                    <th>Fuel / source value</th>
                    <th>Normalised kWh</th>
                    <th>Carbon kgCO2e</th>
                    <th>End uses</th>
                    <th>Version / source</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <th>
                        {r.month} · {r.kind}
                      </th>
                      <td>
                        {r.fuel} · {r.payload.energy} {r.unit}
                      </td>
                      <td>{r.payload.normalizedKwh}</td>
                      <td>{r.payload.carbon || 'Not supplied'}</td>
                      <td>{r.payload.energyUses.map((u) => `${u.code}: ${u.name}`).join('; ') || 'None'}</td>
                      <td>
                        Revision {r.revision} · {r.replacement ? 'Superseded' : 'Current'}
                        <p>
                          {r.payload.source} · factor {r.payload.conversionFactor} · {r.payload.conversionVersion}
                        </p>
                        <small>
                          {r.id} · {r.payload.externalLegacyId} · {r.correctionReason}
                        </small>
                      </td>
                      <td>
                        {writable && !r.replacement && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setSelected(r);
                              key.current = null;
                            }}
                          >
                            Correct
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
