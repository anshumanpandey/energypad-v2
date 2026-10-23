import Link from 'next/link';
import { ArrowUpRight, BarChart3, Leaf, Settings, Users, Zap } from 'lucide-react';

const introduction =
  'There are global energy challenges. A portion of energy used in business and residential buildings around the world is wasted. In addition, global emmissions are surging and a chunk from the energy we consume. Furthermore, energy bills are increasing in many places around the world*.';

export function WelcomePage() {
  const options = [
    {
      title: 'Settings',
      description: 'Set up your workspace and organisation preferences.',
      href: '/login',
      icon: Settings,
    },
    {
      title: 'Analytics',
      description: 'Explore your energy performance, carbon footprint and utility costs.',
      href: '/login',
      icon: BarChart3,
    },
    {
      title: 'User Management',
      description: 'Manage your team and their access to your workspace.',
      href: '/login',
      icon: Users,
    },
  ];
  return (
    <div className="welcome-page">
      <header className="welcome-header">
        <Link href="/" className="welcome-brand" aria-label="EnergiePad home">
          <span>
            <Zap size={24} aria-hidden="true" />
          </span>
          energiepad
        </Link>
      </header>
      <main id="main" className="welcome-main">
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <span className="welcome-kicker">
            <Leaf size={16} aria-hidden="true" /> SMALL CHANGES. LASTING IMPACT.
          </span>
          <h1 id="welcome-title">
            Welcome to <span>EnergiePad</span>
          </h1>
          <p className="welcome-subtitle">
            WHERE YOUR JOURNEY TO BEING ENERGY SAVVY TO REDUCE CARBON AND UTILITY COSTS STARTS
          </p>
        </section>
        <nav className="welcome-options" aria-label="Main options">
          {options.map(({ title, description, href, icon: Icon }, index) => {
            const content = (
              <>
                <div className="welcome-option-top">
                  <span className="welcome-option-icon">
                    <Icon size={27} aria-hidden="true" />
                  </span>
                  <span className="welcome-option-number">0{index + 1}</span>
                </div>
                <h2>{title}</h2>
                <p>{description}</p>
                <span className="welcome-option-action">
                  Get started
                  <ArrowUpRight size={21} aria-hidden="true" />
                </span>
              </>
            );
            return (
              <Link className="welcome-option" key={title} href={href} aria-label={title}>
                {content}
              </Link>
            );
          })}
        </nav>
        <section className="welcome-info" aria-labelledby="welcome-info-title">
          <div>
            <span className="welcome-kicker">A BETTER ENERGY FUTURE</span>
            <h2 id="welcome-info-title">
              DESIGNED TO HELP BUSINESSES AND HOMES REDUCE ENERGY CONSUMPTION AND UTILITY BILLS
            </h2>
          </div>
          <div className="welcome-info-copy">
            <p>{introduction}</p>
            <p>{introduction}</p>
          </div>
        </section>
      </main>
      <footer className="welcome-footer">EnergiePad · Built for better energy decisions.</footer>
    </div>
  );
}
