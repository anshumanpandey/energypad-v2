'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
export type NraReviewRecord = {
  id: string;
  revision: number;
  decision: string;
  reason: string;
  reviewerId: string;
  createdAt: string;
  policyVersion: string;
};
export function NraReviewPanel({
  base,
  runId,
  authorId,
  context,
  reviews,
  canReview,
  reload,
}: {
  base: string;
  runId: string;
  authorId: string;
  context?: { rationale: string; evidence: string[] } | null;
  reviews: NraReviewRecord[];
  canReview: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [attempt, setAttempt] = useState<{ key: string; id: string } | null>(null);
  const latest = reviews.at(-1);
  return (
    <section className="panel stack-form" aria-label="NRA review">
      <h2>NRA review</h2>
      <p>
        <strong>Status: {latest?.decision ?? 'PENDING'}</strong> · Applies only to this saved run. Numerical
        compatibility remains unvalidated.
      </p>
      <p>Run author: {authorId}</p>
      {context ? (
        <>
          <h3>Rationale and assumptions</h3>
          <p>{context.rationale}</p>
          <h3>Evidence references</h3>
          <ul>
            {context.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>This older run has no review context. Save a new run with rationale and evidence to request review.</p>
      )}
      <p>
        Another Owner or Admin may approve or reject an NRA. Changed inputs, rationale or evidence require a new run and
        review. Decisions never transfer to another run.
      </p>
      {!!reviews.length && (
        <ol>
          {reviews.map((r) => (
            <li key={r.id}>
              <strong>{r.decision}</strong> · {new Date(r.createdAt).toLocaleString()} · Reviewer {r.reviewerId} ·{' '}
              {r.policyVersion}
              <p>{r.reason}</p>
            </li>
          ))}
        </ol>
      )}
      {context && canReview && (
        <form
          className="stack-form"
          aria-label="Review NRA"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const body = { previousId: latest?.id ?? null, decision: f.get('decision'), reason: f.get('reason') };
            const key = JSON.stringify(body);
            const id = attempt?.key === key ? attempt.id : crypto.randomUUID();
            setAttempt({ key, id });
            void m.run(async () => {
              await request(`${base}/runs/${runId}/reviews`, 'POST', { ...body, requestId: id });
              await reload();
            }, 'NRA review recorded.');
          }}
        >
          <fieldset className="form-grid" disabled={m.disabled}>
            <label>
              Review decision
              <select name="decision">
                <option value="APPROVED">Approve NRA</option>
                <option value="REJECTED">Reject NRA</option>
                {latest?.decision === 'APPROVED' && <option value="REVOKED">Revoke approval</option>}
              </select>
            </label>
            <label>
              Review reason
              <textarea name="reason" required maxLength={2000} />
            </label>
          </fieldset>
          <Button type="submit" disabled={m.disabled}>
            Record NRA review
          </Button>
        </form>
      )}
      {m.feedback}
    </section>
  );
}
