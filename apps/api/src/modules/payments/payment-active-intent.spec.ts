import { PaymentGateway, PaymentIntentStatus } from '../../common/enums';
import {
  ACTIVE_ORDER_SLOT,
  ACTIVE_ORDER_SLOT_INDEX_SPEC,
  claimActiveOrderIntentInMemory,
  classifyActiveOrderCheckout,
  findDuplicateActiveOrderGroups,
  isActiveOrderIntentStatus,
  paymentIndexIsEnforcing,
  paymentsCreateAllowed,
  planDuplicateActiveIntentRecovery,
  settlingOrderIntentFilter,
  shouldFailClosedOnPaymentIndex,
  supersedeReplacementStatus,
} from './payment-active-intent';

describe('active order payment intent lock', () => {
  it('reuses the same-user same-gateway checkout', () => {
    expect(
      classifyActiveOrderCheckout(
        { userId: 'u1', gateway: PaymentGateway.Mfs },
        { userId: 'u1', gateway: PaymentGateway.Mfs },
      ),
    ).toBe('reuse');
  });

  it('lets the same user supersede a different gateway', () => {
    expect(
      classifyActiveOrderCheckout(
        { userId: 'u1', gateway: PaymentGateway.Mfs },
        { userId: 'u1', gateway: PaymentGateway.Bkash },
      ),
    ).toBe('supersede');
  });

  it('rejects another user occupying the order slot', () => {
    expect(
      classifyActiveOrderCheckout(
        { userId: 'u1', gateway: PaymentGateway.Mfs },
        { userId: 'u2', gateway: PaymentGateway.Mfs },
      ),
    ).toBe('forbidden');
  });

  it('serializes concurrent creates for one pending order', () => {
    const store = new Map();
    const first = claimActiveOrderIntentInMemory(store, {
      id: 'a',
      orderId: 'order-1',
      userId: 'u1',
      gateway: PaymentGateway.Mfs,
    });
    const second = claimActiveOrderIntentInMemory(store, {
      id: 'b',
      orderId: 'order-1',
      userId: 'u1',
      gateway: PaymentGateway.Mfs,
    });
    expect(first.outcome).toBe('created');
    expect(second.outcome).toBe('reuse');
    expect(second.row?.id).toBe('a');
    expect(store.size).toBe(1);
  });

  it('does not open a second slot while the first intent is settling', () => {
    const store = new Map();
    claimActiveOrderIntentInMemory(store, {
      id: 'a',
      orderId: 'order-1',
      userId: 'u1',
      gateway: PaymentGateway.Mfs,
    });
    const settling = store.get('order-1')!;
    settling.status = PaymentIntentStatus.Succeeded;
    store.set('order-1', settling);
    const second = claimActiveOrderIntentInMemory(store, {
      id: 'b',
      orderId: 'order-1',
      userId: 'u1',
      gateway: PaymentGateway.Nagad,
    });
    expect(second.outcome).toBe('blocked-settling');
  });

  it('uses a sparse unique slot index distinct from the orderId lookup index', () => {
    expect(ACTIVE_ORDER_SLOT_INDEX_SPEC.unique).toBe(true);
    expect(ACTIVE_ORDER_SLOT_INDEX_SPEC.sparse).toBe(true);
    expect(ACTIVE_ORDER_SLOT_INDEX_SPEC.key).toEqual({
      orderId: 1,
      activeOrderSlot: 1,
    });
    expect(ACTIVE_ORDER_SLOT).toBe(1);
    expect(isActiveOrderIntentStatus(PaymentIntentStatus.Pending)).toBe(true);
    expect(isActiveOrderIntentStatus(PaymentIntentStatus.Succeeded)).toBe(
      false,
    );
    expect(isActiveOrderIntentStatus(PaymentIntentStatus.Initializing)).toBe(
      true,
    );
    expect(settlingOrderIntentFilter('oid').status).toBe(
      PaymentIntentStatus.Succeeded,
    );
  });

  it('marks a pending/in-flight intent superseded instead of failed', () => {
    expect(
      supersedeReplacementStatus({
        status: PaymentIntentStatus.Pending,
        gatewayRef: 'pay_1',
      }),
    ).toBe(PaymentIntentStatus.Superseded);
    expect(
      supersedeReplacementStatus({
        status: PaymentIntentStatus.Initializing,
        chargeLeaseUntil: Date.now() + 1000,
      }),
    ).toBe(PaymentIntentStatus.Superseded);
    expect(
      supersedeReplacementStatus({ status: PaymentIntentStatus.Created }),
    ).toBe(PaymentIntentStatus.Failed);
  });

  it('fails production closed when the unique index is missing', () => {
    expect(
      shouldFailClosedOnPaymentIndex({
        production: true,
        indexReady: false,
        duplicateActiveCount: 0,
      }),
    ).toBe(true);
    expect(paymentsCreateAllowed({ indexReady: false })).toBe(false);
    expect(
      paymentIndexIsEnforcing({
        unique: true,
        sparse: true,
        name: ACTIVE_ORDER_SLOT_INDEX_SPEC.name,
        key: { orderId: 1, activeOrderSlot: 1 },
      }),
    ).toBe(true);
    expect(
      paymentIndexIsEnforcing({
        unique: false,
        sparse: true,
        name: ACTIVE_ORDER_SLOT_INDEX_SPEC.name,
        key: { orderId: 1, activeOrderSlot: 1 },
      }),
    ).toBe(false);
  });

  it('detects duplicate active intents and plans recovery that keeps the newest', () => {
    const rows = [
      { id: 'old', orderId: 'order-1', createdAt: 1 },
      { id: 'new', orderId: 'order-1', createdAt: 2 },
      { id: 'solo', orderId: 'order-2', createdAt: 3 },
    ];
    expect(findDuplicateActiveOrderGroups(rows)).toEqual([
      { orderId: 'order-1', intentIds: ['old', 'new'] },
    ]);
    expect(planDuplicateActiveIntentRecovery(rows)).toEqual([
      { orderId: 'order-1', keepId: 'new', supersedeIds: ['old'] },
    ]);
    expect(
      shouldFailClosedOnPaymentIndex({
        production: true,
        indexReady: true,
        duplicateActiveCount: 1,
      }),
    ).toBe(true);
  });
});
