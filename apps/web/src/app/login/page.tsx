import Link from 'next/link';
import { PasswordForm } from '@/components/password-form';
import { login } from './actions';
import { LoginError } from './login-error';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ callbackUrl: params.callbackUrl ?? '/' }).toString();
  return (
    <main className="reference-login auth-page-login">
      <div className="auth-form">
        <h1 className="sr-only">Your workspace awaits.</h1>
        <LoginError error={params.error} />
        <PasswordForm action={login} mode="login" callbackUrl={params.callbackUrl ?? '/'} />
        <Link href="/" className="login-home-link">
          Back to home
        </Link>
        <details className="login-options">
          <summary>More sign-in options</summary>
          <p className="login-account-link">
            New to EnergiePad?{' '}
            <Link href={`/signup?${query}`} className="text-link">
              Create an account →
            </Link>
          </p>
          <Link href={`/login/email?${query}`} className="text-link">
            Previously used email links? Sign in with an email link.
          </Link>
        </details>
      </div>
    </main>
  );
}
