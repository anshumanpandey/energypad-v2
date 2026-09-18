import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="center-page">
      <section className="center-card">
        <span className="eyebrow">NOT AVAILABLE</span>
        <h1>We couldn’t find that page.</h1>
        <p>It may have moved, or your account may not have access.</p>
        <Link href="/" className="text-link">
          Return to your workspace →
        </Link>
      </section>
    </main>
  );
}
