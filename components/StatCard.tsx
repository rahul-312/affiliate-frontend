import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wave } from './Decor';
import { Icon, type IconName } from './Icon';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  href?: string;
  variant?: number;
}

export function StatCard({ label, value, hint, icon, href, variant = 0 }: StatCardProps) {
  const body = (
    <>
      <div className="stat-top">
        <div className="stat-label">{label}</div>
        {icon ? (
          <span className="icon-chip">
            <Icon name={icon} />
          </span>
        ) : null}
      </div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
      <Wave variant={variant} />
    </>
  );
  return href ? (
    <Link href={href} className="card stat-card stat-link">
      {body}
    </Link>
  ) : (
    <div className="card stat-card">{body}</div>
  );
}
