'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { apiDownload, apiRequest, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { BatchItem, PayoutBatch } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ConfirmPayoutDialog } from '@/components/ConfirmPayoutDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
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
  {
    key: 'status',
    header: 'Status',
    render: (i) => (
      <>
        <StatusBadge status={i.status} />
        {i.onHold && i.status === 'pending' ? <div className="sub">On hold: deactivated by ops</div> : null}
        {!i.onHold && i.excludedFromExport && i.status === 'pending' ? (
          <div className="sub">Left out of a CSV download: confirm whether it was paid</div>
        ) : null}
      </>
    ),
  },
];

export default function PayoutBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Set by the payouts page when batch creation left out affiliates whose payouts are on hold.
  // Read once, then removed from the URL so a refresh or a shared link doesn't show a stale count.
  const searchParams = useSearchParams();
  const router = useRouter();
  const [skippedOnHold] = useState(() => Number(searchParams.get('onHold') ?? 0));
  useEffect(() => {
    if (searchParams.has('onHold')) router.replace(`/payouts/${encodeURIComponent(id)}`, { scroll: false });
  }, [searchParams, router, id]);

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
  const heldItems = isOpen ? items.filter((i) => i.onHold && i.status === 'pending') : [];
  const heldNames = heldItems.map((i) => i.affiliate.name ?? i.affiliate.id).join(', ');

  return (
    <>
      <Link href="/payouts" className="back-link">
        <Icon name="arrowLeft" size={14} />
        All payouts
      </Link>
      <PageHeader
        title={`Payout ${batch.batchNo}`}
        eyebrow="Payouts"
        subtitle={<StatusBadge status={batch.status} />}
        actions={
          isOpen ? (
            <>
              {batch.status === 'draft' ? (
                <button type="button" className="btn btn-danger" onClick={() => setCancelling(true)}>
                  <Icon name="x" size={16} />
                  Cancel batch
                </button>
              ) : null}
              <button type="button" className="btn" onClick={download} disabled={downloading}>
                <Icon name="download" size={16} />
                {downloading ? 'Preparing…' : batch.status === 'draft' ? 'Download CSV' : 'Download CSV again'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirming(true)}
                disabled={batch.status !== 'exported'}
                title={batch.status !== 'exported' ? 'Download the CSV and send the payments first' : undefined}
              >
                <Icon name="check" size={16} />
                Confirm payment
              </button>
            </>
          ) : null
        }
      />
      {skippedOnHold > 0 ? (
        <Notice tone="info">
          {skippedOnHold} affiliate(s) with approved earnings were left out because their payouts are on hold (deactivated by ops).
        </Notice>
      ) : null}
      {heldItems.length > 0 ? (
        <Notice tone="warning">
          {batch.status === 'draft'
            ? `Payouts are now on hold for ${heldNames}. Cancel this draft and create a new batch; held affiliates are left out automatically.`
            : `Payouts are now on hold for ${heldNames}. If their transfer hasn't gone out yet, don't send it. When you confirm, say whether the bank already paid them. A re-downloaded CSV leaves them out.`}
        </Notice>
      ) : null}
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
        <StatCard label="Batch total" value={formatPaise(batch.originalTotalPaise)} icon="layers" variant={0} />
        <StatCard label="Paid" value={formatPaise(batch.paidPaise)} icon="check" variant={1} />
        <StatCard label="Failed" value={formatPaise(batch.failedPaise)} icon="alert" variant={2} />
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

      {confirming ? (
        <ConfirmPayoutDialog batch={batch} onClose={() => setConfirming(false)} onConfirmed={reload} onRefresh={reload} />
      ) : null}
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
