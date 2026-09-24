import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { SubmitButton } from '@/components/submit-button';
import { emailLogin } from '../actions';
import { LoginError } from '../login-error';
export default async function EmailLogin({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell>
      <span className="tag">Email-link sign in</span>
      <h2>Sign in with an email link.</h2>
      <p>Enter your email address and we’ll send you a secure sign-in link.</p>
      <LoginError error={params.error} />
      <form action={emailLogin}>
        <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? '/'} />
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <SubmitButton>Continue with email</SubmitButton>
      </form>
      <Link href={`/login?${new URLSearchParams({ callbackUrl: params.callbackUrl ?? '/' })}`} className="text-link">
        ← Sign in with a password
      </Link>
    </AuthShell>
  );
}
