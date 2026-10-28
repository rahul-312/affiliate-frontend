'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, humanize } from '@/lib/format';
import { formatBps } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Paginated, User, UserStatus } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { RateDialog } from '@/components/RateDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusTabs } from '@/components/StatusTabs';

const STATUSES: readonly UserStatus[] = ['pending', 'active', 'deactivated', 'rejected'];

type PendingAction = { kind: 'approve' | 'reject' | 'rate' | 'deactivate' | 'reactivate'; affiliate: User };

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
  const [chosenStatus, setStatus] = useState<UserStatus | 'all' | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Open on Pending only when there are applications to review; otherwise show everyone.
  const pendingCheck = useApi('affiliates:pending-count', () =>
    apiRequest<Paginated<User>>('/admin/affiliates', { query: { status: 'pending', limit: 1 } }),
  );
  const defaultStatus = pendingCheck.data ? (pendingCheck.data.total > 0 ? 'pending' : 'all') : pendingCheck.error ? 'all' : null;
  const status = chosenStatus ?? defaultStatus;

  const { data, error, loading, reload } = useApi(`affiliates:${status ?? 'deciding'}`, () =>
    status === null
      ? Promise.resolve(null)
      : apiRequest<Paginated<User>>('/admin/affiliates', { query: { status: status === 'all' ? undefined : status, limit: 100 } }),
  );

  // The standard rate: the default when approving, and the rate for affiliates approved before per-affiliate rates.
  const program = useApi('program', () => apiRequest<{ rateBps: number }>('/program'));
  const standardBps = program.data?.rateBps ?? null;
  const rateOf = (a: User) => a.commissionRateBps ?? standardBps;

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
    {
      key: 'rate',
      header: 'Rate',
      render: (a) => {
        if (a.status === 'pending') return <span className="sub">Set at approval</span>;
        const bps = rateOf(a);
        return (a.status === 'active' || a.status === 'deactivated') && bps !== null ? formatBps(bps) : '—';
      },
    },
    { key: 'payout', header: 'Payout details', render: (a) => a.payoutMethod?.masked ?? <span className="sub">Not added</span> },
    { key: 'applied', header: 'Applied', render: (a) => formatDate(a.createdAt) },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <>
          <StatusBadge status={a.status} />
          {a.rejectionReason ? <div className="sub">{a.rejectionReason}</div> : null}
          {a.status === 'deactivated' ? (
            <div className="sub">
              {a.deactivatedBy === 'affiliate' ? 'Paused by the affiliate' : 'Deactivated by ops'}
              {a.deactivationReason ? `: ${a.deactivationReason}` : ''}
            </div>
          ) : null}
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
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setAction({ kind: 'approve', affiliate: a })}
              disabled={standardBps === null}
              title={standardBps === null ? 'Loading the standard rate…' : undefined}
            >
              <Icon name="check" size={14} />
              Approve
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setAction({ kind: 'reject', affiliate: a })}>
              <Icon name="x" size={14} />
              Reject
            </button>
          </div>
        ) : a.status === 'active' ? (
          <div className="row-actions">
            {rateOf(a) !== null ? (
              <button type="button" className="btn btn-sm" onClick={() => setAction({ kind: 'rate', affiliate: a })}>
                Edit rate
              </button>
            ) : null}
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setAction({ kind: 'deactivate', affiliate: a })}>
              Deactivate
            </button>
          </div>
        ) : a.status === 'deactivated' ? (
          <div className="row-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setAction({ kind: 'reactivate', affiliate: a })}>
              <Icon name="refresh" size={14} />
              Reactivate
            </button>
          </div>
        ) : null,
    });
  }

  const reject = async (affiliate: User, reason: string) => {
    await apiRequest(`/admin/affiliates/${affiliate.id}/reject`, { method: 'POST', body: { reason } });
    setMessage(`${affiliate.name}'s application was rejected.`);
    await reload();
  };

  const approve = async (affiliate: User, rateBps: number) => {
    await apiRequest(`/admin/affiliates/${affiliate.id}/approve`, { method: 'POST', body: { rateBps } });
    setMessage(`${affiliate.name} is approved at ${formatBps(rateBps)}. Their referral link is now live.`);
    await reload();
  };

  const setActive = async (affiliate: User, active: boolean, reason?: string) => {
    await apiRequest(`/admin/affiliates/${affiliate.id}/${active ? 'reactivate' : 'deactivate'}`, {
      method: 'POST',
      body: active ? {} : { reason },
    });
    setMessage(
      active
        ? `${affiliate.name} is active again. Their referral link is live.`
        : `${affiliate.name} is deactivated. Their link is off and new sales won't earn commission.`,
    );
    await reload();
  };

  const changeRate = async (affiliate: User, rateBps: number) => {
    await apiRequest(`/admin/affiliates/${affiliate.id}/rate`, { method: 'PATCH', body: { rateBps } });
    setMessage(`${affiliate.name}'s rate is now ${formatBps(rateBps)} for new sales.`);
    await reload();
  };

  return (
    <>
      <PageHeader title="Affiliates" subtitle={isOps ? 'Review applications. Approval activates the referral link.' : 'Read-only view of the affiliate roster.'} />
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {status !== null ? <StatusTabs label="Filter by status" options={STATUSES} value={status} onChange={setStatus} /> : null}
      <div className="card">
        <DataTable
          columns={columns}
          rows={data?.items ?? null}
          rowKey={(a) => a.id}
          loading={loading || status === null}
          emptyMessage={status === 'pending' ? 'No applications waiting.' : 'No affiliates in this view.'}
        />
      </div>

      {action?.kind === 'reject' ? (
        <ConfirmDialog
          title={`Reject ${action.affiliate.name}?`}
          description="They will see this reason in the app."
          confirmLabel="Reject application"
          danger
          reasonLabel="Reason"
          reasonRequired
          onConfirm={(reason) => reject(action.affiliate, reason)}
          onClose={() => setAction(null)}
        />
      ) : null}
      {action?.kind === 'deactivate' ? (
        <ConfirmDialog
          title={`Deactivate ${action.affiliate.name}?`}
          description="Their referral link stops working and new sales won't earn commission. Commissions already earned can still be approved and paid. They'll see the reason in the app and can't undo this themselves."
          confirmLabel="Deactivate"
          danger
          reasonLabel="Reason"
          reasonRequired
          onConfirm={(reason) => setActive(action.affiliate, false, reason)}
          onClose={() => setAction(null)}
        />
      ) : null}
      {action?.kind === 'reactivate' ? (
        <ConfirmDialog
          title={`Reactivate ${action.affiliate.name}?`}
          description={`Their referral link goes live again${
            rateOf(action.affiliate) !== null ? ` at their ${formatBps(rateOf(action.affiliate) as number)} rate` : ''
          }.`}
          confirmLabel="Reactivate"
          onConfirm={() => setActive(action.affiliate, true)}
          onClose={() => setAction(null)}
        />
      ) : null}
      {action?.kind === 'approve' && standardBps !== null ? (
        <RateDialog
          title={`Approve ${action.affiliate.name}?`}
          description={`Their referral link goes live immediately and sales start earning commission. The standard rate is ${formatBps(standardBps)}.`}
          confirmLabel="Approve"
          initialBps={standardBps}
          onConfirm={(rateBps) => approve(action.affiliate, rateBps)}
          onClose={() => setAction(null)}
        />
      ) : null}
      {action?.kind === 'rate' && rateOf(action.affiliate) !== null ? (
        <RateDialog
          title={`Change ${action.affiliate.name}'s rate`}
          description={`Currently ${formatBps(rateOf(action.affiliate) as number)}.`}
          confirmLabel="Save rate"
          initialBps={rateOf(action.affiliate) as number}
          onConfirm={(rateBps) => changeRate(action.affiliate, rateBps)}
          onClose={() => setAction(null)}
        />
      ) : null}
    </>
  );
}
