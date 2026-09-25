'use client';
import { SupportingEvidence, type SupportingRecord, type SupportingOptions } from './opportunity-supporting';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { request } from './forms';
import { Button } from './ui/button';
import {
  VerificationForm,
  VerificationHistory,
  type VerificationRecord,
  type VerificationPayload,
} from './opportunity-verification';
import { OpportunityWork, type WorkVersion, type WorkOwner, type WorkPayload } from './opportunity-work';
import { opportunityTransitions, type OpportunityStatus } from '@/domain/opportunities';
import type { AnalyticsReport } from '@/domain/analytics-report';
type Opportunity = {
  supportingEvidence: SupportingRecord[];
  verifications: VerificationRecord[];
  ownerMembershipId: string;
  workVersions: WorkVersion[];
  id: string;
  title: string;
  rationale: string;
  runId: string;
  createdAt: string;
  evidence: AnalyticsReport;
  evidenceHash: string;
  owner: { user: { name: string | null; email: string }; revokedAt: string | null };
  events: {
    id: string;
    status: string;
    note: string;
    revision: number;
    actorId: string;
    createdAt: string;
    workVersionId: string | null;
    verificationId: string | null;
  }[];
};
export function Opportunities({
  organisationId,
  sites,
  canWrite,
  canApprove,
  initialSite,
  initialRun,
  initialCarbon,
}: {
  organisationId: string;
  sites: { id: string; name: string; archived: boolean }[];
  canWrite: boolean;
  canApprove: boolean;
  initialSite?: string;
  initialRun?: string;
  initialCarbon?: string;
}) {
  const [site, setSite] = useState(initialSite ?? sites[0]?.id ?? '');
  const [supportingOptions, setSupportingOptions] = useState<SupportingOptions>({ energyUses: [], logs: [] });
  const [owners, setOwners] = useState<WorkOwner[]>([]);
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
    void Promise.all([
      request(`${path}${cursor ? `?cursor=${cursor}` : ''}`, 'GET'),
      canWrite && !archived ? request(`${path}/owners`, 'GET') : Promise.resolve([]),
      canWrite && !archived
        ? request(`${path}/supporting-options`, 'GET')
        : Promise.resolve({ energyUses: [], logs: [] }),
    ])
      .then(([data, availableOwners, availableEvidence]) => {
        if (active) {
          setItems(data.items);
          setOwners(availableOwners);
          setSupportingOptions(availableEvidence);
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
  }, [site, path, cursor, generation, canWrite, archived]);
  async function mutate(event: React.FormEvent<HTMLFormElement>, item?: Opportunity) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const payload = item
      ? {
          previousId: item.events.at(-1)!.id,
          workVersionId: item.workVersions.at(-1)?.id ?? null,
          verificationId: item.verifications.at(-1)?.id ?? null,
          status: fields.get('status'),
          note: fields.get('note'),
        }
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
  async function saveSupporting(item: Opportunity, payload: Record<string, unknown>) {
    const identity = JSON.stringify([site, item.id, 'supporting', payload]);
    if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
    setPending(true);
    setError('');
    setNotice('');
    try {
      await request(`${path}/${item.id}/supporting-evidence`, 'POST', {
        ...payload,
        requestKey: keys.current.get(identity),
      });
      setLoading(true);
      setGeneration((g) => g + 1);
      setNotice('Supporting evidence saved.');
    } finally {
      setPending(false);
    }
  }
  async function saveWork(item: Opportunity, payload: WorkPayload) {
    const identity = JSON.stringify([site, item.id, 'work', payload]);
    if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
    setPending(true);
    setError('');
    setNotice('');
    try {
      await request(`${path}/${item.id}/work`, 'POST', { ...payload, requestKey: keys.current.get(identity) });
      setLoading(true);
      setGeneration((g) => g + 1);
      setNotice('Owner and actions saved.');
    } finally {
      setPending(false);
    }
  }
  async function saveVerification(item: Opportunity, payload: VerificationPayload) {
    const identity = JSON.stringify([site, item.id, 'verification', payload]);
    if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
    setPending(true);
    setError('');
    setNotice('');
    try {
      await request(`${path}/${item.id}/verification`, 'POST', { ...payload, requestKey: keys.current.get(identity) });
      setLoading(true);
      setGeneration((g) => g + 1);
      setNotice('Verification evidence saved. Review blockers remain visible.');
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
          Approval authorizes the recorded action plan; it does not validate the analytical method or verify savings.
          Implementation requires completion evidence for every action. Verification submissions preserve evidence for
          review; verified savings remain blocked pending methodological approval.
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
              const work = item.workVersions.at(-1);
              const owner = work?.owner ?? item.owner;
              const decisions = (
                opportunityTransitions[current.status as OpportunityStatus] as readonly string[]
              ).filter(
                (status) =>
                  status !== 'VERIFICATION' &&
                  status !== 'VERIFIED' &&
                  (status !== 'APPROVED' || canApprove) &&
                  (current.status !== 'VERIFICATION' || canApprove),
              );
              return (
                <article key={item.id} className="panel stack-form">
                  <h3>{item.title}</h3>
                  <strong>{current.status}</strong>
                  <p>{item.rationale}</p>
                  <p>
                    Owner: {owner.user.name ?? owner.user.email}
                    {owner.revokedAt ? ' (membership revoked)' : ''}
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
                  <a href={`/api/v1/organisations/${organisationId}/sites/${site}/opportunities/${item.id}/report`}>
                    Download investigation evidence JSON
                  </a>
                  <p>Investigation ID: {item.id}</p>
                  <details>
                    <summary>Pinned impact evidence</summary>
                    <p>{item.evidence.note}</p>
                    <p>Evidence hash: {item.evidenceHash}</p>
                    <div className="analysis-table">
                      <pre>{JSON.stringify(item.evidence, null, 2)}</pre>
                    </div>
                  </details>
                  {work && (
                    <section className="stack-form" aria-label="Saved action plan">
                      <h4>Saved action plan · revision {work.revision}</h4>
                      {!work.actions.length && <p>No actions saved yet.</p>}
                      <ul>
                        {work.actions.map((a) => (
                          <li key={a.id}>
                            <strong>{a.title}</strong> · {a.status}
                            <p>
                              Owner: {a.ownerLabel ?? a.ownerMembershipId} · Due: {a.dueDate ?? 'Not set'}
                            </p>
                            {a.completionEvidence && <p>Completion evidence: {a.completionEvidence}</p>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {!!item.workVersions.length && (
                    <details>
                      <summary>Owner and action history</summary>
                      <ol>
                        {item.workVersions.map((v) => (
                          <li key={v.id}>
                            Revision {v.revision} · {v.createdAt} · Owner: {v.owner.user.name ?? v.owner.user.email}
                            <p>{v.note}</p>
                            <small>Author: {v.authorId}</small>
                            <div className="analysis-table">
                              <pre>{JSON.stringify(v.actions, null, 2)}</pre>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {canWrite &&
                    !archived &&
                    !['IMPLEMENTED', 'VERIFICATION', 'VERIFIED', 'REJECTED'].includes(current.status) && (
                      <OpportunityWork
                        key={`${item.id}-${work?.id ?? 'new'}-${current.id}`}
                        version={work}
                        originalOwnerId={item.ownerMembershipId}
                        stage={current.status}
                        eventId={current.id}
                        owners={owners}
                        disabled={pending || loading}
                        onSave={(payload) => saveWork(item, payload)}
                      />
                    )}
                  <SupportingEvidence
                    key={`${item.id}-${current.id}-${work?.id}-${item.supportingEvidence.length}`}
                    records={item.supportingEvidence}
                    options={supportingOptions}
                    eventId={current.id}
                    work={work}
                    editable={canWrite && !archived && !['VERIFIED', 'REJECTED'].includes(current.status)}
                    disabled={pending || loading}
                    onSave={(payload) => saveSupporting(item, payload)}
                  />
                  <VerificationHistory records={item.verifications} />
                  {canWrite && !archived && work && ['IMPLEMENTED', 'VERIFICATION'].includes(current.status) && (
                    <VerificationForm
                      key={`${item.id}-${current.id}-verification`}
                      previous={item.verifications.at(-1)}
                      eventId={current.id}
                      workVersionId={work.id}
                      disabled={pending || loading}
                      onSave={(payload) => saveVerification(item, payload)}
                    />
                  )}
                  <details>
                    <summary>Investigation history</summary>
                    <ol>
                      {item.events.map((e) => (
                        <li key={e.id}>
                          {e.status} · {e.createdAt} · revision {e.revision}
                          <p>{e.note}</p>
                          <small>
                            Actor: {e.actorId}
                            {e.workVersionId ? ` · Action plan: ${e.workVersionId}` : ''}
                            {e.verificationId ? ` · Verification: ${e.verificationId}` : ''}
                          </small>
                        </li>
                      ))}
                    </ol>
                  </details>
                  {canWrite && !archived && decisions.length > 0 && (
                    <form key={current.id} className="stack-form" onSubmit={(e) => void mutate(e, item)}>
                      <label>
                        Review decision
                        <select name="status">
                          {decisions.map((status) => (
                            <option key={status} value={status}>
                              {
                                (
                                  {
                                    REVIEWING: 'Start reviewing',
                                    APPROVED: 'Approve action plan',
                                    IN_PROGRESS: 'Start implementation',
                                    IMPLEMENTED: 'Mark implemented',
                                    REJECTED: 'Reject investigation',
                                  } as Record<string, string>
                                )[status]
                              }
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Review note
                        <textarea name="note" required minLength={10} maxLength={4000} />
                      </label>
                      <Button type="submit" disabled={pending || loading}>
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
