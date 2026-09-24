import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { PasswordForm } from '@/components/password-form';
import { signup } from '../login/actions';
import { LoginError } from '../login/login-error';
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ callbackUrl: params.callbackUrl ?? '/' }).toString();
  return (
    <AuthShell>
      <span className="tag">Get started with EnergiePad</span>
      <h2>Create your account.</h2>
      <p>Use your email address and a password. No confirmation email is required.</p>
      <LoginError error={params.error} />
      <PasswordForm action={signup} mode="signup" callbackUrl={params.callbackUrl ?? '/'} />
      <p>
        Already have an account?{' '}
        <Link href={`/login?${query}`} className="text-link">
          Sign in →
        </Link>
      </p>
    </AuthShell>
  );
}
