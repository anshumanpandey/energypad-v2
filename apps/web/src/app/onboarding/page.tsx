import Link from 'next/link';
import { Building2, ShieldCheck } from 'lucide-react';
import { Brand } from '@/components/brand';
import { OnboardingForm } from './onboarding-form';
import { pageActor } from '@/server/page-auth';
import { logout } from '@/app/login/actions';
export default async function Onboarding() {
  const { user } = await pageActor('/onboarding');
  return (
    <main className="onboarding">
      <header>
        <Brand />
        <form action={logout}>
          <button className="text-link">Sign out</button>
        </form>
      </header>
      <div className="onboarding-grid">
        <section>
          <span className="eyebrow">YOUR WORKSPACE STARTS HERE</span>
          <h1>
            Make room for
            <br />
            <em>better energy.</em>
          </h1>
          <p>
            Create a home for your organisation. Invite your team, set the right permissions and get ready to connect
            your sites.
          </p>
          <div className="onboarding-benefit">
            <ShieldCheck />
            <div>
              <strong>Yours from the start</strong>
              <p>You’ll be the workspace owner, with full control over access and settings.</p>
            </div>
          </div>
          <Link href="/" className="text-link">
            ← Back to my workspace
          </Link>
        </section>
        <section className="panel onboarding-form">
          <span className="large-icon">
            <Building2 />
          </span>
          <h2>Create your organisation</h2>
          <p className="muted">Signed in as {user.email}</p>
          <OnboardingForm />
          <div className="plan-note">
            <strong>Starter workspace</strong>
            <span>Up to 5 sites · Core energy tools</span>
            <small>Billing and site setup are coming in later releases.</small>
          </div>
        </section>
      </div>
    </main>
  );
}
