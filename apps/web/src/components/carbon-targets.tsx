'use client';
import { useEffect, useRef, useState } from 'react';
import { request, useMutation } from './forms';
import { Button } from './ui/button';
import { factorBases } from '@/domain/emission-factors';
import type { CarbonSnapshot } from '@/domain/carbon';
type Target = {
  id: string;
  meterId: string;
  year: number;
  geography: string;
  basis: string;
  name: string;
  limitKgCO2e: string;
  source: string;
  revision: number;
  supersedesId: string | null;
  correctionReason: string | null;
  assessments: {
    id: string;
    runId: string;
    actualKgCO2e: string;
    varianceKgCO2e: string;
    status: string;
    createdAt: string;
  }[];
};
export function CarbonTargets({
  base,
  meters,
  runs,
  manage,
}: {
  base: string;
  meters: { id: string; name: string; archivedAt: string | null }[];
  runs: { id: string; createdAt: string; snapshot: CarbonSnapshot }[];
  manage: boolean;
}) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [editing, setEditing] = useState<Target | null>(null);
  const [history, setHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const mutation = useMutation();
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const path = `${base}/carbon/targets`;
  useEffect(() => {
    let cancelled = false;
    request(path, 'GET')
      .then((data) => {
        if (!cancelled) {
          setTargets(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Unable to load targets.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, retry]);
  if (loading) return <p role="status">Loading carbon targets…</p>;
  if (loadError)
    return (
      <>
        <p role="alert">{loadError}</p>
        <Button
          onClick={() => {
            setLoadError('');
            setLoading(true);
            setRetry(retry + 1);
          }}
        >
          Retry targets
        </Button>
      </>
    );
  const replaced = new Set(targets.map((t) => t.supersedesId));
  return (
    <section aria-label="Carbon targets" style={{ marginTop: 24 }}>
      <h3>Annual carbon targets</h3>
      <p>
        Set an absolute annual limit in kgCO2e per meter. Assessments compare a selected saved calculation, including
        its estimated inputs, with the target revision. They are historical results; check the site summary for current
        input coverage.
      </p>
      {mutation.feedback}
      {manage && (
        <form
          key={editing?.id ?? 'new'}
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fields = Object.fromEntries(new FormData(form));
            const { reason, ...values } = fields;
            const data = {
              ...values,
              year: Number(values.year),
              ...(editing
                ? { meterId: editing.meterId, year: editing.year, geography: editing.geography, basis: editing.basis }
                : {}),
            };
            const signature = JSON.stringify({ data, reason, id: editing?.id });
            if (!attempt.current || attempt.current.signature !== signature)
              attempt.current = { signature, key: crypto.randomUUID() };
            const target = { ...data, requestKey: attempt.current.key };
            void mutation.run(async () => {
              await request(
                editing ? `${path}/${editing.id}/correct` : path,
                'POST',
                editing ? { target, reason } : target,
              );
              setTargets(await request(path, 'GET'));
              form.reset();
              setEditing(null);
              attempt.current = null;
            }, 'Target saved.');
          }}
        >
          <h4>{editing ? 'Correct target' : 'Add target'}</h4>
          <div className="form-grid">
            <label>
              Target name
              <input name="name" required maxLength={100} defaultValue={editing?.name ?? ''} />
            </label>
            <label>
              Target meter
              <select name="meterId" required disabled={!!editing} defaultValue={editing?.meterId ?? ''}>
                <option value="">Select a meter</option>
                {meters
                  .filter((m) => !m.archivedAt || editing?.meterId === m.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Target year
              <input
                name="year"
                type="number"
                required
                min={1900}
                max={2199}
                readOnly={!!editing}
                defaultValue={editing?.year ?? new Date().getFullYear()}
              />
            </label>
            <label>
              Target geography
              <input
                name="geography"
                required
                maxLength={40}
                readOnly={!!editing}
                defaultValue={editing?.geography ?? ''}
              />
            </label>
            <label>
              Target basis
              <select name="basis" disabled={!!editing} defaultValue={editing?.basis ?? 'LOCATION_BASED'}>
                {factorBases.map((b) => (
                  <option key={b} value={b}>
                    {b.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Annual limit (kgCO2e)
              <input name="limitKgCO2e" required inputMode="decimal" defaultValue={editing?.limitKgCO2e ?? ''} />
            </label>
          </div>
          <label>
            Target source / rationale
            <input name="source" required minLength={3} maxLength={1000} defaultValue={editing?.source ?? ''} />
          </label>
          {editing && (
            <label>
              Target correction reason
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={mutation.disabled}>
              {mutation.pending ? 'Saving…' : 'Save target'}
            </Button>
            {editing && (
              <Button type="button" variant="secondary" disabled={mutation.disabled} onClick={() => setEditing(null)}>
                Cancel target correction
              </Button>
            )}
          </div>
        </form>
      )}
      <label style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          style={{ width: 16, height: 16, minHeight: 0 }}
          checked={history}
          onChange={(e) => setHistory(e.target.checked)}
        />
        Show superseded targets
      </label>
      {!targets.length && <p>No carbon targets yet.</p>}
      {targets
        .filter((t) => history || !replaced.has(t.id))
        .map((t) => {
          const eligible = runs.filter(
            (r) =>
              r.snapshot.status === 'COMPLETE' &&
              r.snapshot.definition.meterId === t.meterId &&
              r.snapshot.definition.year === t.year &&
              r.snapshot.definition.geography === t.geography &&
              r.snapshot.definition.basis === t.basis,
          );
          return (
            <article key={t.id} style={{ borderTop: '1px solid #d8dfda', marginTop: 16, paddingTop: 16 }}>
              <h4>
                {t.name} · Revision {t.revision} {replaced.has(t.id) ? '(superseded)' : ''}
              </h4>
              <p>
                {meters.find((m) => m.id === t.meterId)?.name ?? t.meterId} · {t.year} · {t.geography} ·{' '}
                {t.basis.replaceAll('_', ' ')} · Limit {t.limitKgCO2e} kgCO2e
              </p>
              <p>
                {t.source}
                {t.correctionReason ? ` · ${t.correctionReason}` : ''}
              </p>
              {manage && !replaced.has(t.id) && (
                <>
                  <Button type="button" variant="secondary" disabled={mutation.disabled} onClick={() => setEditing(t)}>
                    Correct target
                  </Button>
                  <form
                    className="stack-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const runId = new FormData(event.currentTarget).get('runId');
                      void mutation.run(async () => {
                        await request(`${path}/${t.id}/assess`, 'POST', { runId });
                        setTargets(await request(path, 'GET'));
                      }, 'Assessment saved.');
                    }}
                  >
                    <label>
                      Saved calculation for {t.name}
                      <select name="runId" required>
                        <option value="">Select a complete matching run</option>
                        {eligible.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.createdAt} · {r.snapshot.totalKgCO2e} kgCO2e · {r.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!eligible.length && (
                      <p>
                        No complete matching run is loaded. Load older calculations or open a saved run by ID above.
                      </p>
                    )}
                    <Button type="submit" disabled={mutation.disabled || !eligible.length}>
                      Assess target
                    </Button>
                  </form>
                </>
              )}
              {t.assessments.map((a) => (
                <p key={a.id}>
                  <strong>{a.status === 'MET' ? 'Target met' : 'Target exceeded'}</strong> · Actual {a.actualKgCO2e}{' '}
                  kgCO2e · Difference {a.varianceKgCO2e} kgCO2e (actual minus limit)
                  <br />
                  Saved {a.createdAt} · Run {a.runId} · Target {t.id}
                </p>
              ))}
            </article>
          );
        })}
    </section>
  );
}
