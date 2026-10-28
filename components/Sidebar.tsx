'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { NAV_ITEMS } from '@/lib/navigation';
import { LeafShadow } from './Decor';
import { Icon } from './Icon';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  if (!user || !role) return null;

  return (
    <nav className="sidebar" aria-label="Main">
      <LeafShadow className="sidebar-leaf" />
      <div className="brand">
        Affiliate Hub
        <small>{role === 'ops' ? 'Affiliate team' : 'Finance team'}</small>
      </div>
      <div className="nav-list">
        {NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={`nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="sidebar-footer">
        <div className="who-row">
          <span className="avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <div>
            <div className="who">{user.name}</div>
            <div className="role">{role}</div>
          </div>
        </div>
        <button type="button" className="btn btn-sm signout" onClick={signOut}>
          <Icon name="logout" size={16} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
