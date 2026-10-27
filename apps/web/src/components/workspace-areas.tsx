import Image from 'next/image';
import Link from 'next/link';

export function WorkspaceAreas({
  organisationId,
  section,
  manageMembers,
  overviewArea,
  loginOnly = false,
}: {
  organisationId: string;
  section: string;
  manageMembers: boolean;
  overviewArea: 'settings' | 'analytics';
  loginOnly?: boolean;
}) {
  const base = `/org/${organisationId}`;
  const active =
    section === 'overview'
      ? overviewArea
      : ['members', 'audit'].includes(section)
        ? 'users'
        : [
              'consumption',
              'emissions',
              'waste-savings',
              'analysis',
              'ai-analyst',
              'carbon',
              'carbon-trends',
              'reports',
            ].includes(section)
          ? 'analytics'
          : 'settings';
  return (
    <section className="overview-hub-hero workspace-area-menu" aria-label="Dashboard sections">
      <nav className="overview-hub-options" aria-label="Workspace areas">
        {[
          { key: 'settings', title: 'Settings', icon: 'settings', href: `${base}/overview#overview-settings` },
          {
            key: 'analytics',
            title: 'Analytics',
            icon: 'dashboard',
            href: section === 'overview' ? `${base}/overview?area=analytics#overview-settings` : `${base}/consumption`,
          },
          { key: 'users', title: 'User Management', icon: 'key', href: `${base}/members` },
        ].map(({ key, title, icon, href }) => {
          const content = (
            <>
              <Image src={`/assets/welcome/${icon}.svg`} alt="" width={100} height={100} />
              <span>{title}</span>
            </>
          );
          return key === 'users' && !manageMembers ? (
            <div key={key} className="overview-hub-option is-unavailable">
              {content}
              <small>Managed by your workspace administrator</small>
            </div>
          ) : (
            <Link
              key={key}
              className={`overview-hub-option${active === key ? ' is-current' : ''}`}
              href={loginOnly ? '/login' : href}
              aria-current={active === key ? 'true' : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
