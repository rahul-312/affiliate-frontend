'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, apiRequest, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { formatPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Paginated, PayoutBatch, PayoutCandidate } from '@/lib/types';
import { DataTable, type Column } from '@/components/DataTable';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';

function batchSummary(batch: PayoutBatch) {
  if (batch.status === 'closed_with_failures') {
    return `Partially paid: ${formatPaise(batch.paidPaise)} of ${formatPaise(batch.originalTotalPaise)}, ${batch.failedItemCount} item(s) need another attempt`;
  }
  return null;
}

export default function PayoutsPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const batches = useApi('batches', () => apiRequest<Paginated<PayoutBatch>>('/admin/payouts', { query: { limit: 50 } }));
  const missing = useApi('missing-details', () =>
    apiRequest<{ minPayoutPaise: number; items: PayoutCandidate[] }>('/admin/payouts/missing-details'),
  );
  const openBatch = batches.data?.items.find((b) => b.status === 'draft' || b.status === 'exported');

  const createBatch = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await apiRequest<{ batch: PayoutBatch }>('/admin/payouts', { method: 'POST' });
      router.push(`/payouts/${result.batch.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NOTHING_TO_PAY') {
        const d = err.details as { skippedMissingDetails?: number; skippedBelowMinimum?: number; skippedOnHold?: number } | undefined;
        setCreateError(
          `No commissions are ready for payout. Skipped: ${d?.skippedMissingDetails ?? 0} affiliate(s) without payout details, ${d?.skippedBelowMinimum ?? 0} below the minimum${d?.skippedOnHold ? `, ${d.skippedOnHold} on hold (deactivated by ops)` : ''}.`,
        );
      } else {
        setCreateError(errorMessage(err));
      }
      setCreating(false);
    }
  };

  const batchColumns: Column<PayoutBatch>[] = [
    { key: 'no', header: 'Batch', render: (b) => <Link href={`/payouts/${b.id}`}>{b.batchNo}</Link> },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
        <>
          <StatusBadge status={b.status} />
          {batchSummary(b) ? <div className="sub">{batchSummary(b)}</div> : null}
        </>
      ),
    },
    { key: 'items', header: 'Affiliates', numeric: true, render: (b) => b.itemCount },
    { key: 'total', header: 'Total', numeric: true, render: (b) => formatPaise(b.originalTotalPaise) },
    { key: 'paid', header: 'Paid', numeric: true, render: (b) => formatPaise(b.paidPaise) },
    { key: 'ref', header: 'Reference', render: (b) => (b.paymentReference ? <code>{b.paymentReference}</code> : '—') },
    { key: 'created', header: 'Created', render: (b) => <span className="sub">{formatDateTime(b.createdAt)}</span> },
  ];

  const missingColumns: Column<PayoutCandidate>[] = [
    {
      key: 'who',
      header: 'Affiliate',
      render: (m) => (
        <>
          <strong>{m.name}</strong>
          <div className="sub">{m.email}</div>
        </>
      ),
    },
    { key: 'count', header: 'Commissions', numeric: true, render: (m) => m.commissionCount },
    { key: 'amount', header: 'Waiting', numeric: true, render: (m) => <strong>{formatPaise(m.amountPaise)}</strong> },
  ];

  return (
    <>
      <PageHeader
        title="Payouts"
        subtitle="Batch approved commissions, send the CSV to the bank, then confirm with the payment reference."
        actions={
          openBatch ? (
            <Link className="btn btn-primary" href={`/payouts/${openBatch.id}`}>
              <Icon name="arrowRight" size={16} />
              Continue {openBatch.batchNo}
            </Link>
          ) : (
            <button type="button" className="btn btn-primary" onClick={createBatch} disabled={creating}>
              <Icon name="plus" size={16} />
              {creating ? 'Creating…' : 'Create payout batch'}
            </button>
          )
        }
      />
      {createError ? <Notice tone="warning">{createError}</Notice> : null}
      {openBatch ? (
        <Notice tone="info">
          {openBatch.batchNo} is open ({openBatch.status}). Only one batch can be open at a time: confirm or cancel it first.
        </Notice>
      ) : null}
      {batches.error ? <Notice tone="error">{batches.error}</Notice> : null}

      <div className="card">
        <div className="section-title">
          <h2>
            <Icon name="alert" /> Owed but missing payout details
          </h2>
          <span className="sub">Skipped by batching until they add UPI or bank details in the app</span>
        </div>
        {missing.error ? <div className="card-body"><Notice tone="error">{missing.error}</Notice></div> : null}
        <DataTable
          columns={missingColumns}
          rows={missing.data?.items ?? null}
          rowKey={(m) => m.affiliateId}
          loading={missing.loading}
          emptyMessage="Everyone with approved earnings has payout details."
        />
      </div>

      <div className="card">
        <div className="section-title">
          <h2>
            <Icon name="layers" /> Batches
          </h2>
        </div>
        <DataTable columns={batchColumns} rows={batches.data?.items ?? null} rowKey={(b) => b.id} loading={batches.loading} emptyMessage="No payout batches yet." />
      </div>
    </>
  );
}
