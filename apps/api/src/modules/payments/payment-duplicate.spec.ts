import {
  decideDuplicateOrderSettlement,
  decideDuplicateRefund,
  duplicateRefundIdempotencyKey,
} from './payment-duplicate';

describe('duplicate order payment settlement', () => {
  it('applies when this intent won the order', () => {
    expect(
      decideDuplicateOrderSettlement({
        confirmOutcome: 'claimed',
        settlingIntentId: 'intent-a',
        payerIntentId: 'intent-a',
      }),
    ).toBe('apply');
  });

  it('applies on idempotent retry of the same winning intent', () => {
    expect(
      decideDuplicateOrderSettlement({
        confirmOutcome: 'already-paid',
        settlingIntentId: 'intent-a',
        payerIntentId: 'intent-a',
      }),
    ).toBe('apply');
  });

  it('marks a second successful intent unmatched instead of settling the order again', () => {
    expect(
      decideDuplicateOrderSettlement({
        confirmOutcome: 'already-paid',
        settlingIntentId: 'intent-b',
        payerIntentId: 'intent-a',
      }),
    ).toBe('unmatched');
    expect(
      decideDuplicateOrderSettlement({
        confirmOutcome: 'already-paid',
        settlingIntentId: 'intent-b',
      }),
    ).toBe('unmatched');
  });

  it('retries when the order document is missing', () => {
    expect(
      decideDuplicateOrderSettlement({
        confirmOutcome: 'missing',
        settlingIntentId: 'intent-a',
      }),
    ).toBe('retry');
  });

  it('keeps duplicate gateway refunds idempotent per intent', () => {
    expect(duplicateRefundIdempotencyKey('abc')).toBe('duprefund:abc');
  });

  it('prefers an original-gateway refund and never silently credits the wallet', () => {
    expect(
      decideDuplicateRefund({
        gatewayRefund: { supported: true, ok: true },
      }),
    ).toBe('gateway');
    expect(
      decideDuplicateRefund({
        gatewayRefund: { supported: false, ok: false },
      }),
    ).toBe('manual');
    expect(
      decideDuplicateRefund({
        gatewayRefund: { supported: true, ok: false },
      }),
    ).toBe('retry');
  });

  it('does not refund the same captured payment twice', () => {
    expect(
      decideDuplicateRefund({
        settlementState: 'unmatched_applied',
        gatewayRefund: { supported: true, ok: true },
      }),
    ).toBe('already-applied');
    expect(
      decideDuplicateRefund({
        settlementState: 'unmatched_manual',
        gatewayRefund: { supported: false, ok: false },
      }),
    ).toBe('already-applied');
  });
});
