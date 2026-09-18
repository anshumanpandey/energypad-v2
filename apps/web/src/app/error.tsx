'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-page">
      <section className="center-card">
        <h1>Something went wrong.</h1>
        <p>We couldn’t load this workspace. Try again in a moment.</p>
        <Button onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
