'use client';

import { useState } from 'react';
import { ApiError, apiRequest, errorMessage } from '@/lib/api';
import { formatPaise } from '@/lib/money';
import type { BatchItem, PayoutBatch } from '@/lib/types';
import { Dialog } from './Dialog';
import { Notice } from './Notice';

interface ConfirmPayoutDialogProps {
  batch: PayoutBatch;
  onClose: () => void;
  onConfirmed: () => void;
  /** Reloads the batch; used when the server says a hold changed while the dialog was open. */
  onRefresh: () => Promise<void>;
}

const REFERENCE_PATTERN = /^[A-Za-z0-9\-_/]{4,64}$/;

const HELD_FAILURE_REASON = 'Payout on hold: affiliate deactivated by ops';
const EXCLUDED_FAILURE_REASON = 'Left out of the CSV sent to the bank';

/** Items the server can't settle on its own: on hold now, or left out of a CSV download. */
const needsDecision = (item: BatchItem) => Boolean(item.onHold || item.excludedFromExport);

/**
 * Finance confirms the bank transfer with its reference. Any affiliate whose
 * transfer failed is ticked with a reason; their commissions return to
 * "approved" and are retried in the next batch.
 *
 * An affiliate on hold, or left out of a CSV download, needs an explicit
 * answer, because only finance knows whether the bank already sent it:
 * "sent" records it as paid (so it is never paid twice), "not sent" marks it
 * failed (held money stays held; otherwise it is retried next batch).
 */
export function ConfirmPayoutDialog({ batch, onClose, onConfirmed, onRefresh }: ConfirmPayoutDialogProps) {
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
  const decisionItems = items.filter(needsDecision);
  const heldDecided = decisionItems.every((i) => i.affiliate.id in heldSent);
  // Held money answered "not sent" isn't retried until ops reactivates the affiliate, so it's shown separately.
  const onHoldTotal = items.filter((i) => i.onHold && heldSent[i.affiliate.id] === false).reduce((sum, i) => sum + i.amountPaise, 0);

  const decideHeld = (item: BatchItem, sent: boolean) => {
    const affiliateId = item.affiliate.id;
    setHeldSent((current) => ({ ...current, [affiliateId]: sent }));
    setFailed((current) => {
      const next = { ...current };
      if (sent) delete next[affiliateId];
      else next[affiliateId] = current[affiliateId] ?? (item.onHold ? HELD_FAILURE_REASON : EXCLUDED_FAILURE_REASON);
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
          heldPaidAcknowledged: decisionItems.map((i) => i.affiliate.id).filter((affiliateId) => heldSent[affiliateId]),
        },
      });
      onConfirmed();
      onClose();
    } catch (err) {
      // A hold started or ended while the dialog was open: reload so the questions match the server.
      if (err instanceof ApiError && (err.code === 'PAYOUT_ON_HOLD' || err.status === 400)) {
        await onRefresh();
        setError(`${errorMessage(err)} The batch has been refreshed: check the questions below and confirm again.`);
      } else {
        setError(errorMessage(err));
      }
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
        if (needsDecision(item)) {
          const id = item.affiliate.id;
          const name = item.affiliate.name ?? id;
          const why = item.onHold
            ? 'on hold: deactivated by ops after the CSV was downloaded'
            : 'left out of a CSV download because their payout was on hold at the time';
          return (
            <div key={id} className="card" style={{ marginBottom: 8 }}>
              <div className="card-body" style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>
                    <strong>{name}</strong>
                    <span className="sub"> · {why}</span>
                  </span>
                  <strong className="mono">{formatPaise(item.amountPaise)}</strong>
                </div>
                <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0' }}>
                  <legend className="hint">Did the bank already send this transfer?</legend>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="radio" name={`held-${id}`} checked={heldSent[id] === true} onChange={() => decideHeld(item, true)} />
                    Yes, it went out: record it as paid
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="radio" name={`held-${id}`} checked={heldSent[id] === false} onChange={() => decideHeld(item, false)} />
                    {item.onHold ? 'No: mark it failed and keep the money on hold' : 'No: mark it failed so it is paid in the next batch'}
                  </label>
                </fieldset>
                {heldSent[id] === false ? (
                  <input
                    className="input"
                    style={{ marginTop: 8 }}
                    placeholder="Reason, at least 3 characters"
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
        <dd>{formatPaise(failedTotal - onHoldTotal)}</dd>
        {onHoldTotal > 0 ? (
          <>
            <dt>On hold until reactivated</dt>
            <dd>{formatPaise(onHoldTotal)}</dd>
          </>
        ) : null}
      </dl>
    </Dialog>
  );
}
