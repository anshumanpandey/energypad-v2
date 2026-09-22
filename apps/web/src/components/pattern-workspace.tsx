'use client';
import {
  WorkbookTemplateFields,
  workbookSelection,
  WorkbookSelectionSummary,
  type WorkbookSelection,
} from './workbook-template';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import type { PatternPreview } from '@/domain/patterns';
type Use = { id: string; code: string; name: string };
export type PatternRecord = {
  id: string;
  validFrom: string;
  validUntil: string;
  daysOnYear: number | null;
  temperature: string | null;
  temperatureUnit: string;
  temperatureContext: string;
  warnings: string[];
  source: string;
  legacySource: string;
  legacyId: string;
  revision: number;
  correctionReason: string | null;
  createdAt: string;
  authorId: string;
  energyUse: Use;
};
type Batch = {
  id: string;
  status: string;
  result: PatternPreview & { selection?: WorkbookSelection };
  createdAt: string;
};
const lastDay = (value: string) => new Date(+new Date(value) - 86400000).toISOString().slice(0, 10);
export function PatternWorkspace({
  base,
  data,
  uses,
  manage,
  reload,
}: {
  base: string;
  data: PatternRecord[];
  uses: Use[];
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [editing, setEditing] = useState<PatternRecord | null>(null);
  const [history, setHistory] = useState<{ id: string; rows: PatternRecord[] } | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [recent, setRecent] = useState<Batch[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="panel stack-form" aria-label="Operating patterns">
      <h2>Operating patterns</h2>
      <p>
        Preserve annual active days and temperature/setpoint evidence for each site end use and inclusive validity
        period. Blank means unknown; zero is retained. Patterns do not generate observed hours or change weather base
        temperatures.
      </p>
      {m.feedback}
      {manage && (
        <form
          key={editing?.id ?? 'new'}
          className="stack-form"
          aria-label={editing ? 'Correct pattern' : 'Add pattern'}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fields = Object.fromEntries(new FormData(form));
            const observation = {
              firstDay: fields.firstDay,
              lastDay: fields.lastDay,
              energyUseCode: fields.energyUseCode,
              daysOnYear: fields.daysOnYear || null,
              temperature: fields.temperature || null,
              temperatureUnit: fields.temperatureUnit,
              temperatureContext: fields.temperatureContext,
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
              editing ? 'Pattern corrected; previous values retained.' : 'Pattern saved.',
            );
          }}
        >
          <h3>{editing ? 'Correct pattern' : 'Add pattern'}</h3>
          <fieldset className="form-grid" disabled={m.disabled}>
            <label>
              Pattern end use
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
              Pattern first day
              <input name="firstDay" type="date" required defaultValue={editing?.validFrom.slice(0, 10)} />
            </label>
            <label>
              Pattern last day (inclusive)
              <input
                name="lastDay"
                type="date"
                required
                defaultValue={editing ? lastDay(editing.validUntil) : undefined}
              />
            </label>
            <label>
              Annual active days
              <input
                name="daysOnYear"
                type="number"
                min="0"
                max="366"
                step="1"
                defaultValue={editing?.daysOnYear ?? ''}
              />
            </label>
            <label>
              Pattern temperature
              <input
                name="temperature"
                type="number"
                min="-999.999"
                max="999.999"
                step="0.001"
                defaultValue={editing?.temperature ?? ''}
              />
            </label>
            <label>
              Temperature unit
              <select name="temperatureUnit" defaultValue={editing?.temperatureUnit ?? 'UNKNOWN'}>
                <option value="UNKNOWN">Unknown</option>
                <option value="C">Celsius (°C)</option>
                <option value="F">Fahrenheit (°F)</option>
              </select>
            </label>
            <label>
              Temperature context
              <select name="temperatureContext" defaultValue={editing?.temperatureContext ?? 'UNKNOWN'}>
                <option value="UNKNOWN">Unknown</option>
                <option value="HEATING">Heating setpoint</option>
                <option value="COOLING">Cooling setpoint</option>
                <option value="OTHER">Other recorded temperature</option>
              </select>
            </label>
            <label>
              Pattern source
              <input name="source" required minLength={3} maxLength={500} defaultValue={editing?.source} />
            </label>
            <label>
              Pattern legacy source (optional)
              <input name="legacySource" maxLength={100} readOnly={!!editing} defaultValue={editing?.legacySource} />
            </label>
            <label>
              Pattern legacy ID (optional)
              <input name="legacyId" maxLength={160} readOnly={!!editing} defaultValue={editing?.legacyId} />
            </label>
            {editing && (
              <label>
                Pattern correction reason
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
            )}
          </fieldset>
          {!uses.length && <p>Register a site end use in Tariffs and end uses first.</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button disabled={m.disabled || !uses.length}>
              {editing ? 'Save pattern correction' : 'Save pattern'}
            </Button>
            {editing && (
              <Button type="button" variant="secondary" disabled={m.disabled} onClick={() => setEditing(null)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      {!data.length && <p>No pattern records cover the selected year.</p>}
      {data.map((r) => (
        <article key={r.id} className="site-history-entry stack-form">
          <strong>
            {r.energyUse.code} · {r.validFrom.slice(0, 10)} to {lastDay(r.validUntil)}
          </strong>
          <p>
            Annual active days: {r.daysOnYear ?? 'Unknown'} · Temperature: {r.temperature ?? 'Unknown'}{' '}
            {r.temperatureUnit} · {r.temperatureContext} · Revision {r.revision}
          </p>
          <ul>
            {r.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p>
            Source: {r.source}
            {r.legacyId ? ` · Legacy: ${r.legacySource}/${r.legacyId}` : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {manage && (
              <Button variant="secondary" disabled={m.disabled} onClick={() => setEditing(r)}>
                Correct pattern
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={m.disabled}
              onClick={() =>
                void m.run(async () => {
                  setHistory({ id: r.id, rows: await request(`${base}/${r.id}/history`, 'GET') });
                }, 'Pattern history loaded.')
              }
            >
              View pattern history
            </Button>
          </div>
          {history?.id === r.id && (
            <ol>
              {history.rows.map((h) => (
                <li key={h.id}>
                  Revision {h.revision}: {h.validFrom.slice(0, 10)} to {lastDay(h.validUntil)} · annual days{' '}
                  {h.daysOnYear ?? 'Unknown'}, temperature {h.temperature ?? 'Unknown'} {h.temperatureUnit} ·{' '}
                  {h.temperatureContext} · {h.source} · {h.correctionReason ?? 'Original record'} ·{' '}
                  {new Date(h.createdAt).toLocaleString()} · Author {h.authorId}
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
      {manage && (
        <div className="stack-form">
          <h3>Import pattern</h3>
          <p>
            One selected XLSX sheet, 1–240 rows, up to 2 MB. Destination columns:{' '}
            <code>
              firstDay, lastDay, energyUseCode, daysOnYear, temperature, temperatureUnit, temperatureContext, source,
              legacySource, legacyId
            </code>
            . Use YYYY-MM-DD text dates, annual days 0–366, and explicit temperatureUnit C/F/UNKNOWN and
            temperatureContext HEATING/COOLING/OTHER/UNKNOWN. Leave missing days/temperature blank. Map legacy site/use
            identities to this site and its registered codes before uploading. Explicit dates preserve the reviewed
            period; no date basis is inferred.
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
                const response = await fetch(`/api/v1/${base}/imports?${await workbookSelection(form)}`, {
                  method: 'POST',
                  body: file,
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.title ?? 'Upload failed.');
                setBatch(result);
                form.reset();
              }, 'Pattern workbook checked. Review every row before importing.');
            }}
          >
            <label>
              Pattern workbook
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
            <WorkbookTemplateFields kind="patterns" />
            <Button disabled={m.disabled}>Preview pattern workbook</Button>
          </form>
          <Button
            variant="secondary"
            disabled={m.disabled}
            onClick={() =>
              void m.run(async () => {
                setRecent(await request(`${base}/imports`, 'GET'));
              }, 'Recent pattern imports loaded.')
            }
          >
            Load recent pattern imports
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
              <WorkbookSelectionSummary selection={batch.result.selection} />
              <strong>
                Pattern import: {batch.status} · {batch.result.sourceRows} source rows · {batch.result.records.length}{' '}
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
                  <caption>Pattern import preview (all rows)</caption>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Period</th>
                      <th>End use</th>
                      <th>Annual days</th>
                      <th>Temperature/context</th>
                      <th>Review warnings</th>
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
                        <td>{r.data.daysOnYear ?? 'Unknown'}</td>
                        <td>
                          {r.data.temperature ?? 'Unknown'} {r.data.temperatureUnit} · {r.data.temperatureContext}
                        </td>
                        <td>{r.warnings.join(' ')}</td>
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
                    I confirm the site, end uses, inclusive periods, annual-day basis and temperature evidence,
                    including review warnings.
                  </label>
                  <Button
                    disabled={m.disabled || !confirmed}
                    onClick={() =>
                      void m.run(async () => {
                        setBatch(await request(`${base}/imports/${batch.id}/commit`, 'POST'));
                        setConfirmed(false);
                        setRecent([]);
                        await reload();
                      }, 'Pattern imported.')
                    }
                  >
                    Commit pattern import
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
