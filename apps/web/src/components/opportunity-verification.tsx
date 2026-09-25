'use client';
import { useState } from 'react';
import { VerificationRunPicker } from './verification-run-picker';
import { Button } from './ui/button';
import type { AnalyticsReport } from '@/domain/analytics-report';
export type VerificationRecord = {
  id: string;
  revision: number;
  implementationDate: string;
  note: string;
  references: string[];
  report: AnalyticsReport;
  reportHash: string;
  workVersionId: string;
  createdAt: string;
  authorId: string;
  eligibility: { policy: string; status: string; verifiedKwh: null; issues: { code: string; message: string }[] };
};
export type VerificationPayload = {
  previousId: string | null;
  eventId: string;
  workVersionId: string;
  runId: string;
  carbonRunId?: string;
  implementationDate: string;
  note: string;
  references: string[];
};
export function VerificationForm({
  optionsPath,
  previous,
  eventId,
  workVersionId,
  disabled,
  onSave,
}: {
  optionsPath: string;
  previous?: VerificationRecord;
  eventId: string;
  workVersionId: string;
  disabled: boolean;
  onSave: (payload: VerificationPayload) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [implementationDate, setImplementationDate] = useState(previous?.implementationDate.slice(0, 10) ?? '');
  const [runId, setRunId] = useState('');
  return (
    <form
      className="stack-form"
      aria-label="Verification evidence"
      onSubmit={async (e) => {
        e.preventDefault();
        if (disabled || !runId) return;
        setError('');
        const data = new FormData(e.currentTarget);
        try {
          await onSave({
            previousId: previous?.id ?? null,
            eventId,
            workVersionId,
            runId,
            ...(data.get('carbonRunId') ? { carbonRunId: String(data.get('carbonRunId')) } : {}),
            implementationDate: String(data.get('implementationDate')),
            note: String(data.get('note')),
            references: String(data.get('references'))
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean),
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to submit evidence.');
        }
      }}
    >
      <h4>{previous ? 'Revise verification evidence' : 'Submit verification evidence'}</h4>
      <p>
        Select a new saved reporting run for the same meter and exact baseline. Its period must follow both the
        investigation period and the implementation date by a full calendar-month boundary. Record the actual
        implementation date supported by your references. Submission preserves evidence for review; it does not verify
        savings.
      </p>
      <fieldset disabled={disabled} className="stack-form">
        <label>
          Implementation completion date
          <input
            type="date"
            name="implementationDate"
            required
            value={implementationDate}
            onChange={(event) => {
              setImplementationDate(event.target.value);
              setRunId('');
            }}
          />
        </label>
        {implementationDate ? (
          <VerificationRunPicker
            key={implementationDate}
            path={optionsPath}
            implementationDate={implementationDate}
            onSelect={setRunId}
          />
        ) : (
          <p>Enter the implementation completion date to find saved reporting runs.</p>
        )}
        {runId && (
          <VerificationRunPicker
            key={`${implementationDate}-${runId}`}
            path={optionsPath}
            implementationDate={implementationDate}
            runId={runId}
          />
        )}
        <label>
          Supporting references (one per line)
          <textarea name="references" required maxLength={5000} defaultValue={previous?.references.join('\n')} />
        </label>
        <label>
          Verification explanation
          <textarea name="note" required minLength={10} maxLength={4000} />
        </label>
        <Button type="submit" disabled={!runId}>
          Save verification evidence
        </Button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function VerificationHistory({ records }: { records: VerificationRecord[] }) {
  if (!records.length) return null;
  const latest = records.at(-1)!;
  return (
    <section className="stack-form" aria-label="Verification records">
      <h4>Verification · revision {latest.revision}</h4>
      <strong>Verified savings: unavailable</strong>
      <ul>
        {latest.eligibility.issues.map((i) => (
          <li key={i.code}>{i.message}</li>
        ))}
      </ul>
      <p>
        Submitted period: {latest.report.period.firstMonth} – {latest.report.period.lastMonth} · {latest.report.status}
      </p>
      <p>
        Submitted post-NRA energy variance: {latest.report.summary.postKwh ?? 'Unavailable'} kWh. This is an
        experimental result, not a verified outcome.
      </p>
      <p>Implementation completion date: {latest.implementationDate.slice(0, 10)}</p>
      <p>{latest.note}</p>
      <ul>
        {latest.references.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <details>
        <summary>Verification evidence history</summary>
        {records.map((v) => (
          <div key={v.id}>
            <p>
              Revision {v.revision} · {v.createdAt} · Author: {v.authorId}
            </p>
            <p>{v.note}</p>
            <p>
              Report hash: {v.reportHash} · Action plan: {v.workVersionId}
            </p>
            <div className="analysis-table">
              <pre>{JSON.stringify(v, null, 2)}</pre>
            </div>
          </div>
        ))}
      </details>
    </section>
  );
}
