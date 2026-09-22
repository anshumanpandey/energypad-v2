'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import type { EventPreview } from '@/domain/events';
type Use = { id: string; code: string; name: string };
export type EventRecord = {
  id: string;
  validFrom: string;
  validUntil: string;
  eventCode: string;
  operation: string;
  comments: string;
  source: string;
  legacySource: string;
  legacyId: string;
  revision: number;
  correctionReason: string | null;
  createdAt: string;
  authorId: string;
  energyUse: Use;
};
type Batch = { id: string; status: string; result: EventPreview; createdAt: string };
const lastDay = (value: string) => new Date(+new Date(value) - 86400000).toISOString().slice(0, 10);
export function EventWorkspace({
  base,
  data,
  uses,
  manage,
  reload,
}: {
  base: string;
  data: EventRecord[];
  uses: Use[];
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [history, setHistory] = useState<{ id: string; rows: EventRecord[] } | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [recent, setRecent] = useState<Batch[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="panel stack-form" aria-label="Operational events">
      <h2>Operational events</h2>
      <p>
        Record operations, incidents and contextual evidence for a site end use and inclusive date range. Events may
        overlap. Each event has a stable site code; corrections preserve earlier evidence. Events do not imply verified
        savings or change energy readings.
      </p>
      {m.feedback}
      {manage && (
        <form
          key={editing?.id ?? 'new'}
          className="stack-form"
          aria-label={editing ? 'Correct event' : 'Add event'}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fields = Object.fromEntries(new FormData(form));
            const observation = {
              firstDay: fields.firstDay,
              lastDay: fields.lastDay,
              energyUseCode: fields.energyUseCode,
              eventCode: fields.eventCode,
              operation: fields.operation,
              comments: fields.comments,
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
              editing ? 'Event corrected; previous values retained.' : 'Event saved.',
            );
          }}
        >
          <h3>{editing ? 'Correct event' : 'Add event'}</h3>
          <fieldset className="form-grid" disabled={m.disabled}>
            <label>
              Event end use
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
              Event first day
              <input name="firstDay" type="date" required defaultValue={editing?.validFrom.slice(0, 10)} />
            </label>
            <label>
              Event last day (inclusive)
              <input
                name="lastDay"
                type="date"
                required
                defaultValue={editing ? lastDay(editing.validUntil) : undefined}
              />
            </label>
            <label>
              Event code
              <input name="eventCode" required maxLength={40} readOnly={!!editing} defaultValue={editing?.eventCode} />
            </label>
            <label>
              Operation
              <input name="operation" required maxLength={500} defaultValue={editing?.operation} />
            </label>
            <label>
              Event comments
              <textarea
                style={{
                  width: '100%',
                  border: '1px solid #d5ded5',
                  borderRadius: 8,
                  padding: '12px 13px',
                  resize: 'vertical',
                  background: '#fff',
                  color: 'var(--ink)',
                }}
                name="comments"
                maxLength={4000}
                rows={4}
                defaultValue={editing?.comments}
              />
            </label>
            <label>
              Event source
              <input name="source" required minLength={3} maxLength={500} defaultValue={editing?.source} />
            </label>
            <label>
              Event legacy source (optional)
              <input name="legacySource" maxLength={100} readOnly={!!editing} defaultValue={editing?.legacySource} />
            </label>
            <label>
              Event legacy ID (optional)
              <input name="legacyId" maxLength={160} readOnly={!!editing} defaultValue={editing?.legacyId} />
            </label>
            {editing && (
              <label>
                Event correction reason
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
            )}
          </fieldset>
          {!uses.length && <p>Register a site end use in Tariffs and end uses first.</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button disabled={m.disabled || !uses.length}>{editing ? 'Save event correction' : 'Save event'}</Button>
            {editing && (
              <Button type="button" variant="secondary" disabled={m.disabled} onClick={() => setEditing(null)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      {!data.length && <p>No event records cover the selected year.</p>}
      {data.map((r) => (
        <article key={r.id} className="site-history-entry stack-form">
          <strong>
            {r.eventCode} · {r.energyUse.code} · {r.validFrom.slice(0, 10)} to {lastDay(r.validUntil)}
          </strong>
          <p>
            {r.operation} · Revision {r.revision}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.comments || 'No comments recorded.'}</p>
          <p>
            Source: {r.source}
            {r.legacyId ? ` · Legacy: ${r.legacySource}/${r.legacyId}` : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {manage && (
              <Button variant="secondary" disabled={m.disabled} onClick={() => setEditing(r)}>
                Correct event
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={m.disabled}
              onClick={() =>
                void m.run(async () => {
                  setHistory({ id: r.id, rows: await request(`${base}/${r.id}/history`, 'GET') });
                }, 'Event history loaded.')
              }
            >
              View event history
            </Button>
          </div>
          {history?.id === r.id && (
            <ol>
              {history.rows.map((h) => (
                <li key={h.id}>
                  Revision {h.revision}: {h.validFrom.slice(0, 10)} to {lastDay(h.validUntil)} · {h.operation} ·{' '}
                  {h.comments} · {h.source} · {h.correctionReason ?? 'Original event'} ·{' '}
                  {new Date(h.createdAt).toLocaleString()} · Author {h.authorId}
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
      {manage && (
        <div className="stack-form">
          <h3>Import event</h3>
          <p>
            One XLSX sheet, 1–240 rows, up to 2 MB. Columns:{' '}
            <code>
              firstDay, lastDay, energyUseCode, eventCode, operation, comments, source, legacySource, legacyId
            </code>
            . Use YYYY-MM-DD text dates, a unique site event code and a registered end-use code. Comments and legacy
            references may be blank. Map source site/use IDs explicitly; no event evidence is interpreted as verified
            savings.
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
              }, 'Event workbook checked. Review every row before importing.');
            }}
          >
            <label>
              Event workbook
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
            <Button disabled={m.disabled}>Preview event workbook</Button>
          </form>
          <Button
            variant="secondary"
            disabled={m.disabled}
            onClick={() =>
              void m.run(async () => {
                setRecent(await request(`${base}/imports`, 'GET'));
              }, 'Recent event imports loaded.')
            }
          >
            Load recent event imports
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
                Event import: {batch.status} · {batch.result.sourceRows} source rows · {batch.result.records.length}{' '}
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
                  <caption>Event import preview (all rows)</caption>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Period</th>
                      <th>End use</th>
                      <th>Event code</th>
                      <th>Operation</th>
                      <th>Comments</th>
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
                        <td>{r.data.eventCode}</td>
                        <td>{r.data.operation}</td>
                        <td style={{ whiteSpace: 'pre-wrap' }}>{r.data.comments}</td>
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
                    I confirm the site, end uses, event codes, inclusive periods and source evidence.
                  </label>
                  <Button
                    disabled={m.disabled || !confirmed}
                    onClick={() =>
                      void m.run(async () => {
                        setBatch(await request(`${base}/imports/${batch.id}/commit`, 'POST'));
                        setConfirmed(false);
                        setRecent([]);
                        await reload();
                      }, 'Event imported.')
                    }
                  >
                    Commit event import
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
