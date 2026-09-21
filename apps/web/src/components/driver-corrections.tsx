'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
export type DriverRevision = {
  id: string;
  revision: number;
  correctionReason: string | null;
  authorId: string;
  createdAt: string;
  source: string;
  month?: string;
  driver?: string;
  value?: string;
  importBatchId?: string | null;
  name?: string;
  validFrom?: string;
  validUntil?: string;
  weeklyHours?: string;
};
const lastDay = (value: string) => new Date(+new Date(value) - 86400000).toISOString().slice(0, 10);
export function DriverCorrections({
  base,
  record,
  manage,
  reload,
}: {
  base: string;
  record: DriverRevision;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<DriverRevision[] | null>(null);
  const observation = !!record.month;
  const label = observation ? 'observation' : 'schedule';
  const path = `${base}/${observation ? 'observations' : 'schedules'}/${record.id}`;
  return (
    <div className="stack-form">
      <span>Revision {record.revision}</span>
      {m.feedback}
      <Button
        variant="ghost"
        disabled={m.disabled}
        onClick={() =>
          void m.run(async () => {
            setHistory(await request(`${path}/history`, 'GET'));
          }, 'Revision history loaded.')
        }
      >
        View {label} history
      </Button>
      {history && (
        <details open>
          <summary>{observation ? 'Observation' : 'Schedule'} revision history</summary>
          <div className="stack-form">
            {history.map((r) => (
              <article className="site-history-entry" key={r.id}>
                <strong>
                  Revision {r.revision} · {r.correctionReason ?? 'Original entry'}
                </strong>
                <p>
                  {r.month
                    ? `${r.month.slice(0, 7)} · ${r.driver} · ${r.value}`
                    : `${r.name} · ${r.weeklyHours} hours/week · ${r.validFrom!.slice(0, 10)} to ${lastDay(r.validUntil!)} inclusive`}
                </p>
                <p>Source: {r.source}</p>
                <p className="muted" style={{ overflowWrap: 'anywhere' }}>
                  Recorded {new Date(r.createdAt).toLocaleString()} · Author {r.authorId}
                </p>
                {r.importBatchId && <p style={{ overflowWrap: 'anywhere' }}>Origin import: {r.importBatchId}</p>}
              </article>
            ))}
          </div>
        </details>
      )}
      {manage && !editing && (
        <Button variant="secondary" disabled={m.disabled} onClick={() => setEditing(true)}>
          Correct {label}
        </Button>
      )}
      {manage && editing && (
        <form
          className="stack-form"
          aria-label={`Correct ${label}`}
          onSubmit={(e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            const { reason, ...fields } = values;
            void m.run(async () => {
              await request(
                `${path}/correct`,
                'POST',
                observation
                  ? { reason, observation: { ...fields, month: record.month!.slice(0, 7), driver: record.driver } }
                  : { reason, schedule: fields },
              );
              setEditing(false);
              await reload();
            }, 'Correction saved.');
          }}
        >
          <p>
            {observation ? 'The month and driver stay fixed.' : 'Dates must not overlap another current schedule.'}{' '}
            Saving preserves the previous revision.
          </p>
          <fieldset className="form-grid" disabled={m.disabled}>
            {observation ? (
              <label>
                Corrected observed value
                <input
                  name="value"
                  type="number"
                  min="0"
                  max="9999999999.999"
                  step="0.001"
                  defaultValue={record.value}
                  required
                />
              </label>
            ) : (
              <>
                <label>
                  Corrected schedule name
                  <input name="name" maxLength={100} defaultValue={record.name} required />
                </label>
                <label>
                  Corrected first day
                  <input name="firstDay" type="date" defaultValue={record.validFrom!.slice(0, 10)} required />
                </label>
                <label>
                  Corrected last day (inclusive)
                  <input name="lastDay" type="date" defaultValue={lastDay(record.validUntil!)} required />
                </label>
                <label>
                  Corrected weekly hours
                  <input
                    name="weeklyHours"
                    type="number"
                    min="0"
                    max="168"
                    step="0.001"
                    defaultValue={record.weeklyHours}
                    required
                  />
                </label>
              </>
            )}
            <label>
              Corrected source
              <input name="source" minLength={3} maxLength={500} defaultValue={record.source} required />
            </label>
            <label>
              Correction reason
              <input name="reason" minLength={3} maxLength={500} required />
            </label>
          </fieldset>
          <div className="button-row">
            <Button disabled={m.disabled}>Save {label} correction</Button>
            <Button type="button" variant="secondary" disabled={m.disabled} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
