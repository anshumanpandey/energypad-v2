'use client';
import type { CatalogEntry } from './energy-catalog';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { fuels, rateUnits } from '@/domain/tariffs';
type Band = { name: string; days: number[]; startTime: string; endTime: string; rate: string; legacyId: string };
type Use = {
  fuelCatalog?: CatalogEntry | null;
  endUseCatalog?: CatalogEntry | null;
  id: string;
  code: string;
  name: string;
  fuel: string;
  source: string;
  legacySource: string;
  fuelLegacyId: string;
  endUseLegacyId: string;
  associationLegacyId: string;
  associationLegacyTable: string;
};
type Tariff = {
  id: string;
  energyUseId: string;
  name: string;
  validFrom: string;
  validUntil: string;
  currency: string;
  rateUnit: string;
  taxBasis: string;
  vatPercent: string;
  timezone: string;
  source: string;
  legacySource: string;
  pricingLegacyId: string;
  bands: Band[];
  revision: number;
  correctionReason: string | null;
  authorId: string;
  createdAt: string;
};
export type TariffData = { uses: Use[]; tariffs: Tariff[] };
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const lastDay = (v: string) => new Date(+new Date(v) - 86400000).toISOString().slice(0, 10);
const emptyBand = (): Band => ({ name: '', days: [], startTime: '00:00', endTime: '24:00', rate: '', legacyId: '' });
function TariffDetails({ record: r }: { record: Tariff }) {
  return (
    <div className="stack-form">
      <strong>
        {r.name} · Revision {r.revision}
      </strong>
      <p>
        {r.validFrom.slice(0, 10)} to {lastDay(r.validUntil)} inclusive · {r.timezone}
      </p>
      <p>
        {r.currency} per {r.rateUnit} · {r.taxBasis === 'NET' ? 'Excludes VAT' : 'Includes VAT'} · VAT {r.vatPercent}%
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="import-preview-table">
          <caption>Tariff time bands</caption>
          <thead>
            <tr>
              <th>Band</th>
              <th>Weekdays</th>
              <th>Local time</th>
              <th>Rate</th>
              <th>Legacy band ID</th>
            </tr>
          </thead>
          <tbody>
            {r.bands.map((b, i) => (
              <tr key={i}>
                <td>{b.name}</td>
                <td>{b.days.map((d) => weekdays[d - 1]).join(', ')}</td>
                <td>
                  {b.startTime}–{b.endTime}
                </td>
                <td>
                  {b.rate} {r.currency}/{r.rateUnit}
                </td>
                <td>{b.legacyId || 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Source: {r.source}</p>
      <p>{r.correctionReason || 'Original entry'}</p>
      <details>
        <summary>Tariff provenance</summary>
        <p style={{ overflowWrap: 'anywhere' }}>
          Recorded {new Date(r.createdAt).toLocaleString()} · Author {r.authorId}
          <br />
          Legacy source: {r.legacySource || 'None'} · BusinessFuelsPricing ID: {r.pricingLegacyId || 'None'}
        </p>
      </details>
    </div>
  );
}
function TariffForm({
  base,
  uses,
  record,
  reload,
  cancel,
}: {
  base: string;
  uses: Use[];
  record?: Tariff;
  reload: () => Promise<void>;
  cancel: () => void;
}) {
  const m = useMutation();
  const [bands, setBands] = useState<Band[]>(record?.bands ?? [emptyBand()]);
  const update = (i: number, patch: Partial<Band>) => setBands(bands.map((b, j) => (i === j ? { ...b, ...patch } : b)));
  return (
    <form
      className="stack-form"
      aria-label={record ? 'Correct tariff' : 'Add tariff'}
      onSubmit={(e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        const { reason, ...fields } = values;
        const tariff = { ...fields, energyUseId: record?.energyUseId ?? fields.energyUseId, bands };
        void m.run(async () => {
          await request(record ? `${base}/${record.id}/correct` : base, 'POST', record ? { tariff, reason } : tariff);
          await reload();
          cancel();
        }, 'Tariff saved.');
      }}
    >
      {m.feedback}
      <fieldset className="stack-form" disabled={m.disabled}>
        <div className="form-grid">
          <label>
            Tariff end use
            <select name="energyUseId" defaultValue={record?.energyUseId ?? ''} disabled={!!record} required>
              <option value="">Choose an end use</option>
              {uses.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.code} · {u.name} · {u.fuel}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tariff name
            <input name="name" defaultValue={record?.name} maxLength={100} required />
          </label>
          <label>
            Tariff first day
            <input name="firstDay" type="date" defaultValue={record?.validFrom.slice(0, 10)} required />
          </label>
          <label>
            Tariff last day (inclusive)
            <input name="lastDay" type="date" defaultValue={record ? lastDay(record.validUntil) : ''} required />
          </label>
          <label>
            Tariff currency
            <input name="currency" defaultValue={record?.currency} minLength={3} maxLength={3} required />
          </label>
          <label>
            Rate unit
            <select name="rateUnit" defaultValue={record?.rateUnit ?? ''} required>
              <option value="">Choose a unit</option>
              {rateUnits.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            Rate tax basis
            <select name="taxBasis" defaultValue={record?.taxBasis ?? ''} required>
              <option value="">Choose tax basis</option>
              <option value="NET">Excludes VAT</option>
              <option value="GROSS">Includes VAT</option>
            </select>
          </label>
          <label>
            Tariff VAT percentage
            <input
              name="vatPercent"
              type="number"
              min="0"
              max="100"
              step="0.001"
              defaultValue={record?.vatPercent}
              required
            />
          </label>
          <label>
            Tariff timezone
            <input name="timezone" placeholder="Europe/London" defaultValue={record?.timezone} required />
          </label>
          <label>
            Tariff source
            <input name="source" minLength={3} maxLength={500} defaultValue={record?.source} required />
          </label>
          <label>
            Tariff legacy source system
            <input name="legacySource" maxLength={100} defaultValue={record?.legacySource} />
          </label>
          <label>
            BusinessFuelsPricing legacy ID
            <input name="pricingLegacyId" maxLength={160} defaultValue={record?.pricingLegacyId} />
          </label>
        </div>
        <p>
          Rates use major currency units (for example GBP, not pence). Select weekdays explicitly. Times are local and
          end-exclusive; 24:00 means the end of the day. Split overnight bands into separate rows. Uncovered times have
          no defined rate.
        </p>
        {bands.map((b, i) => (
          <fieldset className="site-history-entry stack-form" key={i}>
            <legend>Time band {i + 1}</legend>
            <div className="form-grid">
              <label>
                Band name
                <input value={b.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={100} required />
              </label>
              <label>
                Band start time
                <input
                  type="time"
                  value={b.startTime}
                  onChange={(e) => update(i, { startTime: e.target.value })}
                  required
                />
              </label>
              <label>
                Band end time
                <input
                  value={b.endTime}
                  placeholder="24:00"
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00"
                  onChange={(e) => update(i, { endTime: e.target.value })}
                  required
                />
              </label>
              <label>
                Band rate
                <input
                  type="number"
                  min="0"
                  max="99999999.999999"
                  step="0.000001"
                  value={b.rate}
                  onChange={(e) => update(i, { rate: e.target.value })}
                  required
                />
              </label>
              <label>
                BusinessBrands legacy ID
                <input value={b.legacyId} maxLength={160} onChange={(e) => update(i, { legacyId: e.target.value })} />
              </label>
            </div>
            <div className="button-row">
              {weekdays.map((d, j) => (
                <label className="checkbox-label" key={d}>
                  <input
                    type="checkbox"
                    checked={b.days.includes(j + 1)}
                    onChange={(e) =>
                      update(i, {
                        days: e.target.checked
                          ? [...b.days, j + 1].sort((a, c) => a - c)
                          : b.days.filter((v) => v !== j + 1),
                      })
                    }
                  />
                  {d}
                </label>
              ))}
            </div>
            {bands.length > 1 && (
              <Button type="button" variant="ghost" onClick={() => setBands(bands.filter((_, j) => i !== j))}>
                Remove band {i + 1}
              </Button>
            )}
          </fieldset>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={bands.length >= 32}
          onClick={() => setBands([...bands, emptyBand()])}
        >
          Add time band
        </Button>
        {record && (
          <label>
            Tariff correction reason
            <input name="reason" minLength={3} maxLength={500} required />
          </label>
        )}
      </fieldset>
      <div className="button-row">
        <Button disabled={m.disabled}>{record ? 'Save tariff correction' : 'Save tariff'}</Button>
        <Button type="button" variant="secondary" disabled={m.disabled} onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
function TariffCard({
  base,
  uses,
  record,
  manage,
  reload,
}: {
  base: string;
  uses: Use[];
  record: Tariff;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<Tariff[] | null>(null);
  return (
    <article className="site-history-entry stack-form">
      <p>End use: {uses.find((u) => u.id === record.energyUseId)?.name}</p>
      <TariffDetails record={record} />
      {m.feedback}
      <Button
        variant="ghost"
        disabled={m.disabled}
        onClick={() =>
          void m.run(
            async () => setHistory(await request(`${base}/${record.id}/history`, 'GET')),
            'Tariff history loaded.',
          )
        }
      >
        View tariff history
      </Button>
      {history && (
        <details open>
          <summary>Tariff revision history</summary>
          <div className="stack-form">
            {history.map((r) => (
              <article className="site-history-entry" key={r.id}>
                <TariffDetails record={r} />
              </article>
            ))}
          </div>
        </details>
      )}
      {manage && !editing && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Correct tariff
        </Button>
      )}
      {manage && editing && (
        <TariffForm base={base} uses={uses} record={record} reload={reload} cancel={() => setEditing(false)} />
      )}
    </article>
  );
}
export function TariffWorkspace({
  catalog,
  base,
  data,
  manage,
  reload,
}: {
  catalog: CatalogEntry[];
  base: string;
  data: TariffData;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [adding, setAdding] = useState(false);
  return (
    <section className="panel stack-form" aria-label="Tariffs and end uses">
      <h2>Tariffs and end uses</h2>
      <p>
        Register stable site end uses and sourced pricing periods. These records do not allocate meter consumption or
        recalculate recorded bills. Tariffs below include all saved periods, independent of the selected consumption
        year.
      </p>
      {m.feedback}
      {data.uses.map((u) => (
        <article className="site-history-entry" key={u.id}>
          <strong>
            {u.code} · {u.name} · {u.fuel}
          </strong>
          <p>Source: {u.source}</p>
          <details>
            <summary>End-use source identities</summary>
            {u.fuelCatalog && (
              <p>
                Saved fuel catalog: {u.fuelCatalog.code} · {u.fuelCatalog.name} · revision {u.fuelCatalog.revision}
              </p>
            )}
            {u.endUseCatalog && (
              <p>
                Saved end-use catalog: {u.endUseCatalog.code} · {u.endUseCatalog.name} · revision{' '}
                {u.endUseCatalog.revision}
              </p>
            )}
            <p>
              Source system: {u.legacySource || 'None'} · FuelSources ID: {u.fuelLegacyId || 'None'} · FuelUses ID:{' '}
              {u.endUseLegacyId || 'None'} · {u.associationLegacyTable || 'Association'} ID:{' '}
              {u.associationLegacyId || 'None'}
            </p>
          </details>
        </article>
      ))}
      {manage && (
        <details>
          <summary>Register a site end use</summary>
          <form
            className="stack-form"
            aria-label="Add site end use"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const values = Object.fromEntries(new FormData(form));
              const payload = {
                ...values,
                fuelCatalogId: values.fuelCatalogId || null,
                endUseCatalogId: values.endUseCatalogId || null,
              };
              void m.run(async () => {
                await request(`${base}/uses`, 'POST', payload);
                form.reset();
                await reload();
              }, 'Site end use saved.');
            }}
          >
            <p>Codes and source identities are permanent. Check the label and legacy references before saving.</p>
            <fieldset className="form-grid" disabled={m.disabled}>
              <label>
                Fuel catalog version
                <select name="fuelCatalogId">
                  <option value="">No catalog link</option>
                  {catalog
                    .filter((c) => c.kind === 'FUEL' && !c.retired)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name} · {c.fuel} · v{c.revision}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                End-use catalog version
                <select name="endUseCatalogId">
                  <option value="">No catalog link</option>
                  {catalog
                    .filter((c) => c.kind === 'END_USE' && !c.retired)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name} · {c.fuel} · v{c.revision}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                End-use code
                <input name="code" maxLength={40} required />
              </label>
              <label>
                End-use name
                <input name="name" maxLength={100} required />
              </label>
              <label>
                End-use fuel
                <select name="fuel" required defaultValue="">
                  <option value="">Choose a fuel</option>
                  {fuels.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                End-use source
                <input name="source" minLength={3} maxLength={500} required />
              </label>
              <label>
                End-use legacy source system
                <input name="legacySource" maxLength={100} />
              </label>
              <label>
                FuelSources legacy ID
                <input name="fuelLegacyId" maxLength={160} />
              </label>
              <label>
                FuelUses legacy ID
                <input name="endUseLegacyId" maxLength={160} />
              </label>
              <label>
                Legacy association table
                <select name="associationLegacyTable">
                  <option value="">None</option>
                  <option>BusinessFuelUses</option>
                  <option>UsedInToFuelSourceToSite</option>
                </select>
              </label>
              <label>
                Legacy association ID
                <input name="associationLegacyId" maxLength={160} />
              </label>
            </fieldset>
            <Button disabled={m.disabled}>Save site end use</Button>
          </form>
        </details>
      )}
      {manage && !!data.uses.length && !adding && <Button onClick={() => setAdding(true)}>Add tariff</Button>}
      {manage && adding && <TariffForm base={base} uses={data.uses} reload={reload} cancel={() => setAdding(false)} />}
      {!data.tariffs.length && <p>No tariff periods recorded.</p>}
      {data.tariffs.map((r) => (
        <TariffCard key={r.id} base={base} uses={data.uses} record={r} manage={manage} reload={reload} />
      ))}
    </section>
  );
}
