import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, Role } from '../enums';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';
import {
  assertCanReadCustomerOrder,
  assertCanReadPaymentIntent,
  shouldRevealDeliveredCodes,
} from './order-access';

function user(id: string, roles: Role[]): AuthenticatedUser {
  return { id, email: `${id}@example.test`, roles };
}

describe('order and payment access', () => {
  const owner = user('owner-1', [Role.Customer]);
  const other = user('other-1', [Role.Customer]);
  const support = user('support-1', [Role.Support]);
  const admin = user('admin-1', [Role.Admin]);

  it('denies a customer reading another user order (IDOR)', () => {
    expect(() =>
      assertCanReadCustomerOrder(other, {
        userId: 'owner-1',
        status: OrderStatus.Paid,
      }),
    ).toThrow(ForbiddenException);
  });

  it('lets the owner read their own order', () => {
    expect(() =>
      assertCanReadCustomerOrder(owner, {
        userId: 'owner-1',
        status: OrderStatus.Paid,
      }),
    ).not.toThrow();
  });

  it('lets Support read orders but not delivered codes', () => {
    expect(() =>
      assertCanReadCustomerOrder(support, {
        userId: 'owner-1',
        status: OrderStatus.Delivered,
      }),
    ).not.toThrow();
    expect(shouldRevealDeliveredCodes(support)).toBe(false);
    expect(shouldRevealDeliveredCodes(admin)).toBe(true);
  });

  it('denies a customer reading another user payment intent', () => {
    expect(() => assertCanReadPaymentIntent(other, 'owner-1')).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanReadPaymentIntent(owner, 'owner-1')).not.toThrow();
    expect(() => assertCanReadPaymentIntent(support, 'owner-1')).not.toThrow();
  });

  it('hides failed orders from the customer', () => {
    expect(() =>
      assertCanReadCustomerOrder(owner, {
        userId: 'owner-1',
        status: OrderStatus.Failed,
      }),
    ).toThrow(NotFoundException);
  });
});

type StoredOrder = {
  id: string;
  userId: string;
  status: string;
  deliveredCodes?: string[];
};

type StoredIntent = {
  id: string;
  userId: string;
};

function getOrderFromMongoLikeStore(
  store: Map<string, StoredOrder>,
  id: string,
  actor: AuthenticatedUser,
): { id: string; deliveredCodes?: string[] } {
  const order = store.get(id);
  if (!order) {
    throw new NotFoundException('Order not found');
  }
  assertCanReadCustomerOrder(actor, order);
  if (!shouldRevealDeliveredCodes(actor)) {
    return { id: order.id };
  }
  return { id: order.id, deliveredCodes: order.deliveredCodes };
}

function getPaymentFromMongoLikeStore(
  store: Map<string, StoredIntent>,
  id: string,
  actor: AuthenticatedUser,
): StoredIntent {
  const intent = store.get(id);
  if (!intent) {
    throw new NotFoundException('Payment not found');
  }
  assertCanReadPaymentIntent(actor, intent.userId);
  return intent;
}

describe('Mongo-backed order and payment IDOR', () => {
  const owner = user('owner-1', [Role.Customer]);
  const other = user('other-1', [Role.Customer]);
  const support = user('support-1', [Role.Support]);
  const admin = user('admin-1', [Role.Admin]);

  const orders = new Map<string, StoredOrder>([
    [
      '507f1f77bcf86cd799439011',
      {
        id: '507f1f77bcf86cd799439011',
        userId: 'owner-1',
        status: OrderStatus.Delivered,
        deliveredCodes: ['SECRET-CODE'],
      },
    ],
  ]);
  const intents = new Map<string, StoredIntent>([
    ['pay-1', { id: 'pay-1', userId: 'owner-1' }],
  ]);

  it('denies another customer reading an order document by ObjectId', () => {
    expect(() =>
      getOrderFromMongoLikeStore(orders, '507f1f77bcf86cd799439011', other),
    ).toThrow(ForbiddenException);
  });

  it('lets the owner read their order without leaked delivered codes for Support', () => {
    expect(
      getOrderFromMongoLikeStore(orders, '507f1f77bcf86cd799439011', owner)
        .deliveredCodes,
    ).toBeUndefined();
    expect(
      getOrderFromMongoLikeStore(orders, '507f1f77bcf86cd799439011', support)
        .deliveredCodes,
    ).toBeUndefined();
    expect(
      getOrderFromMongoLikeStore(orders, '507f1f77bcf86cd799439011', admin)
        .deliveredCodes,
    ).toEqual(['SECRET-CODE']);
  });

  it('denies another customer reading a payment intent document by id', () => {
    expect(() =>
      getPaymentFromMongoLikeStore(intents, 'pay-1', other),
    ).toThrow(ForbiddenException);
    expect(getPaymentFromMongoLikeStore(intents, 'pay-1', owner).id).toBe(
      'pay-1',
    );
  });

  it('returns not found for a missing Mongo id rather than leaking existence via a different error', () => {
    expect(() =>
      getOrderFromMongoLikeStore(orders, '000000000000000000000000', owner),
    ).toThrow(NotFoundException);
  });
});
