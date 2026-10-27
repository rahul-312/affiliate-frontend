'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { apiDownload, apiRequest, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { BatchItem, PayoutBatch } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ConfirmPayoutDialog } from '@/components/ConfirmPayoutDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';

const itemColumns = (showReason: boolean): Column<BatchItem>[] => [
  {
    key: 'who',
    header: 'Affiliate',
    render: (i) => (
      <>
        <strong>{i.affiliate.name ?? i.affiliate.id}</strong>
        <div className="sub">{i.affiliate.email}</div>
      </>
    ),
  },
  { key: 'count', header: 'Commissions', numeric: true, render: (i) => i.commissionCount },
  { key: 'amount', header: 'Amount', numeric: true, render: (i) => <strong>{formatPaise(i.amountPaise)}</strong> },
  ...(showReason ? [{ key: 'reason', header: 'Reason', render: (i: BatchItem) => i.failureReason ?? '—' }] : []),
  { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
];

export default function PayoutBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const { data: batch, error, reload } = useApi(`batch:${id}`, () =>
    apiRequest<PayoutBatch>(`/admin/payouts/${encodeURIComponent(id)}`),
  );

  const download = async () => {
    if (!batch) return;
    setDownloading(true);
    setMessage(null);
    try {
      await apiDownload(`/admin/payouts/${batch.id}/export.csv`, `${batch.batchNo}.csv`);
      setMessage({ tone: 'success', text: 'CSV downloaded. Upload it to the bank, then confirm here with the payment reference.' });
      await reload();
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setDownloading(false);
    }
  };

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!batch) return <div className="loading">Loading…</div>;

  const items = batch.items ?? [];
  const isOpen = batch.status === 'draft' || batch.status === 'exported';
  const isClosed = batch.status === 'paid' || batch.status === 'closed_with_failures';
  const paidItems = items.filter((i) => i.status === 'paid');
  const failedItems = items.filter((i) => i.status === 'failed');

  return (
    <>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/payouts">← All payouts</Link>
      </p>
      <PageHeader
        title={`Payout ${batch.batchNo}`}
        subtitle={<StatusBadge status={batch.status} />}
        actions={
          isOpen ? (
            <>
              {batch.status === 'draft' ? (
                <button type="button" className="btn btn-danger" onClick={() => setCancelling(true)}>
                  Cancel batch
                </button>
              ) : null}
              <button type="button" className="btn" onClick={download} disabled={downloading}>
                {downloading ? 'Preparing…' : batch.status === 'draft' ? 'Download CSV' : 'Download CSV again'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirming(true)}
                disabled={batch.status !== 'exported'}
                title={batch.status !== 'exported' ? 'Download the CSV and send the payments first' : undefined}
              >
                Confirm payment
              </button>
            </>
          ) : null
        }
      />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {batch.status === 'draft' ? (
        <Notice tone="info">Step 1: download the CSV and upload it to the bank. Downloading does not mark anything as paid.</Notice>
      ) : null}
      {batch.status === 'exported' ? (
        <Notice tone="info">
          Step 2: once the transfer has gone out, confirm with the bank/UTR reference. Exported batches can&apos;t be cancelled, so mark any unsent
          transfer as failed instead.
        </Notice>
      ) : null}
      {batch.status === 'closed_with_failures' ? (
        <Notice tone="warning">
          Partially paid: {formatPaise(batch.paidPaise)} of {formatPaise(batch.originalTotalPaise)}. {batch.failedItemCount} item(s) need another
          attempt; their commissions are back to approved and will be included in the next batch.
        </Notice>
      ) : null}

      <div className="stats">
        <div className="card"><div className="card-body"><div className="stat-label">Batch total</div><div className="stat-value">{formatPaise(batch.originalTotalPaise)}</div></div></div>
        <div className="card"><div className="card-body"><div className="stat-label">Paid</div><div className="stat-value">{formatPaise(batch.paidPaise)}</div></div></div>
        <div className="card"><div className="card-body"><div className="stat-label">Failed</div><div className="stat-value">{formatPaise(batch.failedPaise)}</div></div></div>
        <div className="card">
          <div className="card-body">
            <dl className="kv">
              <dt>Created</dt><dd>{formatDateTime(batch.createdAt)}</dd>
              <dt>Exported</dt><dd>{formatDateTime(batch.exportedAt)}</dd>
              <dt>Confirmed</dt><dd>{formatDateTime(batch.paidAt)}</dd>
              <dt>Reference</dt><dd>{batch.paymentReference ? <code>{batch.paymentReference}</code> : '—'}</dd>
              {batch.cancelReason ? (<><dt>Cancelled</dt><dd>{batch.cancelReason}</dd></>) : null}
            </dl>
          </div>
        </div>
      </div>

      {isClosed ? (
        <>
          <div className="card">
            <div className="section-title"><h2>Paid</h2></div>
            <DataTable columns={itemColumns(false)} rows={paidItems} rowKey={(i) => i.affiliate.id} emptyMessage="No items were paid." />
          </div>
          {failedItems.length > 0 ? (
            <div className="card">
              <div className="section-title"><h2>Failed: needs another attempt</h2></div>
              <DataTable columns={itemColumns(true)} rows={failedItems} rowKey={(i) => i.affiliate.id} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="card">
          <div className="section-title"><h2>Per-affiliate breakdown</h2></div>
          <DataTable columns={itemColumns(false)} rows={items} rowKey={(i) => i.affiliate.id} emptyMessage="This batch has no items." />
        </div>
      )}

      {confirming ? <ConfirmPayoutDialog batch={batch} onClose={() => setConfirming(false)} onConfirmed={reload} /> : null}
      {cancelling ? (
        <ConfirmDialog
          title={`Cancel ${batch.batchNo}?`}
          description="Its commissions go back to approved and can be included in a new batch."
          confirmLabel="Cancel batch"
          danger
          reasonLabel="Reason"
          onConfirm={async (reason) => {
            await apiRequest(`/admin/payouts/${batch.id}/cancel`, { method: 'POST', body: reason ? { reason } : {} });
            await reload();
          }}
          onClose={() => setCancelling(false)}
        />
      ) : null}
    </>
  );
}
