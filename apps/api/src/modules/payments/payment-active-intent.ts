import { PaymentGateway, PaymentIntentStatus, PaymentPurpose } from '../../common/enums';

export const ACTIVE_ORDER_SLOT = 1;
export const ACTIVE_ORDER_INTENT_INDEX = 'uniq_active_order_payment_slot';

export const ACTIVE_ORDER_INTENT_STATUSES: readonly PaymentIntentStatus[] = [
  PaymentIntentStatus.Created,
  PaymentIntentStatus.Initializing,
  PaymentIntentStatus.Pending,
];

export type ActiveOrderCheckoutDecision =
  | 'reuse'
  | 'supersede'
  | 'forbidden'
  | 'none';

export function isActiveOrderIntentStatus(
  status: PaymentIntentStatus,
): boolean {
  return ACTIVE_ORDER_INTENT_STATUSES.includes(status);
}

export function activeOrderIntentFilter(orderId: unknown): Record<string, unknown> {
  return {
    orderId,
    purpose: PaymentPurpose.Order,
    status: { $in: [...ACTIVE_ORDER_INTENT_STATUSES] },
  };
}

export function settlingOrderIntentFilter(
  orderId: unknown,
): Record<string, unknown> {
  return {
    orderId,
    purpose: PaymentPurpose.Order,
    status: PaymentIntentStatus.Succeeded,
  };
}

export function classifyActiveOrderCheckout(
  existing: { userId: unknown; gateway: PaymentGateway } | null | undefined,
  actor: { userId: string; gateway: PaymentGateway },
): ActiveOrderCheckoutDecision {
  if (!existing) {
    return 'none';
  }
  if (String(existing.userId) !== actor.userId) {
    return 'forbidden';
  }
  if (existing.gateway === actor.gateway) {
    return 'reuse';
  }
  return 'supersede';
}

export type ActiveIntentRow = {
  id: string;
  orderId: string;
  userId: string;
  gateway: PaymentGateway;
  status: PaymentIntentStatus;
};

/**
 * In-memory CAS for the one-active-intent-per-order invariant used by tests.
 * Mongo enforces the same rule with a sparse unique (orderId, activeOrderSlot).
 */
export function claimActiveOrderIntentInMemory(
  store: Map<string, ActiveIntentRow>,
  input: Omit<ActiveIntentRow, 'status'>,
): {
  outcome: 'created' | 'reuse' | 'supersede' | 'forbidden' | 'blocked-settling';
  row?: ActiveIntentRow;
  previous?: ActiveIntentRow;
} {
  const current = store.get(input.orderId);
  if (!current) {
    const row: ActiveIntentRow = {
      ...input,
      status: PaymentIntentStatus.Created,
    };
    store.set(input.orderId, row);
    return { outcome: 'created', row };
  }
  if (current.status === PaymentIntentStatus.Succeeded) {
    return { outcome: 'blocked-settling', row: current };
  }
  if (!isActiveOrderIntentStatus(current.status)) {
    const row: ActiveIntentRow = {
      ...input,
      status: PaymentIntentStatus.Created,
    };
    store.set(input.orderId, row);
    return { outcome: 'created', row };
  }
  const decision = classifyActiveOrderCheckout(current, input);
  if (decision === 'forbidden') {
    return { outcome: 'forbidden', row: current };
  }
  if (decision === 'reuse') {
    return { outcome: 'reuse', row: current };
  }
  const previous = {
    ...current,
    status: supersedeReplacementStatus(current),
  };
  const row: ActiveIntentRow = {
    ...input,
    status: PaymentIntentStatus.Created,
  };
  store.set(input.orderId, row);
  return { outcome: 'supersede', previous, row };
}

export type DuplicateActiveIntentRow = {
  id: string;
  orderId: string;
  createdAt: number;
};

export function findDuplicateActiveOrderGroups(
  rows: DuplicateActiveIntentRow[],
): { orderId: string; intentIds: string[] }[] {
  const byOrder = new Map<string, DuplicateActiveIntentRow[]>();
  for (const row of rows) {
    const list = byOrder.get(row.orderId) ?? [];
    list.push(row);
    byOrder.set(row.orderId, list);
  }
  return [...byOrder.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([orderId, list]) => ({
      orderId,
      intentIds: list.map((item) => item.id),
    }));
}

/**
 * Keep the newest active intent per order; mark the rest superseded so the
 * unique slot index can be created. Production never auto-applies this.
 */
export function planDuplicateActiveIntentRecovery(
  rows: DuplicateActiveIntentRow[],
): { orderId: string; keepId: string; supersedeIds: string[] }[] {
  const byOrder = new Map<string, DuplicateActiveIntentRow[]>();
  for (const row of rows) {
    const list = byOrder.get(row.orderId) ?? [];
    list.push(row);
    byOrder.set(row.orderId, list);
  }
  const plans: { orderId: string; keepId: string; supersedeIds: string[] }[] =
    [];
  for (const [orderId, list] of byOrder) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    const newest = sorted[0];
    if (!newest) continue;
    plans.push({
      orderId,
      keepId: newest.id,
      supersedeIds: sorted.slice(1).map((item) => item.id),
    });
  }
  return plans;
}

export function paymentIndexIsEnforcing(index: {
  unique?: boolean;
  sparse?: boolean;
  key?: Record<string, unknown>;
  name?: string;
} | null | undefined): boolean {
  return Boolean(
    index &&
      index.unique === true &&
      index.sparse === true &&
      index.name === ACTIVE_ORDER_INTENT_INDEX &&
      index.key?.orderId === 1 &&
      index.key?.activeOrderSlot === 1,
  );
}

export function shouldFailClosedOnPaymentIndex(input: {
  production: boolean;
  indexReady: boolean;
  duplicateActiveCount: number;
}): boolean {
  return (
    input.production && (!input.indexReady || input.duplicateActiveCount > 0)
  );
}

export function paymentsCreateAllowed(input: { indexReady: boolean }): boolean {
  return input.indexReady;
}

export function supersedeReplacementStatus(intent: {
  status: PaymentIntentStatus;
  gatewayRef?: string;
  chargeLeaseUntil?: Date | number | null;
}): PaymentIntentStatus {
  if (
    intent.status === PaymentIntentStatus.Pending ||
    intent.status === PaymentIntentStatus.Initializing
  ) {
    return PaymentIntentStatus.Superseded;
  }
  if (intent.gatewayRef || intent.chargeLeaseUntil) {
    return PaymentIntentStatus.Superseded;
  }
  return PaymentIntentStatus.Failed;
}

export const ACTIVE_ORDER_SLOT_INDEX_SPEC = {
  key: { orderId: 1, activeOrderSlot: 1 },
  unique: true,
  sparse: true,
  name: ACTIVE_ORDER_INTENT_INDEX,
} as const;
