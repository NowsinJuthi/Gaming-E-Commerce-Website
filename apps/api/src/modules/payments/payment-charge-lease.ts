import { PaymentIntentStatus } from '../../common/enums';

export const CHARGE_LEASE_MS = 30_000;

export type ChargeLeaseOutcome = 'won' | 'lost' | 'already-charged' | 'skip';

export type ChargeLeaseRow = {
  id: string;
  status: PaymentIntentStatus;
  gatewayRef?: string;
  checkoutUrl?: string;
  chargeLeaseUntil?: number;
};

export function chargeLeaseFilter(
  id: unknown,
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    _id: id,
    $or: [
      {
        status: PaymentIntentStatus.Created,
        $or: [
          { chargeLeaseUntil: { $exists: false } },
          { chargeLeaseUntil: null },
          { chargeLeaseUntil: { $lte: now } },
        ],
      },
      {
        status: PaymentIntentStatus.Initializing,
        $or: [
          { chargeLeaseUntil: { $exists: false } },
          { chargeLeaseUntil: null },
          { chargeLeaseUntil: { $lte: now } },
        ],
      },
    ],
  };
}

export function shouldSkipCreateCharge(intent: {
  status: PaymentIntentStatus;
  gatewayRef?: string;
  checkoutUrl?: string;
}): boolean {
  return (
    intent.status === PaymentIntentStatus.Pending &&
    Boolean(intent.gatewayRef) &&
    Boolean(intent.checkoutUrl)
  );
}

/**
 * In-memory CAS used by tests to prove concurrent Created reuse cannot
 * invoke the external gateway twice.
 */
export function claimChargeLeaseInMemory(
  store: Map<string, ChargeLeaseRow>,
  id: string,
  now: Date = new Date(),
  leaseMs = CHARGE_LEASE_MS,
): { outcome: ChargeLeaseOutcome; row?: ChargeLeaseRow } {
  const current = store.get(id);
  if (!current) {
    return { outcome: 'skip' };
  }
  if (shouldSkipCreateCharge(current)) {
    return { outcome: 'already-charged', row: current };
  }
  const leaseHeld =
    current.status === PaymentIntentStatus.Initializing &&
    typeof current.chargeLeaseUntil === 'number' &&
    current.chargeLeaseUntil > now.getTime();
  if (leaseHeld) {
    return { outcome: 'lost', row: current };
  }
  const leaseExpiredInitializing =
    current.status === PaymentIntentStatus.Initializing &&
    (typeof current.chargeLeaseUntil !== 'number' ||
      current.chargeLeaseUntil <= now.getTime());
  if (
    current.status !== PaymentIntentStatus.Created &&
    !leaseExpiredInitializing
  ) {
    return { outcome: 'skip', row: current };
  }
  const won: ChargeLeaseRow = {
    ...current,
    status: PaymentIntentStatus.Initializing,
    chargeLeaseUntil: now.getTime() + leaseMs,
  };
  store.set(id, won);
  return { outcome: 'won', row: won };
}

export async function chargeCreatedIntentOnce<T>(
  store: Map<string, ChargeLeaseRow>,
  id: string,
  now: Date,
  createCharge: () => Promise<T>,
): Promise<{ outcome: ChargeLeaseOutcome; invoked: boolean; result?: T }> {
  const claimed = claimChargeLeaseInMemory(store, id, now);
  if (claimed.outcome !== 'won') {
    return { outcome: claimed.outcome, invoked: false };
  }
  const result = await createCharge();
  const current = store.get(id);
  if (current) {
    store.set(id, {
      ...current,
      status: PaymentIntentStatus.Pending,
      gatewayRef: 'gw-ref',
      checkoutUrl: 'https://pay.example/checkout',
      chargeLeaseUntil: undefined,
    });
  }
  return { outcome: 'won', invoked: true, result };
}
