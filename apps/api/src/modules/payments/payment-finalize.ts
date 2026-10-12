import { PaymentIntentStatus } from '../../common/enums';

export const PAYMENT_FINALIZABLE_STATUSES: readonly PaymentIntentStatus[] = [
  PaymentIntentStatus.Created,
  PaymentIntentStatus.Initializing,
  PaymentIntentStatus.Pending,
];

export const PAYMENT_UNMATCHED_CLAIM_STATUSES: readonly PaymentIntentStatus[] = [
  PaymentIntentStatus.Superseded,
];

export type PaymentFinalizeDecision =
  | 'already-succeeded'
  | 'reject-terminal'
  | 'reject-expired'
  | 'claim'
  | 'claim-unmatched';

export interface PaymentFinalizeSnapshot {
  status: PaymentIntentStatus;
  expiresAt?: Date | null;
}

export function isPaymentExpired(
  intent: Pick<PaymentFinalizeSnapshot, 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  if (!intent.expiresAt) return false;
  return intent.expiresAt.getTime() <= now.getTime();
}

export function decidePaymentFinalize(
  intent: PaymentFinalizeSnapshot,
  now: Date = new Date(),
): PaymentFinalizeDecision {
  if (intent.status === PaymentIntentStatus.Succeeded) {
    return 'already-succeeded';
  }
  if (
    intent.status === PaymentIntentStatus.Failed ||
    intent.status === PaymentIntentStatus.Expired ||
    intent.status === PaymentIntentStatus.Unmatched
  ) {
    return 'reject-terminal';
  }
  if (intent.status === PaymentIntentStatus.Superseded) {
    return 'claim-unmatched';
  }
  if (isPaymentExpired(intent, now)) {
    return 'reject-expired';
  }
  if (
    intent.status === PaymentIntentStatus.Created ||
    intent.status === PaymentIntentStatus.Initializing ||
    intent.status === PaymentIntentStatus.Pending
  ) {
    return 'claim';
  }
  return 'reject-terminal';
}

/** Mongo filter: only one worker can move Created/Pending → Succeeded. */
export function paymentSuccessClaimFilter(
  id: unknown,
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    _id: id,
    status: { $in: [...PAYMENT_FINALIZABLE_STATUSES] },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  };
}

/**
 * In-memory CAS used by tests to prove webhook + poll cannot both settle.
 * Returns the winner snapshot, or null if the claim lost.
 */
export function claimPaymentSuccessInMemory<
  T extends PaymentFinalizeSnapshot & { id: string },
>(store: Map<string, T>, id: string, now: Date = new Date()): T | null {
  const current = store.get(id);
  if (!current) return null;
  const decision = decidePaymentFinalize(current, now);
  if (decision !== 'claim' && decision !== 'claim-unmatched') {
    return null;
  }
  const won = {
    ...current,
    status: PaymentIntentStatus.Succeeded,
    settlementState:
      decision === 'claim-unmatched' ? ('unmatched' as const) : ('pending' as const),
    expiresAt: undefined,
  };
  store.set(id, won);
  return won;
}

/** Mongo filter: superseded late success claims unmatched recon, not order settle. */
export function paymentUnmatchedClaimFilter(id: unknown): Record<string, unknown> {
  return {
    _id: id,
    status: { $in: [...PAYMENT_UNMATCHED_CLAIM_STATUSES] },
  };
}

export function walletTopupIdempotencyKey(intentId: string): string {
  return `topup:${intentId}`;
}
