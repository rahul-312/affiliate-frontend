'use client';

import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { OverviewStats } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';

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
            <Icon name="refresh" size={16} />
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
            <StatCard
              label="New applications"
              value={String(data.newApplications)}
              hint="Affiliates waiting for review"
              href="/affiliates"
              icon="file"
              variant={0}
            />
            <StatCard
              label="Pending commissions"
              value={formatPaise(data.pendingCommissions.amountPaise)}
              hint={`${data.pendingCommissions.count} awaiting review`}
              href="/commissions"
              icon="clock"
              variant={1}
            />
            <StatCard
              label="Approved, not yet paid"
              value={formatPaise(data.approvedUnpaid.totalPaise)}
              hint={`${formatPaise(data.approvedUnpaid.processingPaise)} in an open payout`}
              icon="wallet"
              variant={2}
            />
            <StatCard
              label="Paid this month"
              value={formatPaise(data.paidThisMonthPaise)}
              hint="Confirmed with a payment reference"
              icon="chart"
              variant={3}
            />
          </div>

          {role === 'finance' ? (
            <div className="card feature-card">
              <span className="icon-chip">
                <Icon name="layers" />
              </span>
              <div>
                <h2>Next payout run</h2>
                {data.openBatch ? (
                  <p>
                    <Link href={`/payouts/${data.openBatch.id}`}>{data.openBatch.batchNo}</Link> is open (<StatusBadge status={data.openBatch.status} />) for{' '}
                    {formatPaise(data.openBatch.originalTotalPaise)}. Finish or cancel it before creating another.
                  </p>
                ) : (
                  <p>
                    {formatPaise(data.readyForPayoutPaise)} is ready to batch.{' '}
                    {data.missingPayoutDetailsCount > 0
                      ? `${data.missingPayoutDetailsCount} affiliate(s) can't be paid yet because they haven't added payout details.`
                      : null}{' '}
                    <Link href="/payouts" className="inline-arrow">
                      Go to payouts <Icon name="arrowRight" size={14} />
                    </Link>
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
