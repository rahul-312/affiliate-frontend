'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/navigation';
import { Sidebar } from '@/components/Sidebar';

/**
 * Client-side guard: sends signed-out users to /login and keeps each role on
 * its own pages. This is a UX guard only; the API enforces every permission.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, ready } = useAuth();
  const allowed = role !== null && canAccess(pathname, role);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login');
    else if (!allowed) router.replace('/overview');
  }, [ready, user, allowed, router]);

  if (!ready || !user || !allowed) return <div className="loading">Loading…</div>;

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">{children}</main>
    </div>
  );
}
