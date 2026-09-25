'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function LoginError({ error }: { error?: string }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams.has('error')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    // Keep this attempt's message visible, but do not replay it on refresh.
    // Preserve the callback URL and fragment; Next.js retains its router history state.
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [searchParams]);

  if (!error) return null;
  return (
    <div role="alert" className="notice error">
      {{
        InvalidEmail: 'Enter a valid email address.',
        InvalidPassword: 'Use a password with 12–128 characters.',
        PasswordMismatch: 'Passwords do not match. Please enter the same password in both fields.',
        Credentials: 'Email or password is incorrect.',
        SignupFailed: 'Unable to create this account. Try signing in instead.',
        RateLimited: 'Too many attempts. Please try again in 15 minutes.',
        Unavailable: 'Sign-in is temporarily unavailable. Please try again.',
      }[error] ?? 'We couldn’t sign you in. Request a fresh link, or try again in 15 minutes.'}
    </div>
  );
}
