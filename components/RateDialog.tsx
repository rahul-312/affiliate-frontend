'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { formatBps, MAX_RATE_BPS, MIN_RATE_BPS, percentToBps } from '@/lib/money';
import { Dialog } from './Dialog';
import { Notice } from './Notice';

interface RateDialogProps {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Prefilled rate in basis points; null starts the field empty. */
  initialBps: number | null;
  /** Allow submitting an empty field, which means "use the standard rate" (onConfirm gets null). */
  allowEmpty?: boolean;
  /** Keep Save disabled until the rate differs from initialBps, so nothing is saved for a no-op. */
  requireChange?: boolean;
  onConfirm: (rateBps: number | null) => Promise<void>;
  onClose: () => void;
}

/** Collects a commission rate as a percentage; used when approving an affiliate and when changing their rate. */
export function RateDialog({ title, description, confirmLabel, initialBps, allowEmpty, requireChange, onConfirm, onClose }: RateDialogProps) {
  const [value, setValue] = useState(initialBps === null ? '' : String(initialBps / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empty = value.trim() === '';
  const rateBps = empty ? null : percentToBps(value);
  const valid = empty ? Boolean(allowEmpty) : rateBps !== null;
  const unchanged = Boolean(requireChange) && rateBps === initialBps;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || unchanged || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(rateBps);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const hint = !valid
    ? `Enter a rate between ${formatBps(MIN_RATE_BPS)} and ${formatBps(MAX_RATE_BPS)}, up to 2 decimals.`
    : empty
      ? 'Left empty, the standard rate applies.'
      : unchanged
        ? 'This is the current rate.'
        : 'Applies to new sales. Commissions already recorded keep their rate.';

  return (
    <Dialog
      title={title}
      description={description}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="rate-form" className="btn btn-primary" disabled={busy || !valid || unchanged}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <form id="rate-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="rate-percent">Commission rate (%)</label>
          <input
            id="rate-percent"
            className="input"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            placeholder={allowEmpty ? 'Standard rate' : undefined}
            autoFocus
            required={!allowEmpty}
          />
          <span className="hint">{hint}</span>
        </div>
      </form>
    </Dialog>
  );
}
