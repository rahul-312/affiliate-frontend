import type { StaffRole } from './types';

export interface NavItem {
  href: string;
  label: string;
  roles: readonly StaffRole[];
}

/** Single source of truth for which role sees which page; the (app) layout guard uses it too. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/overview', label: 'Overview', roles: ['ops', 'finance'] },
  { href: '/affiliates', label: 'Affiliates', roles: ['ops', 'finance'] },
  { href: '/commissions', label: 'Commissions', roles: ['ops', 'finance'] },
  { href: '/payouts', label: 'Payouts', roles: ['finance'] },
];

export function canAccess(pathname: string, role: StaffRole): boolean {
  const item = NAV_ITEMS.find((nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`));
  return item ? item.roles.includes(role) : false;
}
