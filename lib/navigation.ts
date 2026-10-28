import type { IconName } from '@/components/Icon';
import type { StaffRole } from './types';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles: readonly StaffRole[];
}

/** Single source of truth for which role sees which page; the (app) layout guard uses it too. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/overview', label: 'Overview', icon: 'home', roles: ['ops', 'finance'] },
  { href: '/affiliates', label: 'Affiliates', icon: 'users', roles: ['ops', 'finance'] },
  { href: '/commissions', label: 'Commissions', icon: 'coins', roles: ['ops', 'finance'] },
  { href: '/payouts', label: 'Payouts', icon: 'banknote', roles: ['finance'] },
];

export function canAccess(pathname: string, role: StaffRole): boolean {
  const item = NAV_ITEMS.find((nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`));
  return item ? item.roles.includes(role) : false;
}
