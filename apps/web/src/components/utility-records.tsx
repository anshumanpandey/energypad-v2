'use client';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { request, useMutation } from './forms';
import { Button } from './ui/button';
import { utilityLabel } from '@/domain/consumption-sort';
import { formatEnergyValue } from './format-energy-value';
import type { ReadingRevision } from './energy-corrections';
import type { EmissionFactor } from './emission-factor-workspace';
import type { MonthlyPlanPayload } from '@/domain/monthly-plans';

type Factor = EmissionFactor & { siteId: string | null };
type Plan = {
  id: string;
  month: string;
  kind: string;
  fuel: string;
  unit: string;
  revision: number;
  replacement: { id: string } | null;
  payload: MonthlyPlanPayload;
};
type Data = { readings: ReadingRevision[]; factors: Factor[]; plans: Plan[]; meters: { id: string; name: string }[] };
type Editing =
  { kind: 'reading'; row: ReadingRevision } | { kind: 'factor'; row: Factor } | { kind: 'plan'; row: Plan };
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const number = (value: unknown) => formatEnergyValue(value as string | null, '—');
const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
export function UtilityRecords({
  orgId,
  sites,
  manage,
}: {
  orgId: string;
  sites: { id: string; name: string }[];
  manage: boolean;
}) {
  const currentYear = new Date().getUTCFullYear();
  const [site, setSite] = useState(sites[0]?.id ?? '');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState('01');
  const [generation, setGeneration] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data?: Data; error?: string } | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const mutation = useMutation();
  const base = `organisations/${orgId}/sites/${site}`;
  const key = `${base}/${year}/${generation}`;
  const data = loaded?.key === key ? loaded.data : undefined;
  const error = loaded?.key === key ? loaded.error : undefined;
  const loading = !!site && !data && !error;
  const period = `${year}-${month}`;
  useEffect(() => {
    if (!site) return;
    let active = true;
    void Promise.all([
      request(`${base}/energy?year=${year}`, 'GET'),
      request(`organisations/${orgId}/emission-factors`, 'GET'),
      request(`${base}/monthly-plans?year=${year}`, 'GET'),
    ])
      .then(([energy, factors, plans]) => {
        if (active) setLoaded({ key, data: { readings: energy.records, meters: energy.meters, factors, plans } });
      })
      .catch((error: Error) => {
        if (active) setLoaded({ key, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [site, year, base, key, orgId]);
  const readings = data?.readings.filter((row) => row.periodStart.startsWith(period)) ?? [];
  const replaced = new Set(data?.factors.map((row) => row.supersedesId));
  const first = `${period}-01`;
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).toISOString().slice(0, 10);
  const factors =
    data?.factors.filter(
      (row) =>
        !replaced.has(row.id) &&
        (!row.siteId || row.siteId === site) &&
        row.validFrom.slice(0, 10) <= last &&
        row.validUntil.slice(0, 10) > first,
    ) ?? [];
  const plans = data?.plans.filter((row) => !row.replacement && row.month === period) ?? [];
  function changeSelection(update: () => void) {
    setEditing(null);
    update();
  }
  function editButton(value: Editing) {
    return manage ? (
      <Button variant="secondary" disabled={mutation.disabled} onClick={() => setEditing(value)}>
        Edit record
      </Button>
    ) : (
      <span className="muted">View only</span>
    );
  }
  async function save(form: HTMLFormElement) {
    if (!editing) return;
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const { reason } = values;
    await mutation.run(async () => {
      if (editing.kind === 'reading') {
        const row = editing.row;
        await request(`${base}/energy/records/${row.id}/correct`, 'POST', {
          reason,
          useLatestConversion: false,
          reading: {
            meterId: row.meterId,
            month: row.periodStart.slice(0, 7),
            quantity: values.quantity,
            netCost: values.netCost || null,
            vatPercent: values.vatPercent || null,
            currency: values.currency || null,
            endUse: row.endUse,
            energyUseCode: row.energyUseSnapshot?.code ?? null,
            externalLegacyId: row.externalLegacyId,
          },
        });
      } else if (editing.kind === 'factor') {
        const row = editing.row;
        await request(`organisations/${orgId}/emission-factors/${row.id}/correct`, 'POST', {
          reason,
          factor: {
            fuel: row.fuel,
            geography: row.geography,
            basis: row.basis,
            unit: row.unit,
            factor: values.factor,
            source: values.source,
            firstDay: row.validFrom.slice(0, 10),
            lastDay: new Date(+new Date(row.validUntil) - 86400000).toISOString().slice(0, 10),
          },
        });
      } else {
        const row = editing.row,
          old = row.payload;
        await request(`${base}/monthly-plans/${row.id}/correct`, 'POST', {
          reason,
          plan: {
            kind: old.kind,
            month: row.month,
            fuel: row.fuel,
            unit: row.unit,
            energy: values.energy,
            carbon: values.carbon,
            conversionFactor: values.conversionFactor,
            cost: values.cost,
            grossCost: values.grossCost,
            currency: values.currency,
            source: values.source,
            energyUseCodes: old.energyUseCodes,
            externalLegacyId: old.externalLegacyId,
            requestKey: crypto.randomUUID(),
          },
        });
      }
      setEditing(null);
      setGeneration((n) => n + 1);
    }, 'Record saved successfully. Previous values remain in revision history.');
  }
  const editor = editing ? (
    <form
      key={editing.row.id}
      className="panel stack-form utility-record-editor"
      aria-label="Edit utility record"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <h2>
        Edit{' '}
        {editing.kind === 'reading' ? 'consumption' : editing.kind === 'factor' ? 'emission factor' : 'monthly plan'}
      </h2>
      <p>
        {utilityLabel(editing.row.fuel)} · Revision {editing.row.revision}. Saving creates a correction and retains the
        original record.
      </p>
      {editing.kind === 'factor' && (
        <p className="notice">
          {editing.row.siteId ? 'Site-specific factor' : 'Shared workspace factor: changes affect every site using it.'}{' '}
          · {date(editing.row.validFrom)}–{date(new Date(+new Date(editing.row.validUntil) - 86400000).toISOString())}
        </p>
      )}
      <fieldset disabled={mutation.disabled} className="utility-record-fields form-grid">
        {editing.kind === 'reading' ? (
          <>
            <Field
              name="quantity"
              label={`Consumption (${editing.row.sourceUnit})`}
              value={editing.row.sourceQuantity}
              required
              step="0.001"
            />
            <Field name="netCost" label="Net cost (excluding VAT)" value={editing.row.netCost} step="0.001" />
            <Field name="vatPercent" label="VAT (%)" value={editing.row.vatPercent} step="0.001" max="100" />
            <Field name="currency" label="Currency" value={editing.row.currency} text />
          </>
        ) : editing.kind === 'factor' ? (
          <>
            <Field name="factor" label="Emission factor (kgCO₂e/kWh)" value={editing.row.factor} required />
            <Field name="source" label="Source" value={editing.row.source} text required />
          </>
        ) : (
          <>
            <Field name="energy" label={`Energy (${editing.row.unit})`} value={editing.row.payload.energy} required />
            <Field
              name="carbon"
              label="Carbon (kgCO₂e)"
              value={editing.row.payload.carbon}
              required={editing.row.kind === 'MONITORING'}
            />
            <Field
              name="conversionFactor"
              label="Conversion factor (to kWh)"
              value={editing.row.payload.conversionFactor}
              required
            />
            <Field name="cost" label="Net target cost" value={editing.row.payload.cost} />
            <Field name="grossCost" label="Total target cost (including VAT)" value={editing.row.payload.grossCost} />
            <Field name="currency" label="Currency" value={editing.row.payload.currency} text />
            <Field name="source" label="Source" value={editing.row.payload.source} text required />
          </>
        )}
        <label>
          Reason for change
          <input name="reason" required minLength={3} maxLength={500} />
        </label>
      </fieldset>
      <div className="button-row">
        <Button disabled={mutation.disabled}>Save changes</Button>
        <Button type="button" variant="secondary" disabled={mutation.disabled} onClick={() => setEditing(null)}>
          Cancel
        </Button>
      </div>
    </form>
  ) : null;
  return (
    <div className="utility-records-page">
      <header className="utility-records-heading">
        <h1>Utility &amp; Emissions</h1>
      </header>
      <div className="utility-records-body stack-form">
        <section aria-label="Record selection">
          <div className="utility-record-filters">
            <label>
              Site
              <select
                aria-label="Records site"
                value={site}
                disabled={mutation.disabled}
                onChange={(e) => changeSelection(() => setSite(e.target.value))}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Month
              <select
                aria-label="Records month"
                value={month}
                disabled={mutation.disabled}
                onChange={(e) => changeSelection(() => setMonth(e.target.value))}
              >
                {months.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Year
              <select
                aria-label="Records year"
                value={year}
                disabled={mutation.disabled}
                onChange={(e) => changeSelection(() => setYear(e.target.value))}
              >
                {Array.from({ length: currentYear - 1999 }, (_, i) => String(currentYear - i)).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <Button
              disabled={mutation.disabled || loading || !site}
              onClick={() => changeSelection(() => setGeneration((n) => n + 1))}
            >
              Refresh records
            </Button>
          </div>
        </section>
        {mutation.feedback}
        {!site && <p className="notice">Add a site in Sites to view its records.</p>}
        {loading && (
          <p role="status" className="notice">
            Loading utility records…
          </p>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {data && (
          <>
            <RecordTable
              title="Energy consumption and costs"
              columns={[
                'Utilities',
                'Consumption',
                'Fuel unit',
                'VAT cost',
                'Total cost',
                'Conversion factor',
                'Actions',
              ]}
              empty={!readings.length}
            >
              {readings.map((row) => (
                <Fragment key={row.id}>
                  <tr className={editing?.row.id === row.id ? 'utility-record-selected' : undefined}>
                    <th scope="row">
                      {utilityLabel(row.fuel)}
                      <small>{data.meters.find((m) => m.id === row.meterId)?.name ?? row.meterId}</small>
                    </th>
                    <td>{number(row.sourceQuantity)}</td>
                    <td>{row.sourceUnit}</td>
                    <td>
                      {number(row.vatCost)} {row.currency}
                    </td>
                    <td>
                      {number(row.grossCost)} {row.currency}
                    </td>
                    <td>{row.conversionFactor}</td>
                    <td>{editButton({ kind: 'reading', row })}</td>
                  </tr>
                  {editing?.kind === 'reading' && editing.row.id === row.id && (
                    <tr className="utility-record-editor-row">
                      <td colSpan={7}>{editor}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </RecordTable>
            <RecordTable
              title="Energy emissions"
              columns={['Utilities', 'Emission factor (kgCO₂e/kWh)', 'Scope / validity', 'Reference', 'Actions']}
              empty={!factors.length}
            >
              {factors.map((row) => (
                <Fragment key={row.id}>
                  <tr className={editing?.row.id === row.id ? 'utility-record-selected' : undefined}>
                    <th scope="row">{utilityLabel(row.fuel)}</th>
                    <td className="utility-record-value">{row.factor}</td>
                    <td>
                      {row.siteId ? 'This site' : 'Workspace-wide'}
                      <small>
                        {date(row.validFrom)}–{date(new Date(+new Date(row.validUntil) - 86400000).toISOString())}
                      </small>
                    </td>
                    <td>
                      {row.source}
                      <small>
                        {row.basis.replaceAll('_', ' ')} · {row.geography}
                      </small>
                    </td>
                    <td>{editButton({ kind: 'factor', row })}</td>
                  </tr>
                  {editing?.kind === 'factor' && editing.row.id === row.id && (
                    <tr className="utility-record-editor-row">
                      <td colSpan={5}>{editor}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </RecordTable>
            <RecordTable
              title="Monitoring & targeting"
              columns={['Utilities', 'Kind', 'Fuel unit', 'Conversion factor', 'Energy', 'Carbon (kgCO₂e)', 'Actions']}
              empty={!plans.length}
            >
              {plans.map((row) => (
                <Fragment key={row.id}>
                  <tr className={editing?.row.id === row.id ? 'utility-record-selected' : undefined}>
                    <th scope="row">{utilityLabel(row.fuel)}</th>
                    <td>{row.kind === 'TARGET' ? 'Target' : 'Monitoring'}</td>
                    <td>{row.unit}</td>
                    <td>{row.payload.conversionFactor}</td>
                    <td>{number(row.payload.energy)}</td>
                    <td>{number(row.payload.carbon || null)}</td>
                    <td>{editButton({ kind: 'plan', row })}</td>
                  </tr>
                  {editing?.kind === 'plan' && editing.row.id === row.id && (
                    <tr className="utility-record-editor-row">
                      <td colSpan={7}>{editor}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </RecordTable>
            <p className="page-note utility-records-footer">
              Use Upload to add records from Excel or an API. Consumption edits retain the meter and conversion used for
              that reading.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
function Field({
  name,
  label,
  value,
  text,
  required,
  step = '0.000000001',
  max,
}: {
  name: string;
  label: string;
  value?: string | null;
  text?: boolean;
  required?: boolean;
  step?: string;
  max?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={text ? 'text' : 'number'}
        min={text ? undefined : '0'}
        step={text ? undefined : step}
        max={max}
        defaultValue={value ?? ''}
        required={required}
        maxLength={name === 'currency' ? 3 : 1000}
      />
    </label>
  );
}
function RecordTable({
  title,
  columns,
  children,
  empty,
}: {
  title: string;
  columns: string[];
  children: ReactNode;
  empty: boolean;
}) {
  return (
    <section className="utility-record-section">
      <header>
        <h2>{title}</h2>
      </header>
      <div className="sites-table-scroll" role="region" aria-label={title} tabIndex={0}>
        <table className="import-preview-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th scope="col" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={columns.length} className="sites-empty">
                  No records for this site and month.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
