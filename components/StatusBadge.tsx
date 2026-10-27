import { humanize } from '@/lib/format';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const TONES: Record<string, Tone> = {
  pending: 'warning',
  active: 'success',
  rejected: 'danger',
  approved: 'info',
  processing: 'info',
  paid: 'success',
  draft: 'neutral',
  exported: 'info',
  closed_with_failures: 'warning',
  cancelled: 'neutral',
  failed: 'danger',
};

const LABELS: Record<string, string> = {
  closed_with_failures: 'Partially paid',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? 'neutral';
  return <span className={`badge badge-${tone}`}>{LABELS[status] ?? humanize(status)}</span>;
}
