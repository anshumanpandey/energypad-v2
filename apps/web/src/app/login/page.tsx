import { ArrowUpRight, Check, ShieldCheck } from 'lucide-react';
import { Brand } from '@/components/brand';
import { SubmitButton } from '@/components/submit-button';
import { login } from './actions';
import { LoginError } from './login-error';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">A CLEARER PICTURE OF ENERGY</span>
          <h1>
            Better performance
            <br />
            starts with
            <br />
            <em>better foundations.</em>
          </h1>
          <p>Bring your people, places and energy insights into one connected workspace.</p>
          <div className="story-points">
            <span>
              <Check size={17} /> One workspace for your organisation
            </span>
            <span>
              <Check size={17} /> The right access for every person
            </span>
            <span>
              <Check size={17} /> Built for a more efficient future
            </span>
          </div>
        </div>
        <small>ENERGIEPAD / WORKSPACE V2</small>
      </section>
      <section className="auth-content">
        <div className="auth-form">
          <span className="tag">Welcome to EnergiePad</span>
          <h2>Your workspace awaits.</h2>
          <p>Sign in or create your account with a secure email link. No password to remember.</p>
          <LoginError error={params.error} />
          <form action={login}>
            <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? '/'} />
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <SubmitButton>
              Continue with email <ArrowUpRight size={17} />
            </SubmitButton>
          </form>
          <div className="auth-note">
            <ShieldCheck size={19} />
            <span>
              We’ll send a one-time link to verify it’s you.
              <br />
              Your link is valid for 15 minutes.
            </span>
          </div>
        </div>
        <small className="muted">Your organisation. Your data. Your control.</small>
      </section>
    </main>
  );
}
