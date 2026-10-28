'use client';

import { useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { formatPaise } from '@/lib/money';
import type { PayoutBatch } from '@/lib/types';
import { Dialog } from './Dialog';
import { Notice } from './Notice';

interface ConfirmPayoutDialogProps {
  batch: PayoutBatch;
  onClose: () => void;
  onConfirmed: () => void;
}

const REFERENCE_PATTERN = /^[A-Za-z0-9\-_/]{4,64}$/;

/**
 * Finance confirms the bank transfer with its reference. Any affiliate whose
 * transfer failed is ticked with a reason; their commissions return to
 * "approved" and are retried in the next batch.
 */
export function ConfirmPayoutDialog({ batch, onClose, onConfirmed }: ConfirmPayoutDialogProps) {
  const items = batch.items ?? [];
  const [reference, setReference] = useState('');
  // Affiliates put on hold after the batch was created start ticked as failed: the server refuses to pay them.
  const [failed, setFailed] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.filter((i) => i.onHold).map((i) => [i.affiliate.id, 'Payout on hold: affiliate deactivated by ops'])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const failedIds = Object.keys(failed);
  const failedTotal = items.filter((i) => failedIds.includes(i.affiliate.id)).reduce((sum, i) => sum + i.amountPaise, 0);
  const referenceValid = REFERENCE_PATTERN.test(reference.trim());
  const reasonsValid = failedIds.every((id) => (failed[id] ?? '').trim().length >= 3);

  const toggle = (affiliateId: string) =>
    setFailed((current) => {
      const next = { ...current };
      if (affiliateId in next) delete next[affiliateId];
      else next[affiliateId] = '';
      return next;
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/admin/payouts/${batch.id}/confirm`, {
        method: 'POST',
        body: {
          paymentReference: reference.trim(),
          failedItems: failedIds.map((affiliateId) => ({ affiliateId, reason: (failed[affiliateId] ?? '').trim() })),
        },
      });
      onConfirmed();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Confirm payment for ${batch.batchNo}`}
      description="Only confirm once the bank transfer has been sent. This can't be undone."
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !referenceValid || !reasonsValid}>
            {busy ? 'Confirming…' : failedIds.length ? `Confirm, ${failedIds.length} failed` : 'Confirm all paid'}
          </button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="field">
        <label htmlFor="payment-reference">Payment reference (bank / UTR)</label>
        <input
          id="payment-reference"
          className="input mono"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. UTR123456"
          maxLength={64}
          autoFocus
        />
        <span className="hint">4–64 characters: letters, digits, - _ /</span>
      </div>

      <div className="field">
        <label>Did any transfer fail?</label>
        <span className="hint">Tick the affiliates whose payment did not go through and say why.</span>
      </div>
      {items.map((item) => {
        const isFailed = item.affiliate.id in failed;
        return (
          <div key={item.affiliate.id} className="card" style={{ marginBottom: 8 }}>
            <div className="card-body" style={{ padding: '10px 14px' }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={isFailed} onChange={() => toggle(item.affiliate.id)} />
                <span style={{ flex: 1 }}>
                  <strong>{item.affiliate.name ?? item.affiliate.id}</strong>
                  <span className="sub"> · {item.commissionCount} commission(s)</span>
                </span>
                <strong className="mono">{formatPaise(item.amountPaise)}</strong>
              </label>
              {isFailed ? (
                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  placeholder="Reason, e.g. account closed"
                  value={failed[item.affiliate.id]}
                  maxLength={500}
                  onChange={(e) => setFailed((current) => ({ ...current, [item.affiliate.id]: e.target.value }))}
                  aria-label={`Failure reason for ${item.affiliate.name ?? item.affiliate.id}`}
                />
              ) : null}
            </div>
          </div>
        );
      })}

      <dl className="kv" style={{ marginTop: 12 }}>
        <dt>Batch total</dt>
        <dd>{formatPaise(batch.originalTotalPaise)}</dd>
        <dt>Marked paid</dt>
        <dd>{formatPaise(batch.originalTotalPaise - failedTotal)}</dd>
        <dt>Needs another attempt</dt>
        <dd>{formatPaise(failedTotal)}</dd>
      </dl>
    </Dialog>
  );
}
