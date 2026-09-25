'use client';
import { OperationalLogPicker } from './operational-log-picker';
import { useState } from 'react';
import { Button } from './ui/button';
import type { WorkVersion } from './opportunity-work';
export type SupportingOptions = {
  energyUses: { id: string; code: string; name: string }[];
  logs: { id: string; eventCode: string; operation: string; revision: number; superseded?: boolean }[];
  nextCursor?: string | null;
};
export type SupportingRecord = {
  id: string;
  previousId: string | null;
  revision: number;
  kind: string;
  note: string;
  createdAt: string;
  authorId: string;
  snapshotHash: string;
  snapshot: {
    source: {
      title?: string;
      question?: string;
      answers?: string[];
      category?: string;
      text?: string;
      month?: string;
      operation?: string;
      comments?: string;
      eventCode?: string;
      source: string;
      energyUse: { name: string; code: string };
    };
    action: { title: string } | null;
  };
};
export function SupportingEvidence({
  logOptionsPath,
  records,
  options,
  eventId,
  work,
  editable,
  disabled,
  onSave,
}: {
  logOptionsPath: string;
  records: SupportingRecord[];
  options: SupportingOptions;
  eventId: string;
  work?: WorkVersion;
  editable: boolean;
  disabled: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [kind, setKind] = useState('LOG');
  const [error, setError] = useState('');
  const latest = records.filter((r) => !records.some((next) => next.previousId === r.id));
  return (
    <section className="stack-form" aria-label="Supporting investigation evidence">
      <h4>Operational logs, programmes and tips</h4>
      <p>
        Preserve supporting evidence and recommendations with their source and end use. These records do not establish
        measured or verified savings.
      </p>
      {!latest.length && <p>No supporting records yet.</p>}
      {latest.map((record) => (
        <article key={record.id} className="stack-form">
          <strong>
            {record.kind} · revision {record.revision}
          </strong>
          <p>{record.snapshot.source.title ?? record.snapshot.source.eventCode ?? record.snapshot.source.category}</p>
          <p>{record.snapshot.source.question ?? record.snapshot.source.operation ?? record.snapshot.source.text}</p>
          {record.snapshot.source.answers && (
            <ul>
              {record.snapshot.source.answers.map((answer, i) => (
                <li key={i}>{answer}</li>
              ))}
            </ul>
          )}
          {record.snapshot.source.comments && <p>{record.snapshot.source.comments}</p>}
          <p>
            End use: {record.snapshot.source.energyUse.code} · {record.snapshot.source.energyUse.name}
          </p>
          <p>
            Source: {record.snapshot.source.source}
            {record.snapshot.source.month ? ` · Month: ${record.snapshot.source.month}` : ''}
          </p>
          {record.snapshot.action && <p>Linked action: {record.snapshot.action.title}</p>}
          <p>{record.note}</p>
        </article>
      ))}
      {!!records.length && (
        <details>
          <summary>Supporting evidence history</summary>
          {records.map((record) => (
            <div key={record.id}>
              <p>
                {record.kind} · revision {record.revision} · {record.createdAt}
              </p>
              <p>
                {record.note} · Author: {record.authorId}
              </p>
              <p>Snapshot hash: {record.snapshotHash}</p>
              <div className="analysis-table">
                <pre>{JSON.stringify(record, null, 2)}</pre>
              </div>
            </div>
          ))}
        </details>
      )}
      {editable && (
        <form
          aria-label="Add supporting evidence"
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (disabled) return;
            setError('');
            const form = e.currentTarget;
            const fields = new FormData(form);
            const value = (key: string) => String(fields.get(key) ?? '').trim();
            const payload = {
              kind,
              previousId: value('previousId') || null,
              eventId,
              workVersionId: work?.id ?? null,
              actionId: value('actionId') || null,
              note: value('note'),
              ...(kind === 'LOG'
                ? { operationalEventId: value('operationalEventId') }
                : {
                    energyUseId: value('energyUseId'),
                    source: value('source'),
                    legacySource: value('legacySource'),
                    legacyId: value('legacyId'),
                    ...(kind === 'PROGRAMME'
                      ? {
                          title: value('title'),
                          question: value('question'),
                          answers: value('answers')
                            .split('\n')
                            .map((a) => a.trim())
                            .filter(Boolean),
                        }
                      : { category: value('category'), text: value('text'), month: value('month') }),
                  }),
            };
            try {
              await onSave(payload);
              form.reset();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to save evidence.');
            }
          }}
        >
          <fieldset disabled={disabled} className="stack-form">
            <label>
              Evidence kind
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="LOG">Operational log</option>
                <option value="PROGRAMME">Programme / checklist answer</option>
                <option value="TIP">Curated tip</option>
              </select>
            </label>
            <label>
              Record to amend
              <select name="previousId" key={kind}>
                <option value="">Add a new record</option>
                {latest
                  .filter((r) => r.kind === kind)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.note} · revision {r.revision}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Linked action (optional)
              <select name="actionId">
                <option value="">Investigation only</option>
                {work?.actions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
            {kind === 'LOG' ? (
              <OperationalLogPicker path={logOptionsPath} initial={options} disabled={disabled} />
            ) : (
              <>
                <label>
                  Evidence end use
                  <select name="energyUseId" required>
                    <option value="">Select an end use</option>
                    {options.energyUses.map((use) => (
                      <option key={use.id} value={use.id}>
                        {use.code} · {use.name}
                      </option>
                    ))}
                  </select>
                </label>
                {kind === 'PROGRAMME' ? (
                  <>
                    <label>
                      Programme or checklist title
                      <input name="title" required maxLength={200} />
                    </label>
                    <label>
                      Question
                      <textarea name="question" required maxLength={2000} />
                    </label>
                    <label>
                      Answers (one per line)
                      <textarea name="answers" required maxLength={20000} />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Tip category
                      <input name="category" required maxLength={200} />
                    </label>
                    <label>
                      Recommendation
                      <textarea name="text" required maxLength={2500} />
                    </label>
                    <label>
                      Applicable month
                      <input name="month" type="month" required />
                    </label>
                  </>
                )}
                <label>
                  Evidence source or reference
                  <input name="source" required maxLength={500} />
                </label>
                <details>
                  <summary>Legacy provenance (optional)</summary>
                  <label>
                    Legacy source
                    <input name="legacySource" maxLength={200} />
                  </label>
                  <label>
                    Legacy record ID
                    <input name="legacyId" maxLength={200} />
                  </label>
                </details>
              </>
            )}
            <label>
              Evidence note / correction reason
              <textarea name="note" required minLength={10} maxLength={2000} />
            </label>
            <Button type="submit">Save supporting evidence</Button>
          </fieldset>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}
