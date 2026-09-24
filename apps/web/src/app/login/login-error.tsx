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
      {error === 'InvalidEmail'
        ? 'Enter a valid email address.'
        : 'We couldn’t sign you in. Request a fresh link, or try again in 15 minutes.'}
    </div>
  );
}
