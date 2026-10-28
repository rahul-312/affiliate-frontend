import type { ReactNode } from 'react';

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
}: {
  title: string;
  /** Small caps label above the title; defaults to the title itself. */
  eyebrow?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow ?? title}</div>
        <h1>{title}</h1>
        {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}
