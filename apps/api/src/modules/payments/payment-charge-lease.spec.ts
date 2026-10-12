import { PaymentIntentStatus } from '../../common/enums';
import {
  chargeCreatedIntentOnce,
  chargeLeaseFilter,
  claimChargeLeaseInMemory,
  shouldSkipCreateCharge,
  type ChargeLeaseRow,
} from './payment-charge-lease';

describe('created-intent charge lease', () => {
  const now = new Date('2026-10-12T12:00:00.000Z');

  it('skips createCharge when the intent is already pending with a gateway ref', () => {
    expect(
      shouldSkipCreateCharge({
        status: PaymentIntentStatus.Pending,
        gatewayRef: 'pay_1',
        checkoutUrl: 'https://pay.example/1',
      }),
    ).toBe(true);
    expect(
      shouldSkipCreateCharge({
        status: PaymentIntentStatus.Created,
        gatewayRef: undefined,
        checkoutUrl: undefined,
      }),
    ).toBe(false);
  });

  it('lets only one concurrent Created reuse win the charge lease', () => {
    const store = new Map([
      [
        'intent-1',
        {
          id: 'intent-1',
          status: PaymentIntentStatus.Created,
        },
      ],
    ]);
    const first = claimChargeLeaseInMemory(store, 'intent-1', now);
    const second = claimChargeLeaseInMemory(store, 'intent-1', now);
    expect(first.outcome).toBe('won');
    expect(first.row?.status).toBe(PaymentIntentStatus.Initializing);
    expect(second.outcome).toBe('lost');
  });

  it('invokes createCharge only once under concurrent Created reuse', async () => {
    const store = new Map<string, ChargeLeaseRow>([
      [
        'intent-1',
        {
          id: 'intent-1',
          status: PaymentIntentStatus.Created,
        },
      ],
    ]);
    let calls = 0;
    const createCharge = async () => {
      calls += 1;
      return { gatewayRef: 'pay_1' };
    };
    const [a, b] = await Promise.all([
      chargeCreatedIntentOnce(store, 'intent-1', now, createCharge),
      chargeCreatedIntentOnce(store, 'intent-1', now, createCharge),
    ]);
    const invoked = [a, b].filter((row) => row.invoked);
    expect(invoked).toHaveLength(1);
    expect(calls).toBe(1);
    expect(store.get('intent-1')?.status).toBe(PaymentIntentStatus.Pending);
    expect(store.get('intent-1')?.gatewayRef).toBe('gw-ref');
  });

  it('CAS filter matches Created or expired Initializing rows', () => {
    const filter = chargeLeaseFilter('abc', now) as {
      $or: Array<{ status: PaymentIntentStatus }>;
    };
    expect(filter.$or.map((branch) => branch.status)).toEqual([
      PaymentIntentStatus.Created,
      PaymentIntentStatus.Initializing,
    ]);
  });

  it('lets a later request recover an expired initializing lease', () => {
    const store = new Map([
      [
        'intent-1',
        {
          id: 'intent-1',
          status: PaymentIntentStatus.Initializing,
          chargeLeaseUntil: now.getTime() - 1,
        },
      ],
    ]);
    const recovered = claimChargeLeaseInMemory(store, 'intent-1', now);
    expect(recovered.outcome).toBe('won');
  });
});
