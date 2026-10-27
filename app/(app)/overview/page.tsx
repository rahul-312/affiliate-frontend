'use client';

import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { OverviewStats } from '@/lib/types';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <div className="card-body">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
  return <div className="card">{href ? <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>{body}</Link> : body}</div>;
}

export default function OverviewPage() {
  const { role } = useAuth();
  const { data, error, loading, reload } = useApi('stats', () => apiRequest<OverviewStats>('/admin/stats'));

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Where the program stands right now."
        actions={
          <button type="button" className="btn" onClick={reload} disabled={loading}>
            Refresh
          </button>
        }
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <div className="stats">
            <Stat label="New applications" value={String(data.newApplications)} hint="Affiliates waiting for review" href="/affiliates" />
            <Stat
              label="Pending commissions"
              value={formatPaise(data.pendingCommissions.amountPaise)}
              hint={`${data.pendingCommissions.count} awaiting review`}
              href="/commissions"
            />
            <Stat
              label="Approved, not yet paid"
              value={formatPaise(data.approvedUnpaid.totalPaise)}
              hint={`${formatPaise(data.approvedUnpaid.processingPaise)} in an open payout`}
            />
            <Stat label="Paid this month" value={formatPaise(data.paidThisMonthPaise)} hint="Confirmed with a payment reference" />
          </div>

          {role === 'finance' ? (
            <div className="card">
              <div className="card-body">
                <h2 style={{ marginBottom: 8 }}>Next payout run</h2>
                {data.openBatch ? (
                  <p style={{ margin: 0 }}>
                    <Link href={`/payouts/${data.openBatch.id}`}>{data.openBatch.batchNo}</Link> is open (<StatusBadge status={data.openBatch.status} />) for{' '}
                    {formatPaise(data.openBatch.originalTotalPaise)}. Finish or cancel it before creating another.
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    {formatPaise(data.readyForPayoutPaise)} is ready to batch.{' '}
                    {data.missingPayoutDetailsCount > 0
                      ? `${data.missingPayoutDetailsCount} affiliate(s) can't be paid yet because they haven't added payout details.`
                      : null}{' '}
                    <Link href="/payouts">Go to payouts →</Link>
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
