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

const HELD_FAILURE_REASON = 'Payout on hold: affiliate deactivated by ops';

/**
 * Finance confirms the bank transfer with its reference. Any affiliate whose
 * transfer failed is ticked with a reason; their commissions return to
 * "approved" and are retried in the next batch.
 *
 * An affiliate put on hold after the CSV was downloaded needs an explicit
 * answer, because only finance knows whether the bank already sent it:
 * "sent" records it as paid (so it is never paid twice), "not sent" marks it
 * failed and the money stays held.
 */
export function ConfirmPayoutDialog({ batch, onClose, onConfirmed }: ConfirmPayoutDialogProps) {
  const items = batch.items ?? [];
  const [reference, setReference] = useState('');
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [heldSent, setHeldSent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const failedIds = Object.keys(failed);
  const failedTotal = items.filter((i) => failedIds.includes(i.affiliate.id)).reduce((sum, i) => sum + i.amountPaise, 0);
  const referenceValid = REFERENCE_PATTERN.test(reference.trim());
  const reasonsValid = failedIds.every((id) => (failed[id] ?? '').trim().length >= 3);
  const heldItems = items.filter((i) => i.onHold);
  const heldDecided = heldItems.every((i) => i.affiliate.id in heldSent);

  const decideHeld = (affiliateId: string, sent: boolean) => {
    setHeldSent((current) => ({ ...current, [affiliateId]: sent }));
    setFailed((current) => {
      const next = { ...current };
      if (sent) delete next[affiliateId];
      else next[affiliateId] = current[affiliateId] ?? HELD_FAILURE_REASON;
      return next;
    });
  };

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
          heldPaidAcknowledged: Object.keys(heldSent).filter((affiliateId) => heldSent[affiliateId]),
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
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !referenceValid || !reasonsValid || !heldDecided}>
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
        if (item.onHold) {
          const id = item.affiliate.id;
          const name = item.affiliate.name ?? id;
          return (
            <div key={id} className="card" style={{ marginBottom: 8 }}>
              <div className="card-body" style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>
                    <strong>{name}</strong>
                    <span className="sub"> · on hold, deactivated by ops after the CSV was downloaded</span>
                  </span>
                  <strong className="mono">{formatPaise(item.amountPaise)}</strong>
                </div>
                <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0' }}>
                  <legend className="hint">Did the bank already send this transfer?</legend>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="radio" name={`held-${id}`} checked={heldSent[id] === true} onChange={() => decideHeld(id, true)} />
                    Yes, it went out: record it as paid
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="radio" name={`held-${id}`} checked={heldSent[id] === false} onChange={() => decideHeld(id, false)} />
                    No: mark it failed and keep the money on hold
                  </label>
                </fieldset>
                {heldSent[id] === false ? (
                  <input
                    className="input"
                    style={{ marginTop: 8 }}
                    value={failed[id]}
                    maxLength={500}
                    onChange={(e) => setFailed((current) => ({ ...current, [id]: e.target.value }))}
                    aria-label={`Failure reason for ${name}`}
                  />
                ) : null}
              </div>
            </div>
          );
        }
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
