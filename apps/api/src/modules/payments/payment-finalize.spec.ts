import { PaymentIntentStatus } from '../../common/enums';
import {
  claimPaymentSuccessInMemory,
  decidePaymentFinalize,
  walletTopupIdempotencyKey,
} from './payment-finalize';

describe('payment finalize state machine', () => {
  const now = new Date('2026-10-12T12:00:00.000Z');

  it('rejects a successful webhook after Expired', () => {
    expect(
      decidePaymentFinalize(
        { status: PaymentIntentStatus.Expired, expiresAt: now },
        now,
      ),
    ).toBe('reject-terminal');
  });

  it('rejects a successful webhook after Failed', () => {
    expect(
      decidePaymentFinalize({ status: PaymentIntentStatus.Failed }, now),
    ).toBe('reject-terminal');
  });

  it('rejects a successful webhook after Unmatched', () => {
    expect(
      decidePaymentFinalize({ status: PaymentIntentStatus.Unmatched }, now),
    ).toBe('reject-terminal');
  });

  it('routes a superseded late success into unmatched reconciliation', () => {
    expect(
      decidePaymentFinalize({ status: PaymentIntentStatus.Superseded }, now),
    ).toBe('claim-unmatched');
    expect(
      decidePaymentFinalize(
        {
          status: PaymentIntentStatus.Superseded,
          expiresAt: new Date('2026-10-12T11:00:00.000Z'),
        },
        now,
      ),
    ).toBe('claim-unmatched');
  });

  it('does not treat Failed superseded leftovers as reclaimable', () => {
    expect(
      decidePaymentFinalize({ status: PaymentIntentStatus.Failed }, now),
    ).toBe('reject-terminal');
  });

  it('rejects Created/Pending intents whose expiresAt has passed', () => {
    expect(
      decidePaymentFinalize(
        {
          status: PaymentIntentStatus.Pending,
          expiresAt: new Date('2026-10-12T11:59:59.000Z'),
        },
        now,
      ),
    ).toBe('reject-expired');
  });

  it('treats a second success as idempotent already-succeeded', () => {
    expect(
      decidePaymentFinalize({ status: PaymentIntentStatus.Succeeded }, now),
    ).toBe('already-succeeded');
  });

  it('lets only one concurrent claim win (webhook vs poll)', () => {
    const store = new Map([
      [
        'intent-1',
        {
          id: 'intent-1',
          status: PaymentIntentStatus.Pending,
          expiresAt: new Date('2026-10-12T13:00:00.000Z'),
        },
      ],
    ]);
    const first = claimPaymentSuccessInMemory(store, 'intent-1', now);
    const second = claimPaymentSuccessInMemory(store, 'intent-1', now);
    expect(first?.status).toBe(PaymentIntentStatus.Succeeded);
    expect(
      (first as { settlementState?: string } | null)?.settlementState,
    ).toBe('pending');
    expect(second).toBeNull();
  });

  it('claims a superseded late success as unmatched instead of order settlement', () => {
    const store = new Map([
      [
        'intent-old',
        {
          id: 'intent-old',
          status: PaymentIntentStatus.Superseded,
        },
      ],
    ]);
    const first = claimPaymentSuccessInMemory(store, 'intent-old', now);
    const second = claimPaymentSuccessInMemory(store, 'intent-old', now);
    expect(first?.status).toBe(PaymentIntentStatus.Succeeded);
    expect(
      (first as { settlementState?: string } | null)?.settlementState,
    ).toBe('unmatched');
    expect(second).toBeNull();
  });

  it('keeps wallet top-up replay on a stable idempotency key', () => {
    const key = walletTopupIdempotencyKey('abc123');
    expect(key).toBe('topup:abc123');
    const ledger = new Set<string>();
    const replay = (intentId: string) => {
      const next = walletTopupIdempotencyKey(intentId);
      if (ledger.has(next)) return 'skip';
      ledger.add(next);
      return 'credit';
    };
    expect(replay('abc123')).toBe('credit');
    expect(replay('abc123')).toBe('skip');
  });
});
