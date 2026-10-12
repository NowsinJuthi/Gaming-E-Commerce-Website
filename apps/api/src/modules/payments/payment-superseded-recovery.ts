import { PaymentIntentStatus } from '../../common/enums';

export const HISTORICAL_SUPERSEDED_ERROR = 'Superseded by a new checkout';

export type RecoverablePaymentRow = {
  id: string;
  status: PaymentIntentStatus;
  lastError?: string | null;
  gatewayRef?: string | null;
  chargeLeaseUntil?: Date | number | null;
};

export type SupersededRecoveryPlan = {
  reclaimIds: string[];
  skipIds: string[];
};

export function isHistoricalSupersededFailure(row: RecoverablePaymentRow): boolean {
  if (row.status !== PaymentIntentStatus.Failed) {
    return false;
  }
  if (row.lastError !== HISTORICAL_SUPERSEDED_ERROR) {
    return false;
  }
  return Boolean(row.gatewayRef || row.chargeLeaseUntil);
}

/**
 * Reclaim Failed leftovers that may still receive a late gateway capture.
 * Does not touch intents without a gateway reference (no money expected).
 */
export function planHistoricalSupersededRecovery(
  rows: RecoverablePaymentRow[],
): SupersededRecoveryPlan {
  const reclaimIds: string[] = [];
  const skipIds: string[] = [];
  for (const row of rows) {
    if (isHistoricalSupersededFailure(row)) {
      reclaimIds.push(row.id);
    } else {
      skipIds.push(row.id);
    }
  }
  return { reclaimIds, skipIds };
}

export function supersededRecoveryLogLine(plan: SupersededRecoveryPlan): string {
  return `superseded recovery reclaim=${plan.reclaimIds.length} skip=${plan.skipIds.length}`;
}
