'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import type { OpportunityAction } from '@/domain/opportunities';
export type WorkOwner = { id: string; user: { name: string | null; email: string } };
export type WorkVersion = {
  id: string;
  revision: number;
  ownerMembershipId: string;
  note: string;
  createdAt: string;
  authorId: string;
  owner: { user: { name: string | null; email: string }; revokedAt: string | null };
  actions: (OpportunityAction & { ownerLabel?: string })[];
};
export type WorkPayload = {
  previousId: string | null;
  eventId: string;
  ownerMembershipId: string;
  actions: OpportunityAction[];
  note: string;
};
function OwnerSelect({
  label,
  value,
  owners,
  onChange,
}: {
  label: string;
  value: string;
  owners: WorkOwner[];
  onChange: (id: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        {!owners.some((o) => o.id === value) && (
          <option value={value} disabled>
            Unavailable member — choose an active owner
          </option>
        )}
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.user.name ?? o.user.email}
          </option>
        ))}
      </select>
    </label>
  );
}
export function OpportunityWork({
  version,
  originalOwnerId,
  eventId,
  stage,
  owners,
  disabled,
  onSave,
}: {
  version?: WorkVersion;
  originalOwnerId: string;
  eventId: string;
  stage: string;
  owners: WorkOwner[];
  disabled: boolean;
  onSave: (payload: WorkPayload) => Promise<void>;
}) {
  const [owner, setOwner] = useState(version?.ownerMembershipId ?? originalOwnerId);
  const [actions, setActions] = useState<OpportunityAction[]>(version?.actions ?? []);
  const [error, setError] = useState('');
  const scopeLocked = ['APPROVED', 'IN_PROGRESS'].includes(stage);
  const update = (id: string, fields: Partial<OpportunityAction>) =>
    setActions((values) => values.map((a) => (a.id === id ? { ...a, ...fields } : a)));
  return (
    <form
      className="stack-form"
      aria-label="Action plan"
      onSubmit={async (e) => {
        e.preventDefault();
        if (disabled) return;
        setError('');
        const form = e.currentTarget;
        try {
          await onSave({
            previousId: version?.id ?? null,
            eventId,
            ownerMembershipId: owner,
            actions: actions.map(({ id, title, ownerMembershipId, dueDate, status, completionEvidence }) => ({
              id,
              title,
              ownerMembershipId,
              dueDate,
              status,
              completionEvidence,
            })),
            note: String(new FormData(form).get('note') ?? ''),
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to save action plan.');
        }
      }}
    >
      <h4>Owner and action plan</h4>
      <p>
        {scopeLocked
          ? 'Approved action descriptions and dates are fixed. Reassignment and forward progress create a new historical version.'
          : 'Assign an active owner, admin or analyst. Save at least one action before requesting approval.'}
      </p>
      <fieldset disabled={disabled} className="stack-form">
        <OwnerSelect label="Opportunity owner" value={owner} owners={owners} onChange={setOwner} />
        {actions.map((a, index) => (
          <fieldset key={a.id} className="stack-form">
            <legend>Action {index + 1}</legend>
            <label>
              Action description
              <input
                value={a.title}
                onChange={(e) => update(a.id, { title: e.target.value })}
                required
                minLength={3}
                maxLength={200}
                readOnly={scopeLocked}
              />
            </label>
            <OwnerSelect
              label="Action owner"
              value={a.ownerMembershipId}
              owners={owners}
              onChange={(ownerMembershipId) => update(a.id, { ownerMembershipId })}
            />
            <label>
              Action due date (optional)
              <input
                type="date"
                value={a.dueDate ?? ''}
                onChange={(e) => update(a.id, { dueDate: e.target.value || null })}
                readOnly={scopeLocked}
              />
            </label>
            <label>
              Action progress
              <select
                value={a.status}
                disabled={stage !== 'IN_PROGRESS' || version?.actions.find((old) => old.id === a.id)?.status === 'DONE'}
                onChange={(e) =>
                  update(a.id, { status: e.target.value as OpportunityAction['status'], completionEvidence: '' })
                }
              >
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </label>
            {a.status === 'DONE' && (
              <label>
                Completion evidence
                <textarea
                  value={a.completionEvidence}
                  onChange={(e) => update(a.id, { completionEvidence: e.target.value })}
                  required
                  minLength={10}
                  maxLength={2000}
                  readOnly={version?.actions.find((old) => old.id === a.id)?.status === 'DONE'}
                  placeholder="Record what was done and reference the supporting log or document."
                />
              </label>
            )}
            {!scopeLocked && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActions((values) => values.filter((row) => row.id !== a.id))}
              >
                Remove action {index + 1}
              </Button>
            )}
          </fieldset>
        ))}
        {!scopeLocked && (
          <Button
            type="button"
            variant="secondary"
            disabled={actions.length >= 20}
            onClick={() =>
              setActions((values) => [
                ...values,
                {
                  id: crypto.randomUUID(),
                  title: '',
                  ownerMembershipId: owner,
                  dueDate: null,
                  status: 'TODO',
                  completionEvidence: '',
                },
              ])
            }
          >
            Add action
          </Button>
        )}
        <label>
          Plan change note
          <textarea name="note" required minLength={10} maxLength={4000} />
        </label>
        <Button type="submit">Save owner and actions</Button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
