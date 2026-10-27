'use client';

import { useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { formatBps, formatPaise, rupeesToPaise } from '@/lib/money';
import type { ConversionResult } from '@/lib/types';
import { Dialog } from './Dialog';
import { Notice } from './Notice';

interface SimulateSaleModalProps {
  defaultReferralCode?: string;
  onClose: () => void;
  onRecorded: () => void;
}

/**
 * Demo stand-in for the store webhook (only works when the backend runs with
 * DEMO_MODE=true). Reusing an order ID shows the idempotency rules in action.
 */
export function SimulateSaleModal({ defaultReferralCode = '', onClose, onRecorded }: SimulateSaleModalProps) {
  const [referralCode, setReferralCode] = useState(defaultReferralCode);
  const [amount, setAmount] = useState('5000');
  const [orderId, setOrderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);

  const amountPaise = rupeesToPaise(amount);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (amountPaise === null) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = { referralCode: referralCode.trim(), orderAmountPaise: amountPaise, ...(orderId.trim() && { orderId: orderId.trim() }) };
      const recorded = await apiRequest<ConversionResult>('/admin/demo/simulate-sale', { method: 'POST', body });
      setResult(recorded);
      onRecorded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Simulate a sale"
      description="Stands in for the store webhook in this demo. The same rules apply: the code must be active and the rate comes from the server."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <button type="submit" form="simulate-sale" className="btn btn-primary" disabled={busy || amountPaise === null || !referralCode.trim()}>
            {busy ? 'Recording…' : 'Record sale'}
          </button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {result?.commission ? (
        <Notice tone="success">
          {result.created ? 'Sale recorded' : 'Same order already recorded (safe retry, nothing new created)'}:{' '}
          {formatPaise(result.commission.amountPaise)} commission at {formatBps(result.commission.rateBps)}, order{' '}
          <code>{result.conversion.orderId}</code>.
        </Notice>
      ) : null}
      <form id="simulate-sale" onSubmit={submit}>
        <div className="field">
          <label htmlFor="sale-code">Referral code</label>
          <input id="sale-code" className="input mono" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} maxLength={16} required />
        </div>
        <div className="field">
          <label htmlFor="sale-amount">Order amount (₹)</label>
          <input id="sale-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          {amountPaise === null ? <span className="hint">Enter a positive amount with up to 2 decimals.</span> : null}
        </div>
        <div className="field">
          <label htmlFor="sale-order">Order ID (optional)</label>
          <input id="sale-order" className="input mono" value={orderId} onChange={(e) => setOrderId(e.target.value)} maxLength={100} placeholder="Generated if left empty" />
          <span className="hint">Reuse an order ID to test retries: same amount returns the original sale, a different amount is refused.</span>
        </div>
      </form>
    </Dialog>
  );
}
