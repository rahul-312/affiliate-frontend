'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { formatBps, formatPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Commission, CommissionStatus, Paginated } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { PageHeader } from '@/components/PageHeader';
import { SimulateSaleModal } from '@/components/SimulateSaleModal';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusTabs } from '@/components/StatusTabs';

const STATUSES: readonly CommissionStatus[] = ['pending', 'approved', 'processing', 'paid', 'rejected'];

type Decision = { kind: 'approve' | 'reject'; ids: string[] };

export default function CommissionsPage() {
  const { role } = useAuth();
  const isOps = role === 'ops';
  const [status, setStatus] = useState<CommissionStatus | 'all'>(isOps ? 'pending' : 'approved');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<Decision | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data, error, loading, reload } = useApi(
    `commissions:${status}`,
    () => apiRequest<Paginated<Commission>>('/admin/commissions', { query: { status: status === 'all' ? undefined : status, limit: 200 } }),
  );

  const rows = data?.items ?? null;
  const selectable = (rows ?? []).filter((c) => c.status === 'pending');
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id));

  const changeStatus = (next: CommissionStatus | 'all') => {
    setStatus(next);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const decide = async (reason: string) => {
    if (!decision) return;
    const { kind, ids } = decision;
    await apiRequest(`/admin/commissions/${kind}`, { method: 'POST', body: kind === 'reject' ? { ids, reason } : { ids } });
    setMessage(`${ids.length} commission(s) ${kind === 'approve' ? 'approved' : 'rejected'}.`);
    setSelected(new Set());
    await reload();
  };

  const columns: Column<Commission>[] = [];
  if (isOps) {
    columns.push({
      key: 'select',
      header: (
        <input
          type="checkbox"
          aria-label="Select all pending"
          checked={allSelected}
          disabled={selectable.length === 0}
          onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c.id)))}
        />
      ),
      render: (c) =>
        c.status === 'pending' ? (
          <input type="checkbox" aria-label="Select commission" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
        ) : null,
    });
  }
  columns.push(
    {
      key: 'affiliate',
      header: 'Affiliate',
      render: (c) => (
        <>
          <div>
            <strong>{c.affiliate.name}</strong>
          </div>
          <div className="sub">
            <code>{c.affiliate.referralCode}</code>
          </div>
        </>
      ),
    },
    { key: 'order', header: 'Order', numeric: true, render: (c) => formatPaise(c.orderAmountPaise) },
    { key: 'rate', header: 'Rate', numeric: true, render: (c) => formatBps(c.rateBps) },
    { key: 'amount', header: 'Commission', numeric: true, render: (c) => <strong>{formatPaise(c.amountPaise)}</strong> },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <>
          <StatusBadge status={c.status} /> {c.retried ? <span className="badge badge-warning">Retry</span> : null}
          {c.rejectionReason ? <div className="sub">{c.rejectionReason}</div> : null}
          {c.retryNote ? <div className="sub">{c.retryNote}</div> : null}
        </>
      ),
    },
    { key: 'created', header: 'Recorded', render: (c) => <span className="sub">{formatDateTime(c.createdAt)}</span> },
  );

  if (isOps) {
    columns.push({
      key: 'actions',
      header: '',
      render: (c) =>
        c.status === 'pending' ? (
          <div className="row-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setDecision({ kind: 'approve', ids: [c.id] })}>
              <Icon name="check" size={14} />
              Approve
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setDecision({ kind: 'reject', ids: [c.id] })}>
              <Icon name="x" size={14} />
              Reject
            </button>
          </div>
        ) : null,
    });
  }

  return (
    <>
      <PageHeader
        title="Commissions"
        subtitle={isOps ? 'Every sale creates a pending commission. Approve it to make it payable.' : 'Read-only. Approved commissions are picked up by the next payout batch.'}
        actions={
          isOps ? (
            <button type="button" className="btn" onClick={() => setSimulating(true)}>
              <Icon name="plus" size={16} />
              Simulate sale
            </button>
          ) : null
        }
      />
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <StatusTabs label="Filter by status" options={STATUSES} value={status} onChange={changeStatus} />
      <div className="card">
        {isOps && selected.size > 0 ? (
          <div className="toolbar">
            <strong>{selected.size} selected</strong>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setDecision({ kind: 'approve', ids: [...selected] })}>
              Approve selected
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setDecision({ kind: 'reject', ids: [...selected] })}>
              Reject selected
            </button>
          </div>
        ) : null}
        <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} loading={loading} emptyMessage="No commissions in this view." />
      </div>

      {decision ? (
        <ConfirmDialog
          title={`${decision.kind === 'approve' ? 'Approve' : 'Reject'} ${decision.ids.length} commission(s)?`}
          description={
            decision.kind === 'approve'
              ? 'Approved commissions become payable and are included in the next payout batch.'
              : 'Rejected commissions are never paid. The reason is kept in the history.'
          }
          confirmLabel={decision.kind === 'approve' ? 'Approve' : 'Reject'}
          danger={decision.kind === 'reject'}
          reasonLabel={decision.kind === 'reject' ? 'Reason' : undefined}
          reasonRequired={decision.kind === 'reject'}
          onConfirm={decide}
          onClose={() => setDecision(null)}
        />
      ) : null}
      {simulating ? <SimulateSaleModal onClose={() => setSimulating(false)} onRecorded={reload} /> : null}
    </>
  );
}
