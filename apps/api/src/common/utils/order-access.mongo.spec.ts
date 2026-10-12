import { ForbiddenException, NotFoundException } from '@nestjs/common';
import mongoose from 'mongoose';
import { OrderStatus, Role } from '../enums';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';
import {
  assertCanReadCustomerOrder,
  assertCanReadPaymentIntent,
  shouldRevealDeliveredCodes,
} from './order-access';
import {
  assertCanRefundCustomerOrder,
  assertCanWriteOrderSecrets,
} from './order-money-access';
import {
  assertCanManuallyApproveMfs,
  canMutateMfsConfiguration,
} from './mfs-approve-access';

function user(id: string, roles: Role[]): AuthenticatedUser {
  return { id, email: `${id}@example.test`, roles };
}

jest.setTimeout(120_000);

type MemoryServer = { getUri(): string; stop(): Promise<void> };

describe('live Mongo authorization and IDOR', () => {
  let mongod: MemoryServer | undefined;
  let mongoAvailable = false;
  let ownerId: mongoose.Types.ObjectId;
  let otherId: mongoose.Types.ObjectId;
  let orderId: mongoose.Types.ObjectId;
  let paymentId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    let MongoMemoryServer: { create(): Promise<MemoryServer> };
    try {
      ({ MongoMemoryServer } = require('mongodb-memory-server') as {
        MongoMemoryServer: { create(): Promise<MemoryServer> };
      });
    } catch {
      return;
    }
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const db = mongoose.connection.db;
    if (!db) return;
    ownerId = new mongoose.Types.ObjectId();
    otherId = new mongoose.Types.ObjectId();
    const order = await db.collection('authz_orders').insertOne({
      userId: ownerId,
      status: OrderStatus.Delivered,
      deliveredCodes: [{ code: 'SECRET-CODE' }],
    });
    const payment = await db.collection('authz_payments').insertOne({
      userId: ownerId,
      status: 'succeeded',
    });
    orderId = order.insertedId;
    paymentId = payment.insertedId;
    mongoAvailable = true;
  }, 120_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongod?.stop();
  });

  it('requires mongodb-memory-server for live authorization coverage', () => {
    expect(mongoAvailable).toBe(true);
  });

  const owner = () => user(String(ownerId), [Role.Customer]);
  const stranger = () => user(String(otherId), [Role.Customer]);
  const support = () => user('support-1', [Role.Support]);
  const admin = () => user('admin-1', [Role.Admin]);

  async function loadOrder(id: string) {
    const doc = await mongoose.connection.db
      ?.collection('authz_orders')
      .findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!doc) throw new NotFoundException('Order not found');
    return doc;
  }

  async function loadPayment(id: string) {
    const doc = await mongoose.connection.db
      ?.collection('authz_payments')
      .findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!doc) throw new NotFoundException('Payment not found');
    return doc;
  }

  it('returns not found for a missing Mongo id', async () => {
    if (!mongoAvailable) return;
    await expect(
      loadOrder('000000000000000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies a customer reading a foreign order and payment', async () => {
    if (!mongoAvailable) return;
    const order = await loadOrder(String(orderId));
    const payment = await loadPayment(String(paymentId));
    expect(() =>
      assertCanReadCustomerOrder(stranger(), {
        userId: String(order.userId),
        status: String(order.status),
      }),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertCanReadPaymentIntent(stranger(), String(payment.userId)),
    ).toThrow(ForbiddenException);
  });

  it('lets the owner read their documents and redacts codes for Support', async () => {
    if (!mongoAvailable) return;
    const order = await loadOrder(String(orderId));
    expect(() =>
      assertCanReadCustomerOrder(owner(), {
        userId: String(order.userId),
        status: String(order.status),
      }),
    ).not.toThrow();
    expect(shouldRevealDeliveredCodes(support())).toBe(false);
    expect(shouldRevealDeliveredCodes(admin())).toBe(true);
    expect(() =>
      assertCanReadPaymentIntent(owner(), String(ownerId)),
    ).not.toThrow();
  });

  it('blocks Support from MFS approval, refunds, secret writes, and role escalation', () => {
    expect(() => assertCanManuallyApproveMfs([Role.Support], true)).toThrow(
      ForbiddenException,
    );
    expect(canMutateMfsConfiguration([Role.Support])).toBe(false);
    expect(canMutateMfsConfiguration([Role.ShopManager])).toBe(true);
    expect(() => assertCanRefundCustomerOrder(stranger())).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanRefundCustomerOrder(support())).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanWriteOrderSecrets(support())).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanRefundCustomerOrder(admin())).not.toThrow();
  });

  it('returns not found for a missing payment-intent id', async () => {
    if (!mongoAvailable) return;
    await expect(
      loadPayment('000000000000000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
