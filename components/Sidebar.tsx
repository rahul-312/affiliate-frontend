'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { NAV_ITEMS } from '@/lib/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  if (!user || !role) return null;

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        Affiliate Hub
        <small>{role === 'ops' ? 'Affiliate team' : 'Finance team'}</small>
      </div>
      {NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={`nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
      <div className="sidebar-footer">
        <div className="who">{user.name}</div>
        <div className="role">{role}</div>
        <button type="button" className="btn btn-sm" onClick={signOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
