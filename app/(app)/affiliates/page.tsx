'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, humanize } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import type { Paginated, User, UserStatus } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusTabs } from '@/components/StatusTabs';

const STATUSES: readonly UserStatus[] = ['pending', 'active', 'rejected'];

type PendingAction = { kind: 'approve' | 'reject'; affiliate: User };

/** Only http(s) links are rendered as links; anything else is shown as text. */
function SafeLink({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  const isHttp = /^https?:\/\//i.test(url);
  return isHttp ? (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow">
      {url.replace(/^https?:\/\//i, '').slice(0, 40)}
    </a>
  ) : (
    <span className="sub">{url}</span>
  );
}

export default function AffiliatesPage() {
  const { role } = useAuth();
  const isOps = role === 'ops';
  const [status, setStatus] = useState<UserStatus | 'all'>('pending');
  const [action, setAction] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data, error, loading, reload } = useApi(
    `affiliates:${status}`,
    () => apiRequest<Paginated<User>>('/admin/affiliates', { query: { status: status === 'all' ? undefined : status, limit: 100 } }),
  );

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Affiliate',
      render: (a) => (
        <>
          <div>
            <strong>{a.name}</strong>
          </div>
          <div className="sub">{a.email}</div>
        </>
      ),
    },
    {
      key: 'channel',
      header: 'Promotes on',
      render: (a) => (
        <>
          <div>{a.promotionChannel ? humanize(a.promotionChannel) : '—'}</div>
          <SafeLink url={a.promotionUrl} />
        </>
      ),
    },
    { key: 'code', header: 'Referral code', render: (a) => <code>{a.referralCode}</code> },
    { key: 'payout', header: 'Payout details', render: (a) => a.payoutMethod?.masked ?? <span className="sub">Not added</span> },
    { key: 'applied', header: 'Applied', render: (a) => formatDate(a.createdAt) },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <>
          <StatusBadge status={a.status} />
          {a.rejectionReason ? <div className="sub">{a.rejectionReason}</div> : null}
        </>
      ),
    },
  ];

  if (isOps) {
    columns.push({
      key: 'actions',
      header: '',
      render: (a) =>
        a.status === 'pending' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setAction({ kind: 'approve', affiliate: a })}>
              Approve
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setAction({ kind: 'reject', affiliate: a })}>
              Reject
            </button>
          </div>
        ) : null,
    });
  }

  const decide = async (reason: string) => {
    if (!action) return;
    const { kind, affiliate } = action;
    await apiRequest(`/admin/affiliates/${affiliate.id}/${kind}`, { method: 'POST', body: kind === 'reject' ? { reason } : undefined });
    setMessage(kind === 'approve' ? `${affiliate.name} is approved. Their referral link is now live.` : `${affiliate.name}'s application was rejected.`);
    await reload();
  };

  return (
    <>
      <PageHeader title="Affiliates" subtitle={isOps ? 'Review applications. Approval activates the referral link.' : 'Read-only view of the affiliate roster.'} />
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <StatusTabs label="Filter by status" options={STATUSES} value={status} onChange={setStatus} />
      <div className="card">
        <DataTable
          columns={columns}
          rows={data?.items ?? null}
          rowKey={(a) => a.id}
          loading={loading}
          emptyMessage={status === 'pending' ? 'No applications waiting. 🎉' : 'No affiliates in this view.'}
        />
      </div>

      {action ? (
        <ConfirmDialog
          title={action.kind === 'approve' ? `Approve ${action.affiliate.name}?` : `Reject ${action.affiliate.name}?`}
          description={
            action.kind === 'approve'
              ? 'Their referral link goes live immediately and sales start earning commission.'
              : 'They will see this reason in the app.'
          }
          confirmLabel={action.kind === 'approve' ? 'Approve' : 'Reject application'}
          danger={action.kind === 'reject'}
          reasonLabel={action.kind === 'reject' ? 'Reason' : undefined}
          reasonRequired={action.kind === 'reject'}
          onConfirm={decide}
          onClose={() => setAction(null)}
        />
      ) : null}
    </>
  );
}
