'use client';
import {
  WorkbookTemplateFields,
  workbookSelection,
  WorkbookSelectionSummary,
  type WorkbookSelection,
} from './workbook-template';
import { DriverCorrections, type DriverRevision } from './driver-corrections';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { driverLabels, type DriverPreview } from '@/domain/drivers';
export type DriverData = {
  observations: (DriverRevision & {
    id: string;
    month: string;
    driver: keyof typeof driverLabels;
    value: string;
    source: string;
    createdAt: string;
  })[];
  schedules: (DriverRevision & {
    id: string;
    name: string;
    validFrom: string;
    validUntil: string;
    weeklyHours: string;
    source: string;
  })[];
  coverage: { driver: keyof typeof driverLabels; missing: string[] }[];
};
type Batch = {
  id: string;
  status: string;
  createdAt: string;
  result: DriverPreview & { selection?: WorkbookSelection };
};
export function DriverWorkspace({
  base,
  year,
  data,
  manage,
  reload,
}: {
  base: string;
  year: number;
  data: DriverData;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [recent, setRecent] = useState<Batch[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="panel stack-form" aria-label="Drivers and schedules">
      <h2>Monthly drivers · {year}</h2>
      <p>
        Record average population and total site operating hours for each calendar month. Zero is a recorded value;
        missing observations stay unknown. These observations are separate from historical site attributes and planned
        weekly schedules.
      </p>
      {m.feedback}
      {data.coverage.map((c) => (
        <div className="site-history-entry" key={c.driver}>
          <strong>
            {driverLabels[c.driver]} · {12 - c.missing.length}/12 months observed
          </strong>
          <p>{c.missing.length ? `Missing observations: ${c.missing.join(', ')}` : 'Complete calendar year'}</p>
        </div>
      ))}
      {manage && (
        <form
          className="stack-form"
          aria-label="Add monthly observation"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const values = Object.fromEntries(new FormData(form));
            void m.run(async () => {
              await request(base, 'POST', values);
              form.reset();
              await reload();
            }, 'Monthly observation saved.');
          }}
        >
          <h3>Add monthly observation</h3>
          <fieldset className="form-grid" disabled={m.disabled}>
            <label>
              Observation month
              <input name="month" type="month" required />
            </label>
            <label>
              Observed driver
              <select name="driver">
                {Object.entries(driverLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observed value
              <input name="value" type="number" min="0" max="9999999999.999" step="0.001" required />
            </label>
            <label>
              Observation source
              <input
                name="source"
                minLength={3}
                maxLength={500}
                required
                placeholder="Monthly attendance report or operations log"
              />
            </label>
          </fieldset>
          <p className="field-hint">
            Population is the average number of people over the month. Operating hours are total elapsed site operating
            hours, not staff-hours, daily averages or weekly hours. Existing driver/month values cannot be overwritten.
          </p>
          <Button disabled={m.disabled}>Save observation</Button>
        </form>
      )}
      {!!data.observations.length && (
        <div style={{ overflowX: 'auto' }}>
          <table className="import-preview-table">
            <caption>Monthly observations</caption>
            <thead>
              <tr>
                <th>Month</th>
                <th>Driver</th>
                <th>Value</th>
                <th>Source</th>
                <th>History and corrections</th>
              </tr>
            </thead>
            <tbody>
              {data.observations.map((o) => (
                <tr key={o.id}>
                  <td>{o.month.slice(0, 7)}</td>
                  <td>{driverLabels[o.driver]}</td>
                  <td>{o.value}</td>
                  <td>{o.source}</td>
                  <td>
                    <DriverCorrections base={base} record={o} manage={manage} reload={reload} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3>Operating schedules</h3>
      <p>
        Planned weekly hours apply to the date range shown, including both dates. They do not populate monthly
        observations. One site-wide schedule may apply on any day.
      </p>
      {!data.schedules.length && <p>No planned schedule covers this year.</p>}
      {data.schedules.map((s) => (
        <article className="site-history-entry" key={s.id}>
          <strong>
            {s.name} · {s.weeklyHours} hours/week
          </strong>
          <p>
            {s.validFrom.slice(0, 10)} to {new Date(+new Date(s.validUntil) - 86400000).toISOString().slice(0, 10)}{' '}
            inclusive
          </p>
          <p>Source: {s.source}</p>
          <DriverCorrections base={base} record={s} manage={manage} reload={reload} />
        </article>
      ))}
      {manage && (
        <form
          className="stack-form"
          aria-label="Add operating schedule"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const values = Object.fromEntries(new FormData(form));
            void m.run(async () => {
              await request(`${base}/schedules`, 'POST', values);
              form.reset();
              await reload();
            }, 'Operating schedule saved.');
          }}
        >
          <fieldset className="form-grid" disabled={m.disabled}>
            <label>
              Schedule name
              <input name="name" required maxLength={100} />
            </label>
            <label>
              First day
              <input name="firstDay" type="date" required />
            </label>
            <label>
              Last day (inclusive)
              <input name="lastDay" type="date" required />
            </label>
            <label>
              Planned weekly hours
              <input name="weeklyHours" type="number" min="0" max="168" step="0.001" required />
            </label>
            <label>
              Schedule source
              <input name="source" required minLength={3} maxLength={500} />
            </label>
          </fieldset>
          <Button disabled={m.disabled}>Save operating schedule</Button>
        </form>
      )}
      {manage && (
        <div className="stack-form">
          <h3>Import monthly drivers</h3>
          <p>
            Import one selected XLSX sheet with these destination columns: <code>month, driver, value, source</code>.
            Use text months (YYYY-MM) and driver codes POPULATION or OPERATING_HOURS. Each row is one observation. Up to
            240 rows, 2 MB. Formatted cells and saved formula results are supported; recalculate and save before
            uploading.
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
              }, 'Driver workbook checked. Review the preview before importing.');
            }}
          >
            <label>
              Driver workbook
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
            <WorkbookTemplateFields kind="drivers" />
            <Button disabled={m.disabled}>Preview driver workbook</Button>
          </form>
          <Button
            variant="secondary"
            disabled={m.disabled}
            onClick={() =>
              void m.run(async () => {
                setRecent(await request(`${base}/imports`, 'GET'));
              }, 'Recent driver imports loaded.')
            }
          >
            Load recent driver imports
          </Button>
          {recent.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              disabled={m.disabled}
              onClick={() => {
                setBatch(item);
                setConfirmed(false);
              }}
            >
              {new Date(item.createdAt).toLocaleString()} · {item.status}
            </Button>
          ))}
          {batch && (
            <div className="stack-form">
              <WorkbookSelectionSummary selection={batch.result.selection} />
              <strong>
                Driver import: {batch.status} · {batch.result.records.length} valid rows · {batch.result.issues.length}{' '}
                errors
              </strong>
              {batch.result.issues.length > 0 && (
                <>
                  <ul>
                    {batch.result.issues.map((issue, i) => (
                      <li key={i}>
                        Row {issue.row} · {issue.field}: {issue.message}
                      </li>
                    ))}
                  </ul>
                  <p>Correct the workbook and upload again. No observations have been imported.</p>
                </>
              )}
              {!!batch.result.records.length && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="import-preview-table">
                    <caption>Driver import preview (all rows)</caption>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Month</th>
                        <th>Driver</th>
                        <th>Value</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.result.records.map((r) => (
                        <tr key={r.row}>
                          <td>{r.row}</td>
                          <td>{r.data.month}</td>
                          <td>{driverLabels[r.data.driver]}</td>
                          <td>{r.data.value}</td>
                          <td>{r.data.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {batch.status === 'READY' && (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={m.disabled}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    I confirm the selected site, monthly average population and monthly total hours.
                  </label>
                  <Button
                    disabled={m.disabled || !confirmed}
                    onClick={() =>
                      void m.run(async () => {
                        const result = await request(`${base}/imports/${batch.id}/commit`, 'POST');
                        setBatch(result);
                        setRecent([]);
                        setConfirmed(false);
                        await reload();
                      }, 'Driver observations imported.')
                    }
                  >
                    Commit driver import
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
