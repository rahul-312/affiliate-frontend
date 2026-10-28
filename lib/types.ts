/** Response shapes of the affiliate-backend API. Amounts are integer paise, rates integer basis points. */

export type Role = 'affiliate' | 'ops' | 'finance';
export type StaffRole = Exclude<Role, 'affiliate'>;
export type UserStatus = 'pending' | 'active' | 'rejected' | 'deactivated';
export type CommissionStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'paid';
export type BatchStatus = 'draft' | 'exported' | 'paid' | 'closed_with_failures' | 'cancelled';
export type BatchItemStatus = 'pending' | 'paid' | 'failed';

export interface PayoutMethodSummary {
  type: 'upi' | 'bank';
  masked: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  promotionChannel?: string | null;
  promotionUrl?: string | null;
  rejectionReason?: string | null;
  deactivationReason?: string | null;
  /** Who paused the account: the affiliate themselves or ops. */
  deactivatedBy?: 'affiliate' | 'ops' | null;
  approvedAt?: string | null;
  /** Set at approval; null for pending affiliates and for those approved before per-affiliate rates. */
  commissionRateBps?: number | null;
  referralCode?: string | null;
  referralLinkActive?: boolean;
  referralLink?: string | null;
  payoutMethod?: PayoutMethodSummary | null;
}

export interface AffiliateRef {
  id: string;
  name?: string;
  email?: string;
  referralCode?: string | null;
}

export interface Commission {
  id: string;
  affiliate: AffiliateRef;
  conversionId: string;
  orderAmountPaise: number;
  rateBps: number;
  amountPaise: number;
  status: CommissionStatus;
  rejectionReason: string | null;
  payoutBatchId: string | null;
  retried: boolean;
  retryNote: string | null;
  createdAt: string;
}

export interface BatchItem {
  affiliate: AffiliateRef;
  amountPaise: number;
  commissionCount: number;
  status: BatchItemStatus;
  failureReason: string | null;
  /** Ops deactivated this affiliate after the batch was created: don't pay them from this batch. */
  onHold?: boolean;
  /** A CSV download left this affiliate out (they were on hold then); confirm must say whether they were paid. */
  excludedFromExport?: boolean;
}

export interface PayoutBatch {
  id: string;
  batchNo: string;
  status: BatchStatus;
  originalTotalPaise: number;
  paidPaise: number | null;
  failedPaise: number | null;
  itemCount: number;
  failedItemCount: number;
  paymentReference: string | null;
  createdAt: string;
  exportedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items?: BatchItem[];
}

export interface PayoutCandidate {
  affiliateId: string;
  name: string;
  email: string | null;
  amountPaise: number;
  commissionCount: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface OverviewStats {
  newApplications: number;
  pendingCommissions: { count: number; amountPaise: number };
  approvedUnpaid: { approvedPaise: number; processingPaise: number; totalPaise: number };
  paidThisMonthPaise: number;
  readyForPayoutPaise: number;
  missingPayoutDetailsCount: number;
  /** Approved earnings held because ops deactivated the affiliate. */
  onHold: { count: number; amountPaise: number };
  openBatch: { id: string; batchNo: string; status: BatchStatus; originalTotalPaise: number } | null;
}

export interface ConversionResult {
  created: boolean;
  conversion: { id: string; orderId: string; referralCode: string; orderAmountPaise: number; source: string };
  commission: { id: string; status: CommissionStatus; rateBps: number; amountPaise: number } | null;
}
