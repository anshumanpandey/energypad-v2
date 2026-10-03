'use client';
import { DateInput } from './ui/date-input';
import { fuels } from '@/domain/fuels';
import { siteTemplateFields, siteTemplateAttributeFields } from '@/domain/sites';
import { useState, useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { ImportWorkspace } from './import-workspace';
type Portfolio = { id: string; name: string };
type Meter = { id: string; code: string; name: string; fuel: string; unit: string };
type History = {
  id: string;
  effectiveFrom: string;
  population: string | null;
  floorArea: string | null;
  weeklyHours: string | null;
  vatPercent: string | null;
};
type Site = {
  id: string;
  code: string;
  name: string;
  portfolioId?: string | null;
  type?: string | null;
  address?: string | null;
  addressLine2?: string | null;
  postCode?: string | null;
  town?: string | null;
  country?: string | null;
  region?: string | null;
  currency?: string | null;
  externalLegacyId?: string | null;
  meters?: Meter[];
  attributes?: History[];
};
const fields = siteTemplateFields;
const historyFields = [
  ['population', 'Population'],
  ['floorArea', 'Floor area (m²)'],
  ['weeklyHours', 'Work Hours per week'],
  ['vatPercent', 'VAT (%)'],
] as const;
function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
}
export function SitesWorkspace({
  orgId,
  sites,
  manage,
  batches,
}: {
  orgId: string;
  sites: Site[];
  manage: boolean;
  batches: { id: string; status: string }[];
}) {
  const [selected, setSelected] = useState<Site | null>(null),
    [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState<'meter' | 'history' | null>(null);
  const [mode, setMode] = useState<'manual' | 'upload' | null>(null);
  const [notice, setNotice] = useState('');
  const m = useMutation(),
    base = `organisations/${orgId}`;
  async function entrySaved(kind: string, id: string) {
    setEntry(null);
    setNotice(`${kind} saved successfully.`);
    try {
      await detail(id);
    } catch {
      setNotice(`${kind} saved successfully, but the list could not refresh. Select View site to reload it.`);
    }
  }
  async function detail(id: string) {
    setSelected(await request(`${base}/sites/${id}`, 'GET'));
    setEditing(false);
    setMode(null);
  }
  return (
    <div className="stack-form">
      {m.feedback}
      {manage && (
        <div className="button-row">
          <Button
            variant={mode === 'manual' ? 'primary' : 'secondary'}
            aria-expanded={mode === 'manual'}
            aria-controls="manual-site-section"
            disabled={m.disabled}
            onClick={() => {
              setSelected(null);
              setEditing(true);
              setMode('manual');
              setEntry(null);
            }}
          >
            Add Manually
          </Button>
          <Button
            variant={mode === 'upload' ? 'primary' : 'secondary'}
            aria-expanded={mode === 'upload'}
            aria-controls="upload-sites-section"
            disabled={m.disabled}
            onClick={() => {
              setMode('upload');
              setSelected(null);
              setEditing(false);
              setEntry(null);
            }}
          >
            Upload Sites
          </Button>
        </div>
      )}
      {manage && mode === 'upload' && (
        <section id="upload-sites-section" aria-label="Upload sites">
          <ImportWorkspace orgId={orgId} batches={batches} />
        </section>
      )}
      {editing && manage && (
        <form
          id="manual-site-section"
          key={selected?.id ?? 'new'}
          className="panel stack-form"
          onSubmit={(e) => {
            const input = values(e);
            void m.run(async () => {
              const data: Record<string, unknown> = Object.fromEntries(
                Object.entries(input).map(([k, v]) => [k, v || null]),
              );
              if (!selected) {
                const { population, weeklyHours, effectiveFrom } = data;
                delete data.population;
                delete data.weeklyHours;
                delete data.effectiveFrom;
                if (population !== null || weeklyHours !== null)
                  data.attributes = { population, weeklyHours, effectiveFrom };
              }
              const site = await request(
                `${base}/sites${selected ? `/${selected.id}` : ''}`,
                selected ? 'PATCH' : 'POST',
                data,
              );
              await detail(site.id);
            });
          }}
        >
          <h2>{selected ? 'Edit site' : 'New site'}</h2>
          <div className="form-grid">
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  defaultValue={selected?.[key] ?? ''}
                  required={key === 'name'}
                  maxLength={key === 'address' || key === 'addressLine2' ? 300 : key === 'postCode' ? 32 : 160}
                />
              </label>
            ))}
            {!selected &&
              siteTemplateAttributeFields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type="number"
                    min="0"
                    step="0.001"
                    max={key === 'weeklyHours' ? 168 : 99999999999}
                  />
                </label>
              ))}
            {!selected && (
              <label>
                Attribute effective date
                <DateInput
                  name="effectiveFrom"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
            )}
          </div>
          <div className="button-row">
            <Button disabled={m.disabled}>Save site</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setMode(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      <section className="panel stack-form" aria-labelledby="sites-table-heading">
        <h2 id="sites-table-heading">Sites</h2>
        <div className="sites-table-scroll" role="region" aria-label="Sites table" tabIndex={0}>
          <table className="import-preview-table">
            <thead>
              <tr>
                {fields.map(([key, label]) => (
                  <th scope="col" key={key}>
                    {label}
                  </th>
                ))}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id}>
                  {fields.map(([key]) =>
                    key === 'name' ? (
                      <th scope="row" key={key}>
                        {site.name}
                      </th>
                    ) : (
                      <td key={key}>{site[key] || '—'}</td>
                    ),
                  )}
                  <td>
                    <Button
                      variant="secondary"
                      disabled={m.disabled}
                      aria-label={`View site ${site.name}`}
                      onClick={() => void m.run(() => detail(site.id), '')}
                    >
                      View site
                    </Button>
                  </td>
                </tr>
              ))}
              {!sites.length && (
                <tr>
                  <td colSpan={fields.length + 1}>
                    {manage
                      ? 'No sites yet. Choose Add Manually or Upload Sites to create your sites.'
                      : 'No sites assigned yet. Ask your owner or admin for access.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selected && !editing && (
        <section className="panel stack-form site-details">
          <header className="site-details-header">
            <div>
              <p className="site-details-eyebrow">Site details</p>
              <h2>{selected.name}</h2>
              <p className="site-details-address">
                {[
                  selected.address,
                  selected.addressLine2,
                  selected.town,
                  selected.region,
                  selected.postCode,
                  selected.country,
                ]
                  .filter(Boolean)
                  .join(', ') || 'No address recorded.'}
              </p>
            </div>
          </header>
          <dl className="site-details-grid">
            {fields
              .filter(([key]) => !['name', 'address', 'town', 'postCode', 'country'].includes(key))
              .map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd className={selected[key] ? undefined : 'site-details-empty'}>
                    {selected[key] || 'Not recorded'}
                  </dd>
                </div>
              ))}
          </dl>
          {manage && (
            <div className="button-row">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit site
              </Button>
              <Button
                variant="danger"
                disabled={m.disabled}
                onClick={() => {
                  if (window.confirm('Archive this site? It will disappear from active sites; its history remains.'))
                    void m.run(async () => {
                      await request(`${base}/sites/${selected.id}`, 'DELETE');
                      setSelected(null);
                    });
                }}
              >
                Archive site
              </Button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <div className="site-details-actions">
            <h3 className="site-details-section-title">Attribute history</h3>
            {manage && (
              <Button
                onClick={() => {
                  setNotice('');
                  setEntry('history');
                }}
              >
                Add History Entry
              </Button>
            )}
          </div>
          <p>Each entry is a complete snapshot effective from its date. Blank values mean unknown, not zero.</p>
          {selected.attributes?.map((h) => (
            <article className="site-history-entry" key={h.id}>
              <p className="site-history-date">
                Effective from <time dateTime={h.effectiveFrom.slice(0, 10)}>{h.effectiveFrom.slice(0, 10)}</time>
              </p>
              <dl className="site-details-grid">
                {historyFields.map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd className={h[key] == null ? 'site-details-empty' : undefined}>{h[key] ?? 'Not recorded'}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
          {!selected.attributes?.length && <p className="site-details-empty">No attribute history recorded yet.</p>}
          {manage && entry === 'history' && (
            <HistoryForm
              path={`${base}/sites/${selected.id}/attributes`}
              onClose={() => setEntry(null)}
              onSaved={() => entrySaved('History entry', selected.id)}
            />
          )}
          <div className="site-details-actions">
            <h3 className="site-details-section-title">Meters</h3>
            {manage && (
              <Button
                onClick={() => {
                  setNotice('');
                  setEntry('meter');
                }}
              >
                Add Meter
              </Button>
            )}
          </div>
          {selected.meters?.map((meter) => (
            <MeterForm
              key={meter.id}
              meter={meter}
              manage={manage}
              path={`${base}/sites/${selected.id}/meters`}
              reload={() => detail(selected.id)}
            />
          ))}
          {manage && entry === 'meter' && (
            <MeterForm
              manage
              path={`${base}/sites/${selected.id}/meters`}
              reload={() => entrySaved('Meter', selected.id)}
              onClose={() => setEntry(null)}
            />
          )}
        </section>
      )}
    </div>
  );
}
function EntryModal({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="site-entry-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="site-entry-close">
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose} aria-label={`Close ${title}`}>
          ×
        </Button>
      </div>
      {children}
    </dialog>
  );
}
function HistoryForm({ path, onClose, onSaved }: { path: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const m = useMutation();
  return (
    <EntryModal title="New history entry" busy={m.pending} onClose={onClose}>
      <form
        className="stack-form"
        onSubmit={(event) => {
          const form = event.currentTarget;
          const input = values(event);
          void m.run(async () => {
            await request(
              path,
              'POST',
              Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value || null])),
            );
            form.reset();
            await onSaved();
          });
        }}
      >
        <h3>New history entry</h3>
        <p>Enter a complete snapshot. Blank values mean unknown, not zero.</p>
        {m.feedback}
        <fieldset className="form-grid" disabled={m.pending}>
          <label>
            Effective date
            <DateInput type="date" name="effectiveFrom" required />
          </label>
          {historyFields.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                type="number"
                min="0"
                step="0.001"
                max={key === 'weeklyHours' ? 168 : key === 'vatPercent' ? 100 : 99999999999}
              />
            </label>
          ))}
        </fieldset>
        <div className="button-row">
          <Button disabled={m.disabled}>Add history entry</Button>
          <Button type="button" variant="ghost" disabled={m.pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </EntryModal>
  );
}
function MeterForm({
  meter,
  manage,
  path,
  reload,
  onClose,
}: {
  onClose?: () => void;
  meter?: Meter;
  manage: boolean;
  path: string;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useId();
  useEffect(() => {
    const name = Object.keys(m.fieldErrors)[0];
    const field = name && formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLElement) field.focus();
  }, [m.fieldErrors]);
  const validation = (name: string) => ({
    'aria-invalid': !!m.fieldErrors[name],
    'aria-describedby': m.fieldErrors[name] ? `${errorId}-${name}` : undefined,
  });
  const fieldError = (name: string) =>
    m.fieldErrors[name] ? (
      <span className="field-error" id={`${errorId}-${name}`}>
        {m.fieldErrors[name]}
      </span>
    ) : null;

  if (!manage)
    return (
      <p>
        {meter?.name} ({meter?.code}) — {meter?.fuel}, {meter?.unit}
      </p>
    );
  const form = (
    <form
      ref={formRef}
      noValidate
      className="panel stack-form"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const input = values(e);
        void m.run(async () => {
          await request(`${path}${meter ? `/${meter.id}` : ''}`, meter ? 'PATCH' : 'POST', input);
          if (!meter) form.reset();
          await reload();
        });
      }}
    >
      {m.feedback}
      <h4>{meter ? 'Edit meter' : 'New meter'}</h4>
      <div className="form-grid">
        <label>
          Meter code
          <input {...validation('code')} name="code" required defaultValue={meter?.code} maxLength={80} />
          {fieldError('code')}
        </label>
        <label>
          Meter name
          <input {...validation('name')} name="name" required defaultValue={meter?.name} maxLength={160} />
          {fieldError('name')}
        </label>
        <label>
          Fuel
          <select {...validation('fuel')} name="fuel" defaultValue={meter?.fuel}>
            {fuels.map((f) => (
              <option key={f} value={f}>
                {f === 'SOLAR_PV' ? 'Solar PV' : f}
              </option>
            ))}
          </select>
          {fieldError('fuel')}
        </label>
        <label>
          Unit
          <select {...validation('unit')} name="unit" defaultValue={meter?.unit}>
            {['kWh', 'MWh', 'm3', 'litre', 'kg'].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          {fieldError('unit')}
        </label>
      </div>
      <div className="button-row">
        <Button disabled={m.disabled}>{meter ? 'Save meter' : 'Add meter'}</Button>
        {onClose && (
          <Button type="button" variant="ghost" disabled={m.pending} onClick={onClose}>
            Cancel
          </Button>
        )}
        {meter && (
          <Button
            type="button"
            variant="danger"
            disabled={m.disabled}
            onClick={() => {
              if (window.confirm('Archive this meter?'))
                void m.run(async () => {
                  await request(`${path}/${meter.id}`, 'DELETE');
                  await reload();
                });
            }}
          >
            Archive meter
          </Button>
        )}
      </div>
    </form>
  );
  return onClose ? (
    <EntryModal title="New meter" busy={m.pending} onClose={onClose}>
      {form}
    </EntryModal>
  ) : (
    form
  );
}
export function PortfoliosWorkspace({
  orgId,
  portfolios,
  manage,
}: {
  orgId: string;
  portfolios: Portfolio[];
  manage: boolean;
}) {
  const m = useMutation(),
    base = `organisations/${orgId}/portfolios`;
  return (
    <div className="stack-form">
      {m.feedback}
      {!portfolios.length && <p>No portfolios yet.</p>}
      {portfolios.map((p) =>
        manage ? (
          <form
            className="panel stack-form"
            key={p.id}
            onSubmit={(e) => {
              const data = values(e);
              void m.run(async () => {
                await request(`${base}/${p.id}`, 'PATCH', data);
              });
            }}
          >
            <label>
              Portfolio name
              <input name="name" defaultValue={p.name} required maxLength={160} />
            </label>
            <Button disabled={m.disabled}>Save portfolio</Button>
            <Button
              type="button"
              variant="danger"
              disabled={m.disabled}
              onClick={() => {
                if (window.confirm('Archive this portfolio?'))
                  void m.run(async () => {
                    await request(`${base}/${p.id}`, 'DELETE');
                  });
              }}
            >
              Archive portfolio
            </Button>
          </form>
        ) : (
          <section key={p.id} className="panel">
            <h2>{p.name}</h2>
          </section>
        ),
      )}
      {manage && (
        <form
          className="panel stack-form"
          onSubmit={(e) => {
            const data = values(e),
              form = e.currentTarget;
            void m.run(async () => {
              await request(base, 'POST', data);
              form.reset();
            });
          }}
        >
          <label>
            New portfolio name
            <input name="name" required maxLength={160} />
          </label>
          <Button disabled={m.disabled}>Create portfolio</Button>
        </form>
      )}
    </div>
  );
}
