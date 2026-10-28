/** Display-only money helpers. All arithmetic happens in integer paise on the server. */

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** 50000 → "₹500.00" */
export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  return inr.format(paise / 100);
}

/** 1000 → "10%"; 1250 → "12.5%" */
export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
}

/**
 * Parses a rupee amount typed by a person ("5000", "5,000.50") into integer
 * paise without floating-point rounding. Returns null if it isn't a valid amount.
 */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return paise > 0 ? paise : null;
}

/** Per-affiliate rate bounds; the API enforces the same range. */
export const MIN_RATE_BPS = 100;
export const MAX_RATE_BPS = 5000;

/**
 * Parses a percentage typed by a person ("12", "12.5", "12,5", "12.25%") into whole
 * basis points. Returns null unless it is within MIN_RATE_BPS–MAX_RATE_BPS.
 */
export function percentToBps(input: string): number | null {
  // A comma is accepted as the decimal separator too ("12,5").
  const match = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(input.replace(/[%\s]/g, ''));
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return bps >= MIN_RATE_BPS && bps <= MAX_RATE_BPS ? bps : null;
}
