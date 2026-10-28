'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, humanize } from '@/lib/format';
import { formatBps } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import { useFocusedList } from '@/lib/useFocusedList';
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
  const [action, setAction] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Opens on Pending only when there are applications to review; otherwise on All.
  const { status, setStatus, data, error, loading, reload, focusCheckFailed } = useFocusedList<UserStatus, User>({
    name: 'affiliates',
    focus: 'pending',
    fetchList: (s) => apiRequest<Paginated<User>>('/admin/affiliates', { query: { status: s === 'all' ? undefined : s, limit: 100 } }),
  });

  // The standard rate: the default when approving, and the rate for affiliates approved before per-affiliate rates.
  // Approving doesn't depend on it: without it the dialog starts empty and the server applies the standard rate.
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
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setAction({ kind: 'approve', affiliate: a })}>
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
            {rateOf(a) !== null ? (
              <button type="button" className="btn btn-sm" onClick={() => setAction({ kind: 'rate', affiliate: a })}>
                Edit rate
              </button>
            ) : null}
            {/* Ops can take over a self-pause so the affiliate can't resume it, e.g. when a review starts. */}
            {a.deactivatedBy === 'affiliate' ? (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setAction({ kind: 'deactivate', affiliate: a })}>
                Deactivate
              </button>
            ) : null}
          </div>
        ) : null,
    });
  }

  const reject = async (affiliate: User, reason: string) => {
    await apiRequest(`/admin/affiliates/${affiliate.id}/reject`, { method: 'POST', body: { reason } });
    setMessage(`${affiliate.name}'s application was rejected.`);
    await reload();
  };

  const approve = async (affiliate: User, rateBps: number | null) => {
    const approved = await apiRequest<User>(`/admin/affiliates/${affiliate.id}/approve`, {
      method: 'POST',
      body: rateBps === null ? {} : { rateBps },
    });
    const rate = approved.commissionRateBps ?? rateBps;
    setMessage(`${affiliate.name} is approved${rate !== null ? ` at ${formatBps(rate)}` : ''}. Their referral link is now live.`);
    await reload();
  };

  const setActive = async (affiliate: User, active: boolean, text: string) => {
    await apiRequest(`/admin/affiliates/${affiliate.id}/${active ? 'reactivate' : 'deactivate'}`, {
      method: 'POST',
      body: active ? (text ? { note: text } : {}) : { reason: text },
    });
    setMessage(
      active
        ? `${affiliate.name} is active again. Their referral link is live.`
        : `${affiliate.name} is deactivated. Their link is off, new sales won't earn commission and their payouts are on hold.`,
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
      {isOps && program.error ? (
        <Notice tone="error">
          Couldn&apos;t load the standard rate, so the approval form starts empty (leaving it empty applies the standard rate).{' '}
          <button type="button" className="btn btn-sm" onClick={() => void program.reload()}>
            Try again
          </button>
        </Notice>
      ) : null}
      {focusCheckFailed ? <Notice tone="info">Couldn&apos;t check for pending applications, so this shows all affiliates.</Notice> : null}
      <StatusTabs label="Filter by status" options={STATUSES} value={status} onChange={setStatus} />
      <div className="card">
        <DataTable
          columns={columns}
          rows={data?.items ?? null}
          rowKey={(a) => a.id}
          loading={loading}
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
          description={
            action.affiliate.deactivatedBy === 'affiliate'
              ? 'They paused their account themselves. Deactivating it means only ops can bring it back, and holds their payouts until then. The affiliate sees this reason in the app, so keep internal notes out of it.'
              : "Their referral link stops working, new sales won't earn commission and their payouts are held until you reactivate them. Commissions can still be reviewed. The affiliate sees this reason in the app, so keep internal notes out of it."
          }
          confirmLabel="Deactivate"
          danger
          reasonLabel="Reason (shown to the affiliate)"
          reasonRequired
          onConfirm={(reason) => setActive(action.affiliate, false, reason)}
          onClose={() => setAction(null)}
        />
      ) : null}
      {action?.kind === 'reactivate' ? <ReactivateDialog affiliate={action.affiliate} rateBps={rateOf(action.affiliate)} onConfirm={(note) => setActive(action.affiliate, true, note)} onClose={() => setAction(null)} /> : null}
      {action?.kind === 'approve' ? (
        <RateDialog
          title={`Approve ${action.affiliate.name}?`}
          description={`Their referral link goes live immediately and sales start earning commission.${
            standardBps !== null ? ` The standard rate is ${formatBps(standardBps)}.` : ''
          }`}
          confirmLabel="Approve"
          initialBps={standardBps}
          allowEmpty
          onConfirm={(rateBps) => approve(action.affiliate, rateBps)}
          onClose={() => setAction(null)}
        />
      ) : null}
      {action?.kind === 'rate' ? <EditRateDialog affiliate={action.affiliate} rateBps={rateOf(action.affiliate)} onConfirm={(rateBps) => changeRate(action.affiliate, rateBps)} onClose={() => setAction(null)} /> : null}
    </>
  );
}

interface AffiliateDialogProps<V> {
  affiliate: User;
  /** The affiliate's effective rate, or null when it isn't known. */
  rateBps: number | null;
  onConfirm: (value: V) => Promise<void>;
  onClose: () => void;
}

function ReactivateDialog({ affiliate, rateBps, onConfirm, onClose }: AffiliateDialogProps<string>) {
  const selfPaused = affiliate.deactivatedBy === 'affiliate';
  const description = [
    selfPaused
      ? `${affiliate.name} paused their account themselves${affiliate.deactivationReason ? ` ("${affiliate.deactivationReason}")` : ''}. Reactivating overrides their choice, so consider checking with them first.`
      : null,
    `Their referral link goes live again${rateBps !== null ? ` at their ${formatBps(rateBps)} rate` : ''}${
      affiliate.deactivatedBy === 'ops' ? ', and their held payouts go out in the next payout run' : ''
    }.`,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <ConfirmDialog
      title={`Reactivate ${affiliate.name}?`}
      description={description}
      confirmLabel={selfPaused ? 'Reactivate anyway' : 'Reactivate'}
      reasonLabel="Note for the audit log"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

function EditRateDialog({ affiliate, rateBps, onConfirm, onClose }: AffiliateDialogProps<number>) {
  if (rateBps === null) return null;
  return (
    <RateDialog
      title={`Change ${affiliate.name}'s rate`}
      description={`Currently ${formatBps(rateBps)}.`}
      confirmLabel="Save rate"
      initialBps={rateBps}
      requireChange
      onConfirm={async (next) => {
        if (next !== null) await onConfirm(next);
      }}
      onClose={onClose}
    />
  );
}
