'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import type { OccupancyPreview } from '@/domain/occupancy';
type Use = { id: string; code: string; name: string };
export type OccupancyRecord = {
  id: string;
  validFrom: string;
  validUntil: string;
  regularCount: number | null;
  irregularCount: number | null;
  source: string;
  legacySource: string;
  legacyId: string;
  revision: number;
  correctionReason: string | null;
  createdAt: string;
  authorId: string;
  energyUse: Use;
};
type Batch = { id: string; status: string; result: OccupancyPreview; createdAt: string };
const lastDay = (value: string) => new Date(+new Date(value) - 86400000).toISOString().slice(0, 10);
export function OccupancyWorkspace({
  base,
  data,
  uses,
  manage,
  reload,
}: {
  base: string;
  data: OccupancyRecord[];
  uses: Use[];
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [editing, setEditing] = useState<OccupancyRecord | null>(null);
  const [history, setHistory] = useState<{ id: string; rows: OccupancyRecord[] } | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [recent, setRecent] = useState<Batch[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="panel stack-form" aria-label="Occupancy history">
      <h2>Occupancy history</h2>
      <p>
        Record regular and irregular occupants separately for a registered end use and explicit period. Dates include
        both days; use the same day for a dated count. Blank means unknown, zero means none recorded. Counts do not
        populate monthly average population or create user accounts.
      </p>
      {m.feedback}
      {manage && (
        <form
          key={editing?.id ?? 'new'}
          className="stack-form"
          aria-label={editing ? 'Correct occupancy' : 'Add occupancy'}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fields = Object.fromEntries(new FormData(form));
            const observation = {
              firstDay: fields.firstDay,
              lastDay: fields.lastDay,
              energyUseCode: fields.energyUseCode,
              regularCount: fields.regularCount || null,
              irregularCount: fields.irregularCount || null,
              source: fields.source,
              legacySource: fields.legacySource,
              legacyId: fields.legacyId,
            };
            void m.run(
              async () => {
                await request(
                  editing ? `${base}/${editing.id}/correct` : base,
                  'POST',
                  editing ? { observation, reason: fields.reason } : observation,
                );
                form.reset();
                setEditing(null);
                setHistory(null);
                await reload();
              },
              editing ? 'Occupancy corrected; previous values retained.' : 'Occupancy saved.',
            );
          }}
        >
          <h3>{editing ? 'Correct occupancy' : 'Add occupancy'}</h3>
          <fieldset className="form-grid" disabled={m.disabled}>
            <label>
              Occupancy end use
              <select
                name="energyUseCode"
                required
                defaultValue={editing?.energyUse.code ?? ''}
                aria-readonly={!!editing}
              >
                <option value="" disabled>
                  Choose an end use
                </option>
                {(editing ? [editing.energyUse] : uses).map((u) => (
                  <option value={u.code} key={u.id}>
                    {u.code} · {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Occupancy first day
              <input
                name="firstDay"
                type="date"
                required
                readOnly={!!editing}
                defaultValue={editing?.validFrom.slice(0, 10)}
              />
            </label>
            <label>
              Occupancy last day (inclusive)
              <input
                name="lastDay"
                type="date"
                required
                readOnly={!!editing}
                defaultValue={editing ? lastDay(editing.validUntil) : undefined}
              />
            </label>
            <label>
              Regular occupants
              <input
                name="regularCount"
                type="number"
                min="0"
                max="999999999"
                step="1"
                defaultValue={editing?.regularCount ?? ''}
              />
            </label>
            <label>
              Irregular occupants
              <input
                name="irregularCount"
                type="number"
                min="0"
                max="999999999"
                step="1"
                defaultValue={editing?.irregularCount ?? ''}
              />
            </label>
            <label>
              Occupancy source
              <input name="source" required minLength={3} maxLength={500} defaultValue={editing?.source} />
            </label>
            <label>
              Occupancy legacy source (optional)
              <input name="legacySource" maxLength={100} readOnly={!!editing} defaultValue={editing?.legacySource} />
            </label>
            <label>
              Occupancy legacy ID (optional)
              <input name="legacyId" maxLength={160} readOnly={!!editing} defaultValue={editing?.legacyId} />
            </label>
            {editing && (
              <label>
                Occupancy correction reason
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
            )}
          </fieldset>
          {!uses.length && <p>Register a site end use in Tariffs and end uses first.</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button disabled={m.disabled || !uses.length}>
              {editing ? 'Save occupancy correction' : 'Save occupancy'}
            </Button>
            {editing && (
              <Button type="button" variant="secondary" disabled={m.disabled} onClick={() => setEditing(null)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      {!data.length && <p>No occupancy records cover the selected year.</p>}
      {data.map((r) => (
        <article key={r.id} className="site-history-entry stack-form">
          <strong>
            {r.energyUse.code} · {r.validFrom.slice(0, 10)} to {lastDay(r.validUntil)}
          </strong>
          <p>
            Regular: {r.regularCount ?? 'Unknown'} · Irregular: {r.irregularCount ?? 'Unknown'} · Revision {r.revision}
          </p>
          <p>
            Source: {r.source}
            {r.legacyId ? ` · Legacy: ${r.legacySource}/${r.legacyId}` : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {manage && (
              <Button variant="secondary" disabled={m.disabled} onClick={() => setEditing(r)}>
                Correct occupancy
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={m.disabled}
              onClick={() =>
                void m.run(async () => {
                  setHistory({ id: r.id, rows: await request(`${base}/${r.id}/history`, 'GET') });
                }, 'Occupancy history loaded.')
              }
            >
              View occupancy history
            </Button>
          </div>
          {history?.id === r.id && (
            <ol>
              {history.rows.map((h) => (
                <li key={h.id}>
                  Revision {h.revision}: regular {h.regularCount ?? 'Unknown'}, irregular{' '}
                  {h.irregularCount ?? 'Unknown'} · {h.source} · {h.correctionReason ?? 'Original record'} ·{' '}
                  {new Date(h.createdAt).toLocaleString()} · Author {h.authorId}
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
      {manage && (
        <div className="stack-form">
          <h3>Import occupancy</h3>
          <p>
            One XLSX sheet, 1–240 rows, up to 2 MB. Columns:{' '}
            <code>firstDay, lastDay, energyUseCode, regularCount, irregularCount, source, legacySource, legacyId</code>.
            Use YYYY-MM-DD text dates and whole counts; leave unknown counts and optional legacy references blank. Map
            legacy site/use identities to this site and its registered codes before uploading. Explicit dates preserve
            the reviewed period; no date basis is inferred.
          </p>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const file = new FormData(form).get('file') as File;
              setBatch(null);
              setConfirmed(false);
              void m.run(async () => {
                const response = await fetch(`/api/v1/${base}/imports`, { method: 'POST', body: file });
                const result = await response.json();
                if (!response.ok) throw new Error(result.title ?? 'Upload failed.');
                setBatch(result);
                form.reset();
              }, 'Occupancy workbook checked. Review every row before importing.');
            }}
          >
            <label>
              Occupancy workbook
              <input
                name="file"
                type="file"
                accept=".xlsx"
                required
                disabled={m.disabled}
                onChange={() => {
                  setBatch(null);
                  setConfirmed(false);
                }}
              />
            </label>
            <Button disabled={m.disabled}>Preview occupancy workbook</Button>
          </form>
          <Button
            variant="secondary"
            disabled={m.disabled}
            onClick={() =>
              void m.run(async () => {
                setRecent(await request(`${base}/imports`, 'GET'));
              }, 'Recent occupancy imports loaded.')
            }
          >
            Load recent occupancy imports
          </Button>
          {recent.map((b) => (
            <Button
              key={b.id}
              variant="ghost"
              onClick={() => {
                setBatch(b);
                setConfirmed(false);
              }}
            >
              {new Date(b.createdAt).toLocaleString()} · {b.status}
            </Button>
          ))}
          {batch && (
            <div className="stack-form">
              <strong>
                Occupancy import: {batch.status} · {batch.result.sourceRows} source rows · {batch.result.records.length}{' '}
                parsed rows · {batch.result.issues.length} errors
              </strong>
              <ul>
                {batch.result.issues.map((issue, i) => (
                  <li key={i}>
                    Row {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
              <div style={{ overflowX: 'auto' }}>
                <table className="import-preview-table">
                  <caption>Occupancy import preview (all rows)</caption>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Period</th>
                      <th>End use</th>
                      <th>Regular</th>
                      <th>Irregular</th>
                      <th>Source</th>
                      <th>Legacy identity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.result.records.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>
                          {r.data.firstDay} to {r.data.lastDay}
                        </td>
                        <td>{r.data.energyUseCode}</td>
                        <td>{r.data.regularCount ?? 'Unknown'}</td>
                        <td>{r.data.irregularCount ?? 'Unknown'}</td>
                        <td>{r.data.source}</td>
                        <td>
                          {r.data.legacySource}/{r.data.legacyId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {batch.status === 'READY' && (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={m.disabled}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    I confirm the site, end uses, inclusive periods and separate occupant counts.
                  </label>
                  <Button
                    disabled={m.disabled || !confirmed}
                    onClick={() =>
                      void m.run(async () => {
                        setBatch(await request(`${base}/imports/${batch.id}/commit`, 'POST'));
                        setConfirmed(false);
                        setRecent([]);
                        await reload();
                      }, 'Occupancy imported.')
                    }
                  >
                    Commit occupancy import
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
