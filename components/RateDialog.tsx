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
  /** Prefilled rate in basis points. */
  initialBps: number;
  onConfirm: (rateBps: number) => Promise<void>;
  onClose: () => void;
}

/** Collects a commission rate as a percentage; used when approving an affiliate and when changing their rate. */
export function RateDialog({ title, description, confirmLabel, initialBps, onConfirm, onClose }: RateDialogProps) {
  const [value, setValue] = useState(String(initialBps / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rateBps = percentToBps(value);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (rateBps === null) return;
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
          <button type="submit" form="rate-form" className="btn btn-primary" disabled={busy || rateBps === null}>
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
            autoFocus
            required
          />
          <span className="hint">
            {rateBps === null
              ? `Enter a rate between ${formatBps(MIN_RATE_BPS)} and ${formatBps(MAX_RATE_BPS)}, up to 2 decimals.`
              : 'Applies to new sales. Commissions already recorded keep their rate.'}
          </span>
        </div>
      </form>
    </Dialog>
  );
}
