import { PaymentIntentStatus } from '../../common/enums';

export const SETTLEMENT_PENDING = 'pending';
export const SETTLEMENT_APPLIED = 'applied';
export const SETTLEMENT_UNMATCHED = 'unmatched';
export const SETTLEMENT_UNMATCHED_APPLIED = 'unmatched_applied';
export const SETTLEMENT_UNMATCHED_MANUAL = 'unmatched_manual';

export type PaymentSettlementState =
  | typeof SETTLEMENT_PENDING
  | typeof SETTLEMENT_APPLIED
  | typeof SETTLEMENT_UNMATCHED
  | typeof SETTLEMENT_UNMATCHED_APPLIED
  | typeof SETTLEMENT_UNMATCHED_MANUAL;

export const SETTLEMENT_TERMINAL_STATES: readonly PaymentSettlementState[] = [
  SETTLEMENT_APPLIED,
  SETTLEMENT_UNMATCHED_APPLIED,
  SETTLEMENT_UNMATCHED_MANUAL,
];

export function needsSettlementApply(intent: {
  status: PaymentIntentStatus;
  settlementState?: string | null;
}): boolean {
  return (
    intent.status === PaymentIntentStatus.Succeeded &&
    intent.settlementState !== SETTLEMENT_APPLIED &&
    intent.settlementState !== SETTLEMENT_UNMATCHED_APPLIED &&
    intent.settlementState !== SETTLEMENT_UNMATCHED_MANUAL
  );
}

/** Atomic lease so webhook + poll + cron cannot apply side effects twice. */
export function settlementLeaseFilter(
  id: unknown,
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    _id: id,
    status: PaymentIntentStatus.Succeeded,
    settlementState: {
      $nin: [
        SETTLEMENT_APPLIED,
        SETTLEMENT_UNMATCHED_APPLIED,
        SETTLEMENT_UNMATCHED_MANUAL,
      ],
    },
    $or: [
      { settlementLeaseUntil: { $exists: false } },
      { settlementLeaseUntil: null },
      { settlementLeaseUntil: { $lte: now } },
    ],
  };
}

export const SETTLEMENT_LEASE_MS = 30_000;
