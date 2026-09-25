'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { request } from './forms';
import { Button } from './ui/button';
import type { AnalyticsReport } from '@/domain/analytics-report';
type Opportunity = {
  id: string;
  title: string;
  rationale: string;
  runId: string;
  createdAt: string;
  evidence: AnalyticsReport;
  evidenceHash: string;
  owner: { user: { name: string | null; email: string }; revokedAt: string | null };
  events: { id: string; status: string; note: string; revision: number; actorId: string; createdAt: string }[];
};
export function Opportunities({
  organisationId,
  sites,
  canWrite,
  initialSite,
  initialRun,
  initialCarbon,
}: {
  organisationId: string;
  sites: { id: string; name: string; archived: boolean }[];
  canWrite: boolean;
  initialSite?: string;
  initialRun?: string;
  initialCarbon?: string;
}) {
  const [site, setSite] = useState(initialSite ?? sites[0]?.id ?? '');
  const [items, setItems] = useState<Opportunity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const keys = useRef(new Map<string, string>());
  const path = `organisations/${organisationId}/sites/${site}/opportunities`;
  const archived = sites.find((s) => s.id === site)?.archived;
  useEffect(() => {
    let active = true;
    if (!site) return;
    void request(`${path}${cursor ? `?cursor=${cursor}` : ''}`, 'GET')
      .then((data) => {
        if (active) {
          setItems(data.items);
          setNextCursor(data.nextCursor);
        }
      })
      .catch((e) => {
        if (active) {
          setItems([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [site, path, cursor, generation]);
  async function mutate(event: React.FormEvent<HTMLFormElement>, item?: Opportunity) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const payload = item
      ? { previousId: item.events.at(-1)!.id, status: fields.get('status'), note: fields.get('note') }
      : {
          runId: fields.get('runId'),
          ...(fields.get('carbonRunId') ? { carbonRunId: fields.get('carbonRunId') } : {}),
          title: fields.get('title'),
          rationale: fields.get('rationale'),
        };
    const identity = JSON.stringify([site, item?.id ?? null, payload]);
    if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
    setPending(true);
    setError('');
    setNotice('');
    try {
      await request(`${path}${item ? `/${item.id}/review` : ''}`, 'POST', {
        ...payload,
        requestKey: keys.current.get(identity),
      });
      form.reset();
      setLoading(true);
      setCursor(null);
      setGeneration((g) => g + 1);
      setNotice(item ? 'Review saved.' : 'Investigation created and assigned to you.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save investigation.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="waste-savings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">INVESTIGATIONS</span>
          <h1>Opportunities</h1>
          <p>Turn saved analytical evidence into an owned investigation.</p>
        </div>
      </div>
      <section className="panel stack-form">
        <p>
          Detected and Reviewing describe an investigation, not an approved project or verified saving. Saved analysis
          remains experimental. Approval, implementation and verification will follow in later steps.
        </p>
        <Link href={`/org/${organisationId}/waste-savings`}>Choose evidence in Waste &amp; Savings</Link>
      </section>
      {!sites.length ? (
        <section className="panel">
          <p>Add a site and save an analysis run to begin.</p>
        </section>
      ) : (
        <>
          <section className="panel stack-form">
            <label>
              Opportunity site
              <select
                value={site}
                disabled={pending}
                onChange={(e) => {
                  setLoading(true);
                  setSite(e.target.value);
                  setItems([]);
                  setCursor(null);
                  setError('');
                  setNotice('');
                }}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || loading}
              onClick={() => {
                setError('');
                setLoading(true);
                setGeneration((g) => g + 1);
              }}
            >
              Reload investigations
            </Button>
          </section>
          {archived && <p>Archived site · Investigation history is read-only.</p>}
          {canWrite && !archived && (
            <form key={site} className="panel stack-form" onSubmit={(e) => void mutate(e)}>
              <h2>Create investigation</h2>
              <p>
                You will be recorded as the initial owner. One investigation per saved analysis run prevents duplicate
                opportunities; estimated impacts are not added across investigations.
              </p>
              <label>
                Investigation title
                <input name="title" required minLength={3} maxLength={160} />
              </label>
              <label>
                Investigation rationale
                <textarea name="rationale" required minLength={10} maxLength={4000} />
              </label>
              <label>
                Saved analysis run ID
                <input name="runId" required defaultValue={site === initialSite ? initialRun : ''} />
              </label>
              <label>
                Saved carbon run ID (optional)
                <input name="carbonRunId" defaultValue={site === initialSite ? initialCarbon : ''} />
              </label>
              <Button type="submit" disabled={pending}>
                Create investigation
              </Button>
            </form>
          )}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          {loading && <p role="status">Loading investigations…</p>}
          <section className="panel stack-form" aria-label="Investigation register">
            <h2>Investigation register</h2>
            {!loading && !items.length && <p>No investigations on this page.</p>}
            {items.map((item) => {
              const current = item.events.at(-1)!;
              return (
                <article key={item.id} className="panel stack-form">
                  <h3>{item.title}</h3>
                  <strong>{current.status}</strong>
                  <p>{item.rationale}</p>
                  <p>
                    Owner: {item.owner.user.name ?? item.owner.user.email}
                    {item.owner.revokedAt ? ' (membership revoked)' : ''}
                  </p>
                  <p>
                    {item.evidence.period.firstMonth} – {item.evidence.period.lastMonth} · {item.evidence.status}
                  </p>
                  <p>
                    Saved energy variance before / after NRA: {item.evidence.summary.preKwh ?? 'Unavailable'} /{' '}
                    {item.evidence.summary.postKwh ?? 'Unavailable'} kWh. Positive indicates saving; negative indicates
                    waste. This is source evidence, not a forecast of recoverable savings.
                  </p>
                  <Link href={`/org/${organisationId}/waste-savings?site=${site}&run=${item.runId}`}>
                    Review saved analysis
                  </Link>
                  <details>
                    <summary>Pinned impact evidence</summary>
                    <p>{item.evidence.note}</p>
                    <p>Evidence hash: {item.evidenceHash}</p>
                    <div className="analysis-table">
                      <pre>{JSON.stringify(item.evidence, null, 2)}</pre>
                    </div>
                  </details>
                  <details>
                    <summary>Investigation history</summary>
                    <ol>
                      {item.events.map((e) => (
                        <li key={e.id}>
                          {e.status} · {e.createdAt} · revision {e.revision}
                          <p>{e.note}</p>
                          <small>Actor: {e.actorId}</small>
                        </li>
                      ))}
                    </ol>
                  </details>
                  {canWrite && !archived && current.status !== 'REJECTED' && (
                    <form className="stack-form" onSubmit={(e) => void mutate(e, item)}>
                      <label>
                        Review decision
                        <select name="status">
                          {current.status === 'DETECTED' && <option value="REVIEWING">Start reviewing</option>}
                          <option value="REJECTED">Reject investigation</option>
                        </select>
                      </label>
                      <label>
                        Review note
                        <textarea name="note" required minLength={10} maxLength={4000} />
                      </label>
                      <Button type="submit" disabled={pending}>
                        Save investigation review
                      </Button>
                    </form>
                  )}
                </article>
              );
            })}
            {nextCursor && (
              <Button
                type="button"
                disabled={pending || loading}
                onClick={() => {
                  setLoading(true);
                  setCursor(nextCursor);
                }}
              >
                Older investigations
              </Button>
            )}
            {cursor && (
              <Button
                type="button"
                disabled={pending || loading}
                onClick={() => {
                  setLoading(true);
                  setCursor(null);
                }}
              >
                Newest investigations
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
