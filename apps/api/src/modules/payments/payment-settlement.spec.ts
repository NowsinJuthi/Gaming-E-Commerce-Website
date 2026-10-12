import { PaymentIntentStatus } from '../../common/enums';
import {
  needsSettlementApply,
  settlementLeaseFilter,
  SETTLEMENT_APPLIED,
  SETTLEMENT_PENDING,
  SETTLEMENT_UNMATCHED,
  SETTLEMENT_UNMATCHED_APPLIED,
  SETTLEMENT_UNMATCHED_MANUAL,
} from './payment-settlement';

describe('payment settlement outbox', () => {
  it('retries Succeeded intents that have not applied money-moving side effects', () => {
    expect(
      needsSettlementApply({
        status: PaymentIntentStatus.Succeeded,
        settlementState: SETTLEMENT_PENDING,
      }),
    ).toBe(true);
    expect(
      needsSettlementApply({
        status: PaymentIntentStatus.Succeeded,
        settlementState: undefined,
      }),
    ).toBe(true);
  });

  it('does not re-apply after settlement is durably marked applied', () => {
    expect(
      needsSettlementApply({
        status: PaymentIntentStatus.Succeeded,
        settlementState: SETTLEMENT_APPLIED,
      }),
    ).toBe(false);
    expect(
      needsSettlementApply({
        status: PaymentIntentStatus.Pending,
        settlementState: SETTLEMENT_PENDING,
      }),
    ).toBe(false);
  });

  it('leases only unapplied Succeeded rows', () => {
    const filter = settlementLeaseFilter('abc', new Date('2026-10-12T12:00:00Z'));
    expect(filter.status).toBe(PaymentIntentStatus.Succeeded);
    expect(filter.settlementState).toEqual({
      $nin: [
        SETTLEMENT_APPLIED,
        SETTLEMENT_UNMATCHED_APPLIED,
        SETTLEMENT_UNMATCHED_MANUAL,
      ],
    });
  });

  it('retries duplicate refunds until unmatched_applied', () => {
    expect(
      needsSettlementApply({
        status: PaymentIntentStatus.Succeeded,
        settlementState: SETTLEMENT_UNMATCHED,
      }),
    ).toBe(true);
  });

  it('does not re-apply unmatched duplicate refunds', () => {
    expect(
      needsSettlementApply({
        status: PaymentIntentStatus.Succeeded,
        settlementState: SETTLEMENT_UNMATCHED_APPLIED,
      }),
    ).toBe(false);
    expect(
      needsSettlementApply({
        status: PaymentIntentStatus.Succeeded,
        settlementState: SETTLEMENT_UNMATCHED_MANUAL,
      }),
    ).toBe(false);
  });
});
