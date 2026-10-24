import Link from 'next/link';
import Image from 'next/image';
import { Quote, UserRound } from 'lucide-react';

const introduction =
  'There are global energy challenges. A portion of energy used in business and residential buildings around the world is wasted. In addition, global emmissions are surging and a chunk from the energy we consume. Furthermore, energy bills are increasing in many places around the world*.';
const navigation = [
  ['Home', '/'],
  ['About', '#about'],
  ['Recognitions', 'https://app.energiepad.com/Recognitions'],
  ['How does it work?', 'https://app.energiepad.com/Work'],
  ['Progress', 'https://app.energiepad.com/Progress'],
  ['Team', 'https://app.energiepad.com/Team'],
  ['Blog', 'https://app.energiepad.com/Blog'],
  ['Gallery', 'https://app.energiepad.com/Gallery'],
  ['Contact us', '#contact'],
];
function Brand() {
  return (
    <Link href="/" className="welcome-brand" aria-label="EnergiePad home">
      <Image src="/assets/welcome/logo.png" alt="EnergiePad" width={84} height={52} />
    </Link>
  );
}
export function WelcomePage() {
  return (
    <div className="welcome-page">
      <header className="welcome-header">
        <Brand />
        <nav className="welcome-navigation" aria-label="Main navigation">
          {navigation.map(([label, href]) => (
            <a key={label} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <Link href="/login" className="welcome-login">
          <UserRound size={17} fill="currentColor" aria-hidden="true" />
          Login
        </Link>
      </header>
      <main id="main" className="welcome-main">
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <h1 id="welcome-title">Welcome to EnergiePad</h1>
          <p className="welcome-subtitle">
            WHERE YOUR JOURNEY TO BEING ENERGY SAVVY TO REDUCE CARBON AND UTILITY COSTS STARTS
          </p>
          <nav className="welcome-options" aria-label="Main options">
            {[
              { title: 'Settings', icon: 'settings' },
              { title: 'Analytics', icon: 'dashboard' },
              { title: 'User Management', icon: 'key' },
            ].map(({ title, icon }) => (
              <Link className="welcome-option" key={title} href="/login" aria-label={title}>
                <Image src={`/assets/welcome/${icon}.svg`} alt="" width={132} height={132} />
                <h2>
                  {title === 'User Management' ? (
                    <>
                      User
                      <br />
                      Management
                    </>
                  ) : (
                    title
                  )}
                </h2>
              </Link>
            ))}
          </nav>
        </section>
        <section id="about" className="welcome-info" aria-labelledby="welcome-info-title">
          <h2 id="welcome-info-title">
            DESIGNED TO HELP BUSINESSES AND HOMES REDUCE ENERGY CONSUMPTION AND UTILITY BILLS
          </h2>
          <div className="welcome-info-copy">
            <Quote className="welcome-quote" size={36} fill="currentColor" aria-hidden="true" />
            <p>{introduction}</p>
            <p>{introduction}</p>
          </div>
        </section>
      </main>
      <footer id="contact" className="welcome-footer">
        <div className="welcome-footer-grid">
          <div>
            <Brand />
            <p>
              Empowering businesses and homes
              <br />
              to reduce energy consumption and
              <br />
              carbon emmissions as well as
              <br />
              improving their green consumptions.
            </p>
          </div>
          <div>
            <h2>Sign up for our newsletter</h2>
            <form className="welcome-newsletter" action="mailto:info@energiepad.com" method="get">
              <input type="hidden" name="subject" value="Newsletter subscription request" />
              <label className="sr-only" htmlFor="newsletter-email">
                Email Address
              </label>
              <input id="newsletter-email" name="body" type="email" required placeholder="Email Address" />
              <button type="submit" title="Request a subscription using your email app">
                SUBSCRIBE
              </button>
            </form>
            <small>Subscribe using your email app.</small>
          </div>
          <div>
            <h2>Contact</h2>
            <p>
              GreenPad Enterprise
              <br />
              c/o EnergiePad, 24 Halborn Viaduct
              <br />
              London EC1A 2BN
              <br />
              <a href="mailto:info@energiepad.com">info@energiepad.com</a>
            </p>
          </div>
          <div className="welcome-social">
            <h2>Follow us</h2>
            <div aria-label="Instagram, Twitter and Facebook">
              <svg width="15" height="15" viewBox="0 0 24 24" role="img" aria-label="Instagram">
                <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
              </svg>
              <svg width="15" height="15" viewBox="0 0 24 24" role="img" aria-label="Twitter">
                <path
                  fill="currentColor"
                  d="M22 5.9a8.2 8.2 0 0 1-2.4.7A4.2 4.2 0 0 0 21.4 4a8.3 8.3 0 0 1-2.7 1 4.2 4.2 0 0 0-7.2 3.8A11.8 11.8 0 0 1 3 4.5a4.2 4.2 0 0 0 1.3 5.6 4.1 4.1 0 0 1-1.9-.5 4.2 4.2 0 0 0 3.4 4.1 4.2 4.2 0 0 1-1.9.1 4.2 4.2 0 0 0 3.9 2.9A8.4 8.4 0 0 1 2 18.4a11.8 11.8 0 0 0 18.2-9.9V8a8.4 8.4 0 0 0 1.8-2.1Z"
                />
              </svg>
              <svg width="15" height="15" viewBox="0 0 24 24" role="img" aria-label="Facebook">
                <path
                  fill="currentColor"
                  d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4A25 25 0 0 0 15 1c-3 0-5 1.8-5 5v3H7v4h3v9Z"
                />
              </svg>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
