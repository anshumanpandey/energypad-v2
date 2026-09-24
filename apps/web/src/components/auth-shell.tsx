import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Brand } from './brand';

export function AuthShell({ children }: { children: ReactNode }) {
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
        <div className="auth-form">{children}</div>
        <small className="muted">Your organisation. Your data. Your control.</small>
      </section>
    </main>
  );
}
