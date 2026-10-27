'use client';

import { humanize } from '@/lib/format';

interface StatusTabsProps<S extends string> {
  options: readonly S[];
  value: S | 'all';
  onChange: (value: S | 'all') => void;
  label: string;
}

export function StatusTabs<S extends string>({ options, value, onChange, label }: StatusTabsProps<S>) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {(['all', ...options] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          className={`tab${value === option ? ' active' : ''}`}
          onClick={() => onChange(option)}
        >
          {humanize(option)}
        </button>
      ))}
    </div>
  );
}
