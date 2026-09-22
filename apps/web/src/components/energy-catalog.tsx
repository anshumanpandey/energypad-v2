'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { fuels } from '@/domain/tariffs';
export type CatalogEntry = {
  id: string;
  kind: 'FUEL' | 'END_USE';
  code: string;
  fuel: string;
  name: string;
  color: string;
  source: string;
  legacySource: string;
  legacyId: string;
  retired: boolean;
  revision: number;
  correctionReason: string | null;
  authorId: string;
  createdAt: string;
};
function EntryDetails({ entry: e }: { entry: CatalogEntry }) {
  return (
    <div>
      <strong>
        {e.kind} · {e.code} · {e.name} · Revision {e.revision}
      </strong>
      <p>
        {e.fuel} · {e.retired ? 'Retired' : 'Active'} · Colour <span style={{ color: e.color }}>●</span> {e.color}
      </p>
      <p>Source: {e.source}</p>
      <p>{e.correctionReason ?? 'Original entry'}</p>
      <p className="muted" style={{ overflowWrap: 'anywhere' }}>
        {new Date(e.createdAt).toLocaleString()} · Author {e.authorId}
      </p>
      <p>
        Legacy source: {e.legacySource || 'None'} · ID: {e.legacyId || 'None'}
      </p>
    </div>
  );
}
function CatalogForm({
  base,
  entry,
  reload,
  cancel,
}: {
  base: string;
  entry?: CatalogEntry;
  reload: () => Promise<void>;
  cancel: () => void;
}) {
  const m = useMutation();
  return (
    <form
      className="stack-form"
      aria-label={entry ? 'Correct catalog entry' : 'Add catalog entry'}
      onSubmit={(e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        const { reason, ...fields } = values;
        const data = {
          ...fields,
          retired: fields.retired === 'on',
          ...(entry
            ? {
                kind: entry.kind,
                code: entry.code,
                fuel: entry.fuel,
                legacySource: entry.legacySource,
                legacyId: entry.legacyId,
              }
            : {}),
        };
        void m.run(async () => {
          await request(entry ? `${base}/${entry.id}/correct` : base, 'POST', entry ? { entry: data, reason } : data);
          await reload();
          cancel();
        }, 'Catalog entry saved.');
      }}
    >
      {m.feedback}
      <fieldset className="form-grid" disabled={m.disabled}>
        {!entry && (
          <>
            <label>
              Catalog kind
              <select name="kind" defaultValue="" required>
                <option value="">Choose kind</option>
                <option value="FUEL">Fuel</option>
                <option value="END_USE">End use</option>
              </select>
            </label>
            <label>
              Catalog code
              <input name="code" required maxLength={40} />
            </label>
            <label>
              Catalog fuel
              <select name="fuel" defaultValue="" required>
                <option value="">Choose fuel</option>
                {fuels.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Catalog legacy source
              <input name="legacySource" maxLength={100} />
            </label>
            <label>
              Catalog legacy ID
              <input name="legacyId" maxLength={160} />
            </label>
          </>
        )}
        <label>
          Catalog label
          <input name="name" defaultValue={entry?.name} required maxLength={100} />
        </label>
        <label>
          Catalog colour
          <input name="color" placeholder="#236747" defaultValue={entry?.color} required pattern="#[0-9a-fA-F]{6}" />
        </label>
        <label>
          Catalog source
          <input name="source" defaultValue={entry?.source} required minLength={3} maxLength={500} />
        </label>
        {entry && (
          <>
            <label className="checkbox-label">
              <input name="retired" type="checkbox" defaultChecked={entry.retired} />
              Retire from new site registrations
            </label>
            <label>
              Catalog correction reason
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
          </>
        )}
      </fieldset>
      <p>
        Catalog codes, fuel and source identities remain fixed. Changes create revisions; existing site uses keep their
        saved version.
      </p>
      <div className="button-row">
        <Button disabled={m.disabled}>{entry ? 'Save catalog correction' : 'Save catalog entry'}</Button>
        <Button type="button" variant="secondary" disabled={m.disabled} onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
function CatalogCard({
  base,
  entry,
  manage,
  reload,
}: {
  base: string;
  entry: CatalogEntry;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<CatalogEntry[] | null>(null);
  return (
    <article className="site-history-entry stack-form">
      <EntryDetails entry={entry} />
      {m.feedback}
      <Button
        variant="ghost"
        disabled={m.disabled}
        onClick={() =>
          void m.run(
            async () => setHistory(await request(`${base}/${entry.id}/history`, 'GET')),
            'Catalog history loaded.',
          )
        }
      >
        View catalog history
      </Button>
      {history && (
        <details open>
          <summary>Catalog revision history</summary>
          <div className="stack-form">
            {history.map((e) => (
              <article className="site-history-entry" key={e.id}>
                <EntryDetails entry={e} />
              </article>
            ))}
          </div>
        </details>
      )}
      {manage && !editing && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Correct catalog entry
        </Button>
      )}
      {manage && editing && <CatalogForm base={base} entry={entry} reload={reload} cancel={() => setEditing(false)} />}
    </article>
  );
}
export function EnergyCatalog({
  base,
  entries,
  manage,
  reload,
}: {
  base: string;
  entries: CatalogEntry[];
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="panel stack-form" aria-label="Shared energy catalog">
      <h2>Shared energy catalog</h2>
      <p>
        Fuel and end-use labels shared across sites in this organisation. Revisions preserve previous labels and
        colours. Retirement prevents new site registrations; existing references remain valid.
      </p>
      {manage && !adding && <Button onClick={() => setAdding(true)}>Add catalog entry</Button>}
      {manage && adding && <CatalogForm base={base} reload={reload} cancel={() => setAdding(false)} />}
      {!entries.length && <p>No catalog entries registered.</p>}
      {entries.map((e) => (
        <CatalogCard key={e.id} base={base} entry={e} manage={manage} reload={reload} />
      ))}
    </section>
  );
}
