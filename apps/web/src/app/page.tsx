import Image from 'next/image';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { OverviewShortcuts } from '@/components/overview-shortcuts';
import { WorkspaceAreas } from '@/components/workspace-areas';

export default function Landing() {
  return (
    <div className="welcome-page overview-landing">
      <header className="welcome-header">
        <Link href="/login" className="welcome-brand" aria-label="EnergiePad home">
          <Image src="/assets/welcome/logo.png" alt="EnergiePad" width={84} height={52} />
        </Link>
        <nav className="welcome-navigation" aria-label="Main navigation">
          {[
            'Home',
            'About',
            'Recognitions',
            'How does it work?',
            'Progress',
            'Team',
            'Blog',
            'Gallery',
            'Contact us',
          ].map((label) => (
            <Link key={label} href="/login">
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/login" className="welcome-login">
          <UserRound size={17} fill="currentColor" aria-hidden="true" />
          Login
        </Link>
      </header>
      <main className="overview-landing-main">
        <WorkspaceAreas organisationId="" section="overview" overviewArea="settings" manageMembers loginOnly />
        <div className="overview-hub overview-landing-content">
          <OverviewShortcuts base="" area="settings" loginOnly />
        </div>
      </main>
    </div>
  );
}
