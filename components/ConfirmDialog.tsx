'use client';

import { useState, type ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { Dialog } from './Dialog';
import { Notice } from './Notice';

interface ConfirmDialogProps {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** When set, a reason must be typed before confirming (min 3 characters, as the API requires). */
  reasonLabel?: string;
  reasonRequired?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

/** Confirmation for irreversible actions, optionally collecting a reason. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger,
  reasonLabel,
  reasonRequired = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = reason.trim();
  const reasonInvalid = reasonRequired && trimmed.length < 3;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error && !('status' in err) ? err.message : errorMessage(err));
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
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={submit}
            disabled={busy || reasonInvalid}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {reasonLabel ? (
        <div className="field">
          <label htmlFor="confirm-reason">
            {reasonLabel}
            {reasonRequired ? '' : ' (optional)'}
          </label>
          <textarea
            id="confirm-reason"
            className="input"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          {reasonRequired ? <span className="hint">At least 3 characters. Shown in the audit trail.</span> : null}
        </div>
      ) : null}
    </Dialog>
  );
}
