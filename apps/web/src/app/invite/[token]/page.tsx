import Link from 'next/link';
import { Users } from 'lucide-react';
import { pageActor } from '@/server/page-auth';
import { foundation } from '@/server/services';
import { DomainError, roleLabels, tokenInput } from '@/domain/policy';
import { AcceptInvite } from '@/components/forms';
import { Brand } from '@/components/brand';
import { logout } from '@/app/login/actions';
export default async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { actor, user } = await pageActor(`/invite/${token}`);
  let invite;
  if (tokenInput.safeParse({ token }).success) {
    try {
      invite = await foundation.getInvitation(actor, { token });
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }
  }
  return (
    <main className="center-page">
      <Brand />
      <section className="center-card">
        <span className="large-icon">
          <Users size={30} />
        </span>
        {invite ? (
          <>
            <span className="eyebrow">YOU’RE INVITED</span>
            <h1>Join {invite.organisation.name}</h1>
            <p>
              Your role will be <strong>{roleLabels[invite.role]}</strong>. You’re signed in as {user.email}.
            </p>
            <AcceptInvite token={token} />
          </>
        ) : (
          <>
            <h1>Invitation unavailable</h1>
            <p>
              This link may have expired, been revoked or already been used. Make sure you’re signed in with the invited
              email address.
            </p>
            <p className="muted">Signed in as {user.email}</p>
          </>
        )}
        <form action={logout}>
          <button className="text-link">Sign out to use another email</button>
        </form>
        <Link href="/" className="text-link">
          Go to my workspace →
        </Link>
      </section>
    </main>
  );
}
