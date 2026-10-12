export type ConfirmPaymentOutcome = 'claimed' | 'already-paid' | 'missing';

export type ConfirmPaymentResult = {
  outcome: ConfirmPaymentOutcome;
  payerIntentId?: string;
};

export type DuplicateSettlementDecision = 'apply' | 'unmatched' | 'retry';

/**
 * A second gateway success must not confirm an order that is already paid.
 * Our own settlement retry (same intent id on the order) is still apply.
 */
export function decideDuplicateOrderSettlement(input: {
  confirmOutcome: ConfirmPaymentOutcome;
  payerIntentId?: string;
  settlingIntentId: string;
}): DuplicateSettlementDecision {
  if (input.confirmOutcome === 'missing') {
    return 'retry';
  }
  if (input.confirmOutcome === 'claimed') {
    return 'apply';
  }
  if (
    input.payerIntentId &&
    input.payerIntentId === input.settlingIntentId
  ) {
    return 'apply';
  }
  return 'unmatched';
}

export function duplicateRefundIdempotencyKey(intentId: string): string {
  return `duprefund:${intentId}`;
}

export type DuplicateRefundChannel = 'gateway' | 'manual';

export type DuplicateRefundDecision =
  | 'already-applied'
  | 'gateway'
  | 'manual'
  | 'retry';

export type GatewayRefundAttempt = {
  supported: boolean;
  ok: boolean;
};

/**
 * Prefer an idempotent original-gateway refund. Wallet credit is never the
 * automatic path for a duplicate/superseded external capture.
 */
export function decideDuplicateRefund(input: {
  settlementState?: string | null;
  gatewayRefund: GatewayRefundAttempt;
}): DuplicateRefundDecision {
  if (
    input.settlementState === 'unmatched_applied' ||
    input.settlementState === 'unmatched_manual'
  ) {
    return 'already-applied';
  }
  if (input.gatewayRefund.supported && input.gatewayRefund.ok) {
    return 'gateway';
  }
  if (!input.gatewayRefund.supported) {
    return 'manual';
  }
  return 'retry';
}
