import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
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
    <AuthShell>
      <span className="tag">Welcome to EnergiePad</span>
      <h2>Your workspace awaits.</h2>
      <p>Sign in with your email address and password.</p>
      <LoginError error={params.error} />
      <PasswordForm action={login} mode="login" callbackUrl={params.callbackUrl ?? '/'} />
      <p>
        New to EnergiePad?{' '}
        <Link href={`/signup?${query}`} className="text-link">
          Create an account →
        </Link>
      </p>
      <Link href={`/login/email?${query}`} className="text-link">
        Previously used email links? Sign in with an email link.
      </Link>
    </AuthShell>
  );
}
