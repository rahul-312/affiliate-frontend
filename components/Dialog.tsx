'use client';

import { useEffect, useId, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  footer: ReactNode;
  children?: ReactNode;
}

/** Accessible modal shell: labelled, closes on Escape or backdrop click. */
export function Dialog({ title, description, onClose, footer, children }: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {children ? <div className="dialog-body">{children}</div> : null}
        <div className="dialog-footer">{footer}</div>
      </div>
    </div>
  );
}
