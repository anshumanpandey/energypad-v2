'use client';
import { AIAnswers } from './ai-answers';
import { useEffect, useRef, useState } from 'react';
import { request } from './forms';
import { Button } from './ui/button';
import type { EvidencePreview } from '@/domain/ai-evidence';
type Interaction = { id: string; createdAt: string; promptHash: string; resultHash: string; result: EvidencePreview };
export function AIEvidence({
  organisationId,
  sites,
}: {
  organisationId: string;
  sites: { id: string; name: string; archived: boolean }[];
}) {
  const [tool, setTool] = useState('saved_savings');
  const [site, setSite] = useState(sites[0]?.id ?? '');
  const [items, setItems] = useState<Interaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const keys = useRef(new Map<string, string>());
  const path = `organisations/${organisationId}/sites/${site}/ai-evidence`;
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
  return (
    <div className="waste-savings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVIDENCE PREVIEW</span>
          <h1>AI Analyst</h1>
          <p>Inspect the saved evidence that can support an analytical answer.</p>
        </div>
      </div>
      <section className="panel stack-form">
        <h2>Saved evidence preview</h2>
        <p>
          This preview retrieves the saved result you select. It does not interpret your question or generate an AI
          answer. No data is sent to an external model.
        </p>
        <p>
          Your question is recorded only as a fingerprint and character count. Preview history is private to you and
          remains subject to current site access.
        </p>
      </section>
      {!sites.length ? (
        <section className="panel">Add a site and save an analysis result to preview evidence.</section>
      ) : (
        <>
          <form
            className="panel stack-form"
            aria-label="Preview analytical evidence"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pending || loading) return;
              const form = e.currentTarget,
                fields = new FormData(form);
              const payload = {
                tool: fields.get('tool'),
                resourceId: fields.get('resourceId'),
                ...(fields.get('carbonRunId')?.toString().trim()
                  ? { carbonRunId: fields.get('carbonRunId')!.toString().trim() }
                  : {}),
                question: fields.get('question'),
              };
              const identity = JSON.stringify([site, payload]);
              if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
              setPending(true);
              setError('');
              setNotice('');
              try {
                await request(path, 'POST', { ...payload, requestKey: keys.current.get(identity) });
                form.reset();
                setTool('saved_savings');
                setCursor(null);
                setLoading(true);
                setGeneration((g) => g + 1);
                setNotice('Evidence preview saved. No AI provider was called.');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to preview evidence.');
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              Evidence site
              <select
                value={site}
                disabled={pending}
                onChange={(e) => {
                  if (e.target.value === site) return;
                  setSite(e.target.value);
                  setItems([]);
                  setCursor(null);
                  setLoading(true);
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
            <fieldset disabled={pending || loading} className="stack-form">
              <label>
                Saved result type
                <select name="tool" value={tool} onChange={(e) => setTool(e.target.value)}>
                  <option value="saved_savings">Saved savings run</option>
                  <option value="saved_baseline">Saved baseline</option>
                  <option value="saved_opportunity">Opportunity investigation</option>
                </select>
              </label>
              <label>
                Saved result ID
                <input name="resourceId" required />
              </label>
              {tool === 'saved_savings' && (
                <div>
                  <label>
                    Saved carbon run ID (optional)
                    <input key={site} name="carbonRunId" aria-describedby="carbon-evidence-help" />
                  </label>
                  <p id="carbon-evidence-help">
                    Select a saved run for the same meter and reading revisions. Leave blank to keep carbon unavailable.
                  </p>
                </div>
              )}
              <label>
                Question for this evidence
                <textarea name="question" required minLength={5} maxLength={2000} />
              </label>
              <Button type="submit">{pending ? 'Loading evidence…' : 'Preview saved evidence'}</Button>
            </fieldset>
          </form>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <AIAnswers key={site} path={`organisations/${organisationId}/sites/${site}/ai-answers`} previews={items} />
          <section className="stack-form" aria-label="My evidence preview history">
            <h2>My evidence previews</h2>
            {loading && <p>Loading history…</p>}
            {!loading && !items.length && <p>No previews on this page.</p>}
            {items.map((item) => (
              <article className="panel stack-form" key={item.id}>
                <h3>Saved evidence · {new Date(item.createdAt).toLocaleString()}</h3>
                <ul>
                  {item.result.limitations.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
                <dl>
                  {item.result.facts.map((fact) => (
                    <div key={fact.id}>
                      <dt>{fact.label}</dt>
                      <dd>
                        {fact.value === null ? 'Unavailable' : `${fact.value}${fact.unit ? ` ${fact.unit}` : ''}`} ·{' '}
                        <a href={`#${item.id}-${fact.citationId}`}>Source</a>
                      </dd>
                    </div>
                  ))}
                </dl>
                {item.result.citations.map((citation) => {
                  const params = new URLSearchParams({
                    family: citation.tool === 'saved_savings' ? 'savings' : 'baseline',
                    [citation.tool === 'saved_savings' ? 'runId' : 'baselineId']: citation.resourceId,
                    format: 'json',
                    fingerprint: citation.fingerprint,
                  });
                  if (citation.carbonRunId) params.set('carbonRunId', citation.carbonRunId);
                  return (
                    <div key={citation.id} id={`${item.id}-${citation.id}`}>
                      <strong>
                        {citation.status} · {citation.period.firstMonth} – {citation.period.lastMonth}
                      </strong>
                      <p>Saved source: {citation.resourceId}</p>
                      {citation.carbonRunId && <p>Saved carbon source: {citation.carbonRunId}</p>}
                      <a
                        href={
                          citation.tool === 'saved_opportunity'
                            ? `/api/v1/organisations/${organisationId}/sites/${site}/ai-evidence/${item.id}/source`
                            : `/api/v1/organisations/${organisationId}/sites/${site}/reports?${params}`
                        }
                      >
                        Download cited source JSON
                      </a>
                    </div>
                  );
                })}
                <p>Provider calls: 0 · Model tokens: 0 · Evidence tool calls: 1</p>
                <details>
                  <summary>Preview audit details</summary>
                  <p>Question fingerprint: {item.promptHash}</p>
                  <p>Result fingerprint: {item.resultHash}</p>
                  <div className="analysis-table">
                    <pre>{JSON.stringify(item.result, null, 2)}</pre>
                  </div>
                </details>
              </article>
            ))}
            <div className="form-actions">
              {cursor && (
                <Button
                  disabled={pending || loading}
                  onClick={() => {
                    setCursor(null);
                    setLoading(true);
                  }}
                >
                  Newest previews
                </Button>
              )}
              {nextCursor && (
                <Button
                  disabled={pending || loading}
                  onClick={() => {
                    setCursor(nextCursor);
                    setLoading(true);
                  }}
                >
                  Older previews
                </Button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
