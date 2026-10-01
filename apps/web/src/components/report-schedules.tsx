'use client';
import { DateInput } from './ui/date-input';
import { useId, useRef, useState } from 'react';
import { request } from './forms';
import { Button } from './ui/button';
export type ScheduleRecipient = { id: string; label: string; siteIds: string[] | null };
type Revision = {
  id: string;
  scheduleId: string;
  revision: number;
  state: string;
  archiveId: string;
  fingerprint: string;
  recipientMembershipIds: string[];
  timezone: string;
  createdAt: string;
};
type Schedule = { id: string; latest: Revision };
type Archive = { id: string; family: string; fingerprint: string; createdAt: string };
type Job = { id: string; revisionId: string; occurrenceAt: string; status: string };
type DeliveryCheck = {
  id: string;
  attempt: number;
  status: string;
  code: string | null;
  startedAt: string;
  finishedAt: string | null;
  leaseUntil: string;
};
type Page<T> = { items: T[]; nextCursor: string | null };
const empty = <T,>(): Page<T> => ({ items: [], nextCursor: null });
function append<T extends { id: string }>(previous: Page<T>, next: Page<T>, older: boolean): Page<T> {
  return {
    ...next,
    items: older
      ? [...new Map([...previous.items, ...next.items].map((item) => [item.id, item])).values()]
      : next.items,
  };
}
export function ReportSchedules({
  path,
  siteId,
  recipients,
  selfId,
  canWrite,
  defaultTimezone,
}: {
  path: string;
  siteId: string;
  recipients: ScheduleRecipient[];
  selfId: string;
  canWrite: boolean;
  defaultTimezone: string;
}) {
  const archiveControlId = useId();
  const [schedules, setSchedules] = useState(empty<Schedule>);
  const [archives, setArchives] = useState(empty<Archive>);
  const [history, setHistory] = useState(empty<Revision>);
  const [checksReadAt, setChecksReadAt] = useState(0);
  const [checkJob, setCheckJob] = useState<string | null>(null);
  const [checks, setChecks] = useState(empty<DeliveryCheck>);
  const [jobs, setJobs] = useState(empty<Job>);
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [editing, setEditing] = useState(false);
  const [archive, setArchive] = useState<{ id: string; fingerprint: string } | null>(null);
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [recipientIds, setRecipientIds] = useState<string[]>([selfId]);
  const [occurrence, setOccurrence] = useState('');
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const checkKeys = useRef(new Map<string, string>());
  const keys = useRef(new Map<string, string>());
  const eligibleRecipients = recipients.filter((r) => r.siteIds === null || r.siteIds.includes(siteId));
  const choices = [
    ...eligibleRecipients,
    ...recipientIds
      .filter((id) => !eligibleRecipients.some((r) => r.id === id))
      .map((id) => ({ id, label: `Unavailable member (${id})`, siteIds: null })),
  ];
  async function run(work: () => Promise<void>) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to manage report schedules.');
    } finally {
      setPending(false);
    }
  }
  async function loadSchedules(older = false) {
    const page = await request(
      `${path}${older && schedules.nextCursor ? `?cursor=${schedules.nextCursor}` : ''}`,
      'GET',
    );
    setSchedules((old) => append(old, page, older));
    setLoaded(true);
  }
  async function loadArchives(older = false) {
    const page = await request(
      `${path.replace(/report-schedules$/, 'report-archives')}${older && archives.nextCursor ? `?cursor=${archives.nextCursor}` : ''}`,
      'GET',
    );
    setArchives((old) => append(old, page, older));
  }
  async function open(id: string) {
    const [detail, revisions, occurrences] = await Promise.all([
      request(`${path}/${id}`, 'GET'),
      request(`${path}/${id}/history`, 'GET'),
      request(`${path}/${id}/jobs`, 'GET'),
    ]);
    setCheckJob(null);
    setChecks(empty());
    setSelected(detail);
    setHistory(revisions);
    setJobs(occurrences);
    setEditing(true);
    setArchive({ id: detail.latest.archiveId, fingerprint: detail.latest.fingerprint });
    setTimezone(detail.latest.timezone);
    setRecipientIds(detail.latest.recipientMembershipIds);
    setOccurrence('');
  }
  async function mutate(payload: object) {
    const identity = JSON.stringify(payload);
    if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
    return request(path, 'POST', { ...payload, requestKey: keys.current.get(identity) });
  }
  async function loadChecks(jobId: string, older = false) {
    if (!selected) return;
    const page = await request(
      `${path}/${selected.id}/jobs/${jobId}/checks${older && checks.nextCursor ? `?cursor=${checks.nextCursor}` : ''}`,
      'GET',
    );
    setChecksReadAt(new Date(page.checkedAt).getTime());
    setCheckJob(jobId);
    setChecks((old) => append(old, page, older));
  }
  async function runCheck(jobId: string) {
    if (!selected) return;
    if (!checkKeys.current.has(jobId)) checkKeys.current.set(jobId, crypto.randomUUID());
    const result = await request(`${path}/${selected.id}/jobs/${jobId}/checks`, 'POST', {
      requestKey: checkKeys.current.get(jobId),
    });
    await loadChecks(jobId);
    checkKeys.current.delete(jobId);
    const labels: Record<string, string> = {
      READY_NO_SEND: 'Readiness check passed. No report was sent.',
      BLOCKED: 'Readiness check blocked. Review the history for details.',
      INTERRUPTED: 'The expired check was closed. Run another check when ready.',
      BUSY: 'A check is already running. Refresh its history shortly.',
      CHECKING: 'This check is still running. Refresh its history shortly.',
      NOT_DUE: 'This occurrence is not due yet. No check was started.',
      JOB_CANCELLED: 'This occurrence was cancelled. No new check was started.',
      STALE_CLAIM: 'The check changed. Review its latest history.',
    };
    setMessage(labels[result.status] ?? 'Readiness status refreshed. No report was sent.');
  }
  const editable = canWrite && (!selected || selected.latest.state === 'DRAFT');
  return (
    <section className="panel stack-form report-schedules" aria-label="Report schedules">
      <h2>Report schedule drafts</h2>
      <p>Drafts and held occurrences only. Automatic scheduling and email delivery are disabled.</p>
      <div className="button-row">
        <Button type="button" disabled={pending} onClick={() => void run(() => loadSchedules())}>
          Refresh my schedules
        </Button>
        {canWrite && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setCheckJob(null);
              setChecks(empty());
              setSelected(null);
              setEditing(true);
              setArchive(null);
              setTimezone(defaultTimezone);
              setRecipientIds([selfId]);
              setHistory(empty());
              setJobs(empty());
              setOccurrence('');
              keys.current.clear();
              void run(() => loadArchives());
            }}
          >
            New schedule draft
          </Button>
        )}
      </div>
      {!canWrite && (
        <p>
          Creating or editing drafts requires an eligible plan, an active site and report-writing permission. Existing
          drafts can still be viewed and cancelled.
        </p>
      )}
      {loaded && schedules.items.length === 0 && <p>No schedule drafts for this site.</p>}
      {schedules.items.map((item) => (
        <div key={item.id} data-schedule-id={item.id} className="stack-form">
          <strong>
            {item.latest.state === 'CANCELLED' ? 'Cancelled' : 'Draft'} · Revision {item.latest.revision}
          </strong>
          <span>
            {new Date(item.latest.createdAt).toLocaleString()} · {item.latest.timezone}
          </span>
          <Button type="button" disabled={pending} onClick={() => void run(() => open(item.id))}>
            Open schedule
          </Button>
        </div>
      ))}
      {schedules.nextCursor && (
        <Button type="button" disabled={pending} onClick={() => void run(() => loadSchedules(true))}>
          Load older schedules
        </Button>
      )}
      {editing && (
        <>
          <h3>{selected ? `Selected schedule · revision ${selected.latest.revision}` : 'New draft'}</h3>
          {selected?.latest.state === 'CANCELLED' && <p>This schedule is cancelled and cannot be reopened.</p>}
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!archive || !editable) return;
              void run(async () => {
                const result = await mutate({
                  action: 'DRAFT',
                  ...(selected ? { scheduleId: selected.id, expectedRevisionId: selected.latest.id } : {}),
                  archiveId: archive.id,
                  fingerprint: archive.fingerprint,
                  timezone,
                  recipientMembershipIds: [...recipientIds].sort(),
                });
                await open(result.revision.scheduleId);
                await loadSchedules();
                setMessage('Schedule draft saved. Delivery remains disabled.');
              });
            }}
          >
            <fieldset disabled={pending || !editable} className="stack-form">
              <legend>Draft settings</legend>
              <div className="stack-form">
                <label htmlFor={archiveControlId}>Retained report</label>
                <select
                  id={archiveControlId}
                  required
                  value={archive?.id ?? ''}
                  onChange={(e) => setArchive(archives.items.find((a) => a.id === e.target.value) ?? null)}
                >
                  <option value="">Choose a retained report</option>
                  {archive && !archives.items.some((a) => a.id === archive.id) && (
                    <option value={archive.id}>Saved snapshot · {archive.id}</option>
                  )}
                  {archives.items.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.family} · {new Date(a.createdAt).toLocaleString()} · {a.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="button-row">
                <Button type="button" onClick={() => void run(() => loadArchives())}>
                  Refresh retained choices
                </Button>
                {archives.nextCursor && (
                  <Button type="button" onClick={() => void run(() => loadArchives(true))}>
                    Load older retained choices
                  </Button>
                )}
              </div>
              <p>Retain a report preview above before choosing it here.</p>
              <label>
                Schedule time zone
                <input
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Europe/London"
                />
              </label>
              <fieldset className="stack-form">
                <legend>Recipients</legend>
                {choices.map((r) => (
                  <label key={r.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={recipientIds.includes(r.id)}
                      onChange={(e) =>
                        setRecipientIds((ids) => (e.target.checked ? [...ids, r.id] : ids.filter((id) => id !== r.id)))
                      }
                    />{' '}
                    {r.label}
                  </label>
                ))}
              </fieldset>
              <Button type="submit" disabled={!archive || !recipientIds.length}>
                Save schedule draft
              </Button>
            </fieldset>
          </form>
          {selected && (
            <>
              <div className="button-row">
                <Button type="button" disabled={pending} onClick={() => void run(() => open(selected.id))}>
                  Reload selected schedule
                </Button>
                {selected.latest.state === 'DRAFT' && (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(async () => {
                        await mutate({
                          action: 'CANCEL',
                          scheduleId: selected.id,
                          expectedRevisionId: selected.latest.id,
                        });
                        await open(selected.id);
                        await loadSchedules();
                        setMessage('Schedule cancelled. Its held occurrences are cancelled too.');
                      })
                    }
                  >
                    Cancel schedule
                  </Button>
                )}
              </div>
              {editable && (
                <form
                  className="stack-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await request(`${path}/${selected.id}/jobs`, 'POST', {
                        revisionId: selected.latest.id,
                        occurrenceAt: new Date(`${occurrence}Z`).toISOString(),
                      });
                      const page = await request(`${path}/${selected.id}/jobs`, 'GET');
                      setJobs(page);
                      setOccurrence('');
                      setMessage('Occurrence held. Nothing has been sent.');
                    });
                  }}
                >
                  <label>
                    Occurrence time (UTC)
                    <DateInput
                      type="datetime-local"
                      required
                      disabled={pending}
                      value={occurrence}
                      onValueChange={setOccurrence}
                    />
                  </label>
                  <p>
                    This explicit UTC time is independent of the saved timezone. It prepares a held record, not a
                    recurring send.
                  </p>
                  <Button type="submit" disabled={pending || !occurrence}>
                    Prepare held occurrence
                  </Button>
                </form>
              )}
              <section className="stack-form" aria-label="Schedule revision history">
                <h3>Revision history</h3>
                {history.items.map((r) => (
                  <div key={r.id}>
                    <strong>
                      Revision {r.revision} · {r.state}
                    </strong>
                    <p>
                      {r.timezone} · {r.recipientMembershipIds.length} recipient(s)
                    </p>
                  </div>
                ))}
                {history.nextCursor && (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(async () => {
                        const next = await request(
                          `${path}/${selected.id}/history?cursor=${history.nextCursor}`,
                          'GET',
                        );
                        setHistory((old) => append(old, next, true));
                      })
                    }
                  >
                    Load older schedule revisions
                  </Button>
                )}
              </section>
              <section className="stack-form" aria-label="Schedule occurrence jobs">
                <h3>Occurrence jobs</h3>
                {!jobs.items.length && <p>No occurrences prepared.</p>}
                {jobs.items.map((j) => (
                  <div key={j.id}>
                    <strong>{j.status}</strong>
                    <p>{new Date(j.occurrenceAt).toISOString()} (UTC)</p>
                    <Button type="button" disabled={pending} onClick={() => void run(() => loadChecks(j.id))}>
                      View readiness checks
                    </Button>
                    {canWrite && (
                      <Button type="button" disabled={pending} onClick={() => void run(() => runCheck(j.id))}>
                        Run readiness check
                      </Button>
                    )}
                  </div>
                ))}
                {jobs.nextCursor && (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(async () => {
                        const next = await request(`${path}/${selected.id}/jobs?cursor=${jobs.nextCursor}`, 'GET');
                        setJobs((old) => append(old, next, true));
                      })
                    }
                  >
                    Load older occurrence jobs
                  </Button>
                )}
              </section>
            </>
          )}
        </>
      )}
      {checkJob && (
        <section className="stack-form" aria-label="Delivery readiness checks">
          <h3>Readiness check history</h3>
          <p>
            Historical access checks only. No report was sent. A past ready result does not authorize future delivery.
          </p>
          <Button type="button" disabled={pending} onClick={() => void run(() => loadChecks(checkJob))}>
            Refresh readiness checks
          </Button>
          {canWrite &&
            checks.items.some(
              (check) => check.status === 'CHECKING' && new Date(check.leaseUntil).getTime() <= checksReadAt,
            ) && (
              <Button type="button" disabled={pending} onClick={() => void run(() => runCheck(checkJob))}>
                Recover and recheck
              </Button>
            )}
          {!checks.items.length && <p>No readiness checks recorded for this occurrence.</p>}
          {checks.items.map((check) => (
            <article key={check.id} className="stack-form" data-check-id={check.id}>
              <strong>
                Check {check.attempt} ·{' '}
                {check.status === 'READY_NO_SEND'
                  ? 'Ready — not sent'
                  : check.status === 'BLOCKED'
                    ? 'Blocked'
                    : check.status === 'INTERRUPTED'
                      ? 'Interrupted — not sent'
                      : new Date(check.leaseUntil).getTime() <= checksReadAt
                        ? 'Lease expired — recovery pending'
                        : 'Check in progress'}
              </strong>
              <span>Started: {new Date(check.startedAt).toISOString()} (UTC)</span>
              {check.finishedAt && <span>Finished: {new Date(check.finishedAt).toISOString()} (UTC)</span>}
              {check.status === 'BLOCKED' && (
                <p>
                  {check.code === 'SCHEDULE_CHANGED'
                    ? 'The schedule was changed or cancelled.'
                    : check.code === 'REPORT_PLAN'
                      ? 'The plan did not allow scheduled reports.'
                      : check.code === 'REPORT_RECIPIENT_ACCESS'
                        ? 'A recipient no longer had access.'
                        : 'The report or account did not meet the access requirements.'}
                </p>
              )}
              {check.status === 'INTERRUPTED' && <p>The worker lease expired before the check completed.</p>}
            </article>
          ))}
          {checks.nextCursor && (
            <Button type="button" disabled={pending} onClick={() => void run(() => loadChecks(checkJob, true))}>
              Load older readiness checks
            </Button>
          )}
        </section>
      )}
      {pending && <p role="status">Updating schedules…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error} Reload the selected schedule if another edit changed it.</p>}
    </section>
  );
}
