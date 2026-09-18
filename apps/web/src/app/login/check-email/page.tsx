import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Brand } from '@/components/brand';
export default function CheckEmail() {
  return (
    <main className="center-page">
      <Brand />
      <section className="center-card">
        <span className="large-icon">
          <MailCheck size={32} />
        </span>
        <span className="eyebrow">ONE MORE STEP</span>
        <h1>Check your inbox.</h1>
        <p>Open the sign-in link we sent to your email. It expires in 15 minutes and can be used once.</p>
        <p className="muted">Can’t find it? Check your spam folder.</p>
        <Link href="/login" className="text-link">
          Use a different email →
        </Link>
        {process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY && (
          <div className="notice">
            Development mode: messages are saved in <code>apps/web/.local/mail</code>.
          </div>
        )}
      </section>
    </main>
  );
}
