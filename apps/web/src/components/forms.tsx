'use client';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Check, Send, X, Save } from 'lucide-react';
import { Button } from './ui/button';
import { OrganisationFields } from './organisation-fields';
import { canManageRole, roleLabels, roles, type Role } from '@/domain/policy';

export async function request(path: string, method: string, body?: unknown) {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.title ?? 'Something went wrong. Please try again.');
  return data;
}
const subscribe = () => () => {};
export function useMutation() {
  // Prevent a native form submission before React has attached the JSON handler.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  async function run(work: () => Promise<void>, success = 'Changes saved.') {
    if (pending) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await work();
      setMessage(success);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }
  const feedback = (
    <>
      {!hydrated && (
        <p className="notice" role="status">
          Interactive controls are still loading. If this message remains, check that JavaScript is enabled and{' '}
          <a href="">reload this page</a>.
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          <Check size={16} />
          {message}
        </div>
      )}
    </>
  );
  return { pending, disabled: pending || !hydrated, run, feedback, router };
}
export function OrganisationForm({
  organisation,
}: {
  organisation: { id: string; name: string; currency: string; timezone: string };
}) {
  const m = useMutation();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void m.run(async () => {
      await request(`organisations/${organisation.id}`, 'PATCH', {
        name: data.get('name'),
        currency: data.get('currency'),
        timezone: data.get('timezone'),
      });
    });
  }
  return (
    <form onSubmit={submit} className="stack-form">
      {m.feedback}
      <OrganisationFields values={organisation} />
      <Button disabled={m.disabled} type="submit">
        {m.pending ? 'Saving…' : 'Save changes'}
        <Save size={16} />
      </Button>
    </form>
  );
}
type Site = { id: string; name: string };
function SiteChoices({
  sites,
  selected,
  onChange,
}: {
  sites: Site[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="site-choices">
      <legend>Assigned sites</legend>
      {sites.length ? (
        sites.map((site) => (
          <label className="checkbox-label" key={site.id}>
            <input
              type="checkbox"
              checked={selected.includes(site.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, site.id] : selected.filter((id) => id !== site.id))
              }
            />
            {site.name}
          </label>
        ))
      ) : (
        <p className="field-hint">
          No sites available yet. This member will have no site access until sites are assigned.
        </p>
      )}
    </fieldset>
  );
}
export function InviteForm({ organisationId, role, sites }: { organisationId: string; role: Role; sites: Site[] }) {
  const [open, setOpen] = useState(false);
  const [inviteRole, setRole] = useState<Role>('VIEWER');
  const [siteIds, setSites] = useState<string[]>([]);
  const m = useMutation();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    void m.run(async () => {
      await request(`organisations/${organisationId}/invitations`, 'POST', {
        email: data.get('email'),
        role: inviteRole,
        siteIds: inviteRole === 'SITE_MANAGER' ? siteIds : [],
      });
      form.reset();
      setRole('VIEWER');
      setSites([]);
    }, 'Invitation sent. It expires in 7 days.');
  }
  return (
    <div className="invite-panel">
      {m.feedback}
      <Button
        disabled={m.disabled}
        onClick={() => setOpen(!open)}
        variant={open ? 'secondary' : 'primary'}
        aria-expanded={open}
      >
        {open ? <X size={17} /> : <Plus size={17} />}
        {open ? 'Close invitation' : 'Invite member'}
      </Button>
      {open && (
        <form className="panel stack-form" onSubmit={submit}>
          <div>
            <h2>Bring your team together</h2>
            <p className="muted">They’ll receive a link to join this organisation.</p>
          </div>
          <div className="form-grid">
            <label>
              Email address
              <input name="email" type="email" required maxLength={254} placeholder="colleague@company.com" />
            </label>
            <label>
              Role
              <select name="role" value={inviteRole} onChange={(e) => setRole(e.target.value as Role)}>
                {roles
                  .filter((r) => canManageRole(role, r))
                  .map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {inviteRole === 'SITE_MANAGER' && <SiteChoices sites={sites} selected={siteIds} onChange={setSites} />}
          <Button disabled={m.disabled} type="submit">
            <Send size={15} />
            {m.pending ? 'Sending…' : 'Send invitation'}
          </Button>
        </form>
      )}
    </div>
  );
}
export function MemberActions({
  organisationId,
  member,
  actorRole,
  sites,
}: {
  organisationId: string;
  member: { id: string; role: Role; siteAssignments: { siteId: string }[] };
  actorRole: Role;
  sites: Site[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(member.role);
  const [siteIds, setSites] = useState(member.siteAssignments.map((s) => s.siteId));
  const [confirm, setConfirm] = useState(false);
  const m = useMutation();
  if (!canManageRole(actorRole, member.role)) return <span className="muted">Owner access</span>;
  const path = `organisations/${organisationId}/members/${member.id}`;
  return (
    <div className="member-actions">
      {m.feedback}
      <Button
        variant="secondary"
        disabled={m.disabled}
        onClick={() => {
          setOpen(!open);
          setConfirm(false);
          setRole(member.role);
          setSites(member.siteAssignments.map((s) => s.siteId));
        }}
        aria-expanded={open}
      >
        Manage
      </Button>
      {open && (
        <div className="member-editor">
          <label>
            Member role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roles
                .filter((r) => canManageRole(actorRole, r))
                .map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
            </select>
          </label>
          <Button
            variant="secondary"
            disabled={m.disabled || role === member.role}
            onClick={() =>
              void m.run(async () => {
                await request(path, 'PATCH', { role });
              })
            }
          >
            Save role
          </Button>
          {member.role === 'SITE_MANAGER' && (
            <>
              <SiteChoices sites={sites} selected={siteIds} onChange={setSites} />
              <Button
                variant="secondary"
                disabled={m.disabled}
                onClick={() =>
                  void m.run(async () => {
                    await request(`${path}/sites`, 'PUT', { siteIds });
                  })
                }
              >
                Save site access
              </Button>
            </>
          )}
          <div className="remove-area">
            {confirm ? (
              <>
                <p>Remove this person’s access to this organisation?</p>
                <Button
                  variant="danger"
                  disabled={m.disabled}
                  onClick={() =>
                    void m.run(async () => {
                      await request(path, 'DELETE');
                    })
                  }
                >
                  Confirm removal
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                Remove member
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export function RevokeInvite({ organisationId, id }: { organisationId: string; id: string }) {
  const m = useMutation();
  return (
    <div>
      {m.feedback}
      <Button
        variant="ghost"
        disabled={m.disabled}
        onClick={() =>
          void m.run(async () => {
            await request(`organisations/${organisationId}/invitations/${id}`, 'DELETE');
          }, 'Invitation revoked.')
        }
      >
        Revoke
      </Button>
    </div>
  );
}
export function AcceptInvite({ token }: { token: string }) {
  const m = useMutation();
  return (
    <>
      {m.feedback}
      <Button
        disabled={m.disabled}
        onClick={() =>
          void m.run(async () => {
            const result = await request('invitations/accept', 'POST', { token });
            m.router.push(`/org/${result.organisationId}/overview`);
          })
        }
      >
        {m.pending ? 'Joining…' : 'Accept invitation'}
        <ArrowRight size={17} />
      </Button>
    </>
  );
}
