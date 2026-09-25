'use client';
import { useEffect, useRef, useState } from 'react';
import { request } from './forms';
import { Button } from './ui/button';
import type { EvidenceFact, EvidenceCitation } from '@/domain/ai-evidence';
type Answer = {
  id: string;
  createdAt: string;
  outcome: null | {
    status: string;
    result: {
      facts?: EvidenceFact[];
      citations?: EvidenceCitation[];
      limitations?: string[];
      code?: string;
      usage: { inputTokens: number | null; outputTokens: number | null } | null;
    };
  };
};
export function AIAnswers({ path, previews }: { path: string; previews: { id: string }[] }) {
  const [available, setAvailable] = useState({ configured: false, entitled: false, dailyLimit: 20 });
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const keys = useRef(new Map<string, string>());
  useEffect(() => {
    let active = true;
    void Promise.all([request(`${path}/availability`, 'GET'), request(path, 'GET')])
      .then(([config, history]) => {
        if (active) {
          setAvailable(config);
          setAnswers(history);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, generation]);
  return (
    <section className="panel stack-form" aria-label="AI answers">
      <h2>Ask about saved evidence</h2>
      {!available.configured ? (
        <p>AI provider not connected. Configure a server-side API key and model to enable answers.</p>
      ) : (
        <p>
          Questions and the selected summary facts are sent to OpenAI. The model selects relevant facts; cited values
          and limitations come from the saved evidence.
        </p>
      )}
      {!available.entitled && (
        <p>AI answers require a workspace plan with AI access. Evidence previews remain available.</p>
      )}
      <p>Daily workspace limit: {available.dailyLimit} attempts. Failures count toward this limit.</p>
      <form
        className="stack-form"
        aria-label="Generate grounded answer"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || loading) return;
          const form = e.currentTarget,
            fields = new FormData(form);
          const payload = { previewId: fields.get('previewId'), question: fields.get('question') };
          const identity = JSON.stringify(payload);
          if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
          setBusy(true);
          setError('');
          try {
            await request(path, 'POST', { ...payload, requestKey: keys.current.get(identity) });
            form.reset();
            setGeneration((g) => g + 1);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to generate answer.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset
          disabled={busy || loading || !available.configured || !available.entitled || !previews.length}
          className="stack-form"
        >
          <label>
            Evidence preview
            <select name="previewId" required>
              {previews.map((p, i) => (
                <option key={p.id} value={p.id}>
                  Preview {i + 1} · {p.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Question for AI
            <textarea name="question" required minLength={5} maxLength={2000} />
          </label>
          <Button type="submit">{busy ? 'Generating…' : 'Generate cited answer'}</Button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      <h3>My latest 20 answer attempts</h3>
      <Button
        disabled={busy || loading}
        onClick={() => {
          setLoading(true);
          setGeneration((g) => g + 1);
        }}
      >
        Refresh answer history
      </Button>
      {answers.map((answer) => (
        <article key={answer.id} className="stack-form">
          <strong>
            {answer.outcome?.status ?? 'PENDING'} · {new Date(answer.createdAt).toLocaleString()}
          </strong>
          {!answer.outcome && (
            <p>
              The request is pending or interrupted. Refresh its status; retries with the same request key do not make
              another provider call.
            </p>
          )}
          {answer.outcome?.status === 'FAILED' && <p>No answer was published. Reason: {answer.outcome.result.code}</p>}
          {answer.outcome?.status === 'INSUFFICIENT' && <p>The selected evidence cannot answer this question.</p>}
          {answer.outcome?.result.facts?.map((f) => (
            <p key={f.id}>
              {f.label}: {f.value === null ? 'Unavailable' : `${f.value}${f.unit ? ` ${f.unit}` : ''}`} · Citation:{' '}
              {f.citationId}
            </p>
          ))}
          {answer.outcome?.result.citations?.map((c) => (
            <p key={c.id}>
              {c.id} · {c.status} · {c.period.firstMonth} – {c.period.lastMonth} · Saved source: {c.resourceId}
            </p>
          ))}
          {answer.outcome?.result.limitations && (
            <ul>
              {answer.outcome.result.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          {answer.outcome && (
            <p>
              Model tokens: {answer.outcome.result.usage?.inputTokens ?? 'Unknown'} input /{' '}
              {answer.outcome.result.usage?.outputTokens ?? 'Unknown'} output
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
