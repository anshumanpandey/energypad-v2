'use client';
import { useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
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
  postCode?: string | null;
  town?: string | null;
  country?: string | null;
  region?: string | null;
  currency?: string | null;
  externalLegacyId?: string | null;
  meters?: Meter[];
  attributes?: History[];
};
const fields = [
  ['code', 'Site code'],
  ['name', 'Site name'],
  ['type', 'Site type'],
  ['address', 'Address'],
  ['postCode', 'Postcode'],
  ['town', 'Town'],
  ['country', 'Country'],
  ['region', 'Region'],
  ['currency', 'Currency (3-letter code)'],
  ['externalLegacyId', 'Legacy reference'],
] as const;
const historyFields = [
  ['population', 'Population'],
  ['floorArea', 'Floor area (m²)'],
  ['weeklyHours', 'Operating hours per week'],
  ['vatPercent', 'VAT (%)'],
] as const;
function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
}
export function SitesWorkspace({
  orgId,
  sites,
  portfolios,
  manage,
}: {
  orgId: string;
  sites: Site[];
  portfolios: Portfolio[];
  manage: boolean;
}) {
  const [selected, setSelected] = useState<Site | null>(null),
    [editing, setEditing] = useState(false);
  const m = useMutation(),
    base = `organisations/${orgId}`;
  async function detail(id: string) {
    setSelected(await request(`${base}/sites/${id}`, 'GET'));
    setEditing(false);
  }
  return (
    <div className="stack-form">
      {m.feedback}
      {manage && (
        <Button
          disabled={m.disabled}
          onClick={() => {
            setSelected(null);
            setEditing(true);
          }}
        >
          Add site
        </Button>
      )}
      {!sites.length && (
        <p>
          {manage
            ? 'Add a site or import a workbook from Data.'
            : 'No sites assigned yet. Ask your owner or admin for access.'}
        </p>
      )}
      <div className="site-grid">
        {sites.map((site) => (
          <section className="panel" key={site.id}>
            <h2>{site.name}</h2>
            <p>{site.code}</p>
            <Button variant="secondary" disabled={m.disabled} onClick={() => void m.run(() => detail(site.id), '')}>
              View site
            </Button>
          </section>
        ))}
      </div>
      {editing && manage && (
        <form
          key={selected?.id ?? 'new'}
          className="panel stack-form"
          onSubmit={(e) => {
            const input = values(e);
            void m.run(async () => {
              const data = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v || null]));
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
                  required={key === 'code' || key === 'name'}
                  maxLength={key === 'code' ? 50 : key === 'address' ? 300 : 160}
                />
              </label>
            ))}
            <label>
              Portfolio
              <select aria-label="Portfolio" name="portfolioId" defaultValue={selected?.portfolioId ?? ''}>
                <option value="">Unassigned</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="button-row">
            <Button disabled={m.disabled}>Save site</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {selected && !editing && (
        <section className="panel stack-form site-details">
          <header className="site-details-header">
            <div>
              <p className="site-details-eyebrow">Site details</p>
              <h2>{selected.name}</h2>
              <p className="site-details-address">
                {[selected.address, selected.town, selected.postCode, selected.country].filter(Boolean).join(', ') ||
                  'No address recorded.'}
              </p>
            </div>
            <span className="site-code-badge">{selected.code}</span>
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
          <h3 className="site-details-section-title">Attribute history</h3>
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
          {manage && (
            <form
              className="stack-form"
              onSubmit={(e) => {
                const form = e.currentTarget;
                const input = values(e);
                void m.run(async () => {
                  await request(
                    `${base}/sites/${selected.id}/attributes`,
                    'POST',
                    Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v || null])),
                  );
                  form.reset();
                  await detail(selected.id);
                });
              }}
            >
              <div className="form-grid">
                <label>
                  Effective date
                  <input type="date" name="effectiveFrom" required />
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
              </div>
              <Button disabled={m.disabled}>Add history entry</Button>
            </form>
          )}
          <h3 className="site-details-section-title">Meters</h3>
          {selected.meters?.map((meter) => (
            <MeterForm
              key={meter.id}
              meter={meter}
              manage={manage}
              path={`${base}/sites/${selected.id}/meters`}
              reload={() => detail(selected.id)}
            />
          ))}
          {manage && (
            <MeterForm manage path={`${base}/sites/${selected.id}/meters`} reload={() => detail(selected.id)} />
          )}
        </section>
      )}
    </div>
  );
}
function MeterForm({
  meter,
  manage,
  path,
  reload,
}: {
  meter?: Meter;
  manage: boolean;
  path: string;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  if (!manage)
    return (
      <p>
        {meter?.name} ({meter?.code}) — {meter?.fuel}, {meter?.unit}
      </p>
    );
  return (
    <form
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
          <input name="code" required defaultValue={meter?.code} maxLength={80} />
        </label>
        <label>
          Meter name
          <input name="name" required defaultValue={meter?.name} maxLength={160} />
        </label>
        <label>
          Fuel
          <select name="fuel" defaultValue={meter?.fuel}>
            {['ELECTRICITY', 'GAS', 'OIL', 'LPG', 'BIOMASS', 'HEAT', 'OTHER'].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Unit
          <select name="unit" defaultValue={meter?.unit}>
            {['kWh', 'MWh', 'm3', 'litre', 'kg'].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="button-row">
        <Button disabled={m.disabled}>{meter ? 'Save meter' : 'Add meter'}</Button>
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
