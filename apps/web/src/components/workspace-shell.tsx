'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  ScrollText,
  BarChart3,
  FileText,
  Layers3,
  Menu,
  X,
  LogOut,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
import { Brand } from './brand';
import { can, roleLabels, type Role } from '@/domain/policy';
import { logout } from '@/app/login/actions';

export function WorkspaceShell({
  children,
  organisation,
  organisations,
  role,
  email,
}: {
  children: React.ReactNode;
  organisation: { id: string; name: string; plan: { name: string } };
  organisations: { id: string; name: string }[];
  role: Role;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const section = pathname.split('/')[3] ?? 'overview';
  const nav = [
    { key: 'overview', name: 'Overview', icon: LayoutDashboard },
    { key: 'sites', name: 'Sites', icon: Building2 },
    { key: 'analysis', name: 'Analysis', icon: BarChart3 },
    { key: 'reports', name: 'Reports', icon: FileText },
    { key: 'portfolio', name: 'Portfolio', icon: Layers3 },
  ];
  const admin = [
    { key: 'members', name: 'Team members', icon: Users, permission: 'members:manage' as const },
    { key: 'audit', name: 'Activity log', icon: ScrollText, permission: 'audit:read' as const },
    { key: 'settings', name: 'Settings', icon: Settings, permission: 'organisation:update' as const },
  ].filter((item) => can(role, item.permission));
  const title = [...nav, ...admin].find((item) => item.key === section)?.name ?? 'Workspace';
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {open && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Link href={`/org/${organisation.id}/overview`} aria-label="EnergiePad overview">
            <Brand />
          </Link>
          <button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <label className="organisation-switch">
          <span>WORKSPACE</span>
          <select
            aria-label="Switch organisation"
            value={organisation.id}
            onChange={(e) => {
              router.push(`/org/${e.target.value}/overview`);
              setOpen(false);
            }}
          >
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <small>{roleLabels[role]} access</small>
        </label>
        <nav aria-label="Main navigation">
          <span className="nav-caption">WORKSPACE</span>
          {nav.map(({ key, name, icon: Icon }) => (
            <Link
              key={key}
              href={`/org/${organisation.id}/${key}`}
              className={section === key ? 'nav-link active' : 'nav-link'}
              aria-current={section === key ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {name}
              {section === key && <span className="nav-dot" />}
            </Link>
          ))}
          {admin.length > 0 && (
            <>
              <span className="nav-caption admin-caption">MANAGE</span>
              {admin.map(({ key, name, icon: Icon }) => (
                <Link
                  key={key}
                  href={`/org/${organisation.id}/${key}`}
                  className={section === key ? 'nav-link active' : 'nav-link'}
                  aria-current={section === key ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={19} />
                  {name}
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <span className="plan-dot" />
            <strong>{organisation.plan.name} plan</strong>
            <p>A foundation for better energy.</p>
            <Link href="/onboarding">
              Create another workspace <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="user-card">
            <span className="avatar">{email.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong title={email}>{email}</strong>
              <small>{roleLabels[role]}</small>
            </div>
            <form action={logout}>
              <button className="icon-button" title="Sign out" aria-label="Sign out">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Menu size={21} />
            </button>
            <span>{organisation.name}</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <span className="workspace-status">
            <span />
            Workspace V2
          </span>
        </header>
        <main id="main" className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Built for better energy decisions.</span>
          <span>EnergiePad V2 · Foundation release</span>
        </footer>
      </div>
    </div>
  );
}
