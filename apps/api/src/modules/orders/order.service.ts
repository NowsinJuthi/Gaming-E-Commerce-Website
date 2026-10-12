import { DEFAULT_CURRENCY } from '@uniqbd/types';
import { escapeRegex } from '../../common/utils/escape-regex';
import { isChatStaff } from '../../common/utils/role.utils';
import {
  assertCanReadCustomerOrder,
  shouldRevealDeliveredCodes,
} from '../../common/utils/order-access';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  DeliveryType,
  InventoryStatus,
  NotificationEvent,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  WalletTransactionType,
} from '../../common/enums';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { round2 } from '../../common/utils/money';
import { PaymentIntentStatus } from '../../common/enums/payment-intent.enum';
import type { ConfirmPaymentResult } from '../payments/payment-duplicate';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../database/schemas/inventory-item.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  PaymentIntent,
  PaymentIntentDocument,
} from '../../database/schemas/payment-intent.schema';
import { SmsLog, SmsLogDocument } from '../../database/schemas/sms-log.schema';
import { parseMfsCustomerMobileFromSmsBody } from '../mfs/mfs-sms.parser';
import {
  User,
  UserDocument,
} from '../../database/schemas/user.schema';
import {
  SequenceCounter,
  SequenceCounterDocument,
} from '../../database/schemas/sequence-counter.schema';
import {
  Product,
  ProductDocument,
} from '../../database/schemas/product.schema';
import { MailerService } from '../../integrations/mail/mailer.service';
import { EmailSenderChannel } from '../../integrations/mail/email-settings.service';
import { CartService } from '../cart/cart.service';
import { CartLineItem } from '../cart/cart.types';
import { CustomerPanelSettingsService } from '../customer-panel/customer-panel-settings.service';
import { CouponService } from '../coupons/coupon.service';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { VoucherService } from '../vouchers/voucher.service';
import { WalletService } from '../wallet/wallet.service';
import {
  ManualGiftCardDto,
  SaveManualDeliveryDto,
} from './dto/manual-gift-card.dto';
import { AffiliateService } from '../affiliate/affiliate.service';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import {
  DeliveryJob,
  DeliveryJobData,
  DELIVERY_JOB_OPTIONS,
  DELIVERY_QUEUE,
  OrderJob,
  OrderJobData,
  ORDERS_QUEUE,
} from '../../queues/queue.constants';
import { AuthenticatedUser } from '../auth/auth.types';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { resolveLineStock } from '../../common/utils/product-variation-stock';
import {
  buildOrderOrigin,
  type OrderClientMeta,
} from '../../common/utils/order-client-meta';
import { CreateOrderDto } from './dto/create-order.dto';
import { UsersService } from '../users/users.service';
import { CustomerOrderMailService } from './customer-order-mail.service';
import { TelegramOrderNotifier } from '../notifications/telegram-order-notifier.service';
import {
  runIsolatedSideEffect,
  runIsolatedSideEffectVoid,
} from '../../shared/utils/isolated-side-effect';
import type { AdminOrderTelegramStage } from '../notifications/order-notification-policy';
import type { CustomerOrderEmailStatus } from '../notifications/order-notification-policy';

const RESERVATION_TTL_MS = 15 * 60 * 1000; // 15 minutes to pay
const CUSTOMER_ORDER_COUNTER_ID = 'customer_order';
/** First issued customer order number (counter stores start - 1 before increment). */
const CUSTOMER_ORDER_NUMBER_START = 1000;

/** Orders trashed by admin (failed) are hidden from customer-facing APIs. */
function customerOrdersFilter(userId: string) {
  return {
    userId: new Types.ObjectId(userId),
    status: { $ne: OrderStatus.Failed },
  };
}

interface Reservation {
  productId: Types.ObjectId;
  quantity: number;
  deliveryType: DeliveryType;
  inventoryItemIds: Types.ObjectId[];
  variationValueId?: string;
  manualVariation?: boolean;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(SequenceCounter.name)
    private readonly sequenceCounterModel: Model<SequenceCounterDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItemDocument>,
    @InjectModel(PaymentIntent.name)
    private readonly paymentIntentModel: Model<PaymentIntentDocument>,
    @InjectModel(SmsLog.name)
    private readonly smsLogModel: Model<SmsLogDocument>,
    @InjectQueue(ORDERS_QUEUE) private readonly ordersQueue: Queue<OrderJobData>,
    @InjectQueue(DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
    private readonly cart: CartService,
    private readonly customerPanel: CustomerPanelSettingsService,
    private readonly coupons: CouponService,
    private readonly vouchers: VoucherService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly wallet: WalletService,
    private readonly affiliate: AffiliateService,
    private readonly mailer: MailerService,
    private readonly rolePermissions: RolePermissionsService,
    private readonly users: UsersService,
    private readonly cache: CacheService,
    private readonly customerOrderMail: CustomerOrderMailService,
    private readonly telegramOrders: TelegramOrderNotifier,
    private readonly crypto: CryptoService,
  ) {}

  // --- Public API ---

  async create(
    userId: string,
    dto: CreateOrderDto,
    clientMeta?: OrderClientMeta,
  ): Promise<OrderDocument> {
    const cart = await this.cart.getCart(userId);
    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }
    if (cart.coupon && !cart.coupon.valid) {
      throw new BadRequestException('Applied coupon is no longer valid');
    }
    if (cart.voucher && !cart.voucher.valid) {
      throw new BadRequestException('Applied voucher is no longer valid');
    }

    const method = dto.paymentMethod ?? PaymentMethod.Wallet;
    await this.assertPaymentMethodAllowed(method);

    const buyer = await this.userModel.findById(userId).exec();
    if (buyer?.isGuest) {
      const panelConfig = await this.customerPanel.getConfig();
      if (!panelConfig.checkout.allowGuestCheckout) {
        throw new ForbiddenException('Guest checkout is disabled');
      }
      if (!dto.contact?.fullName?.trim() || !dto.contact?.mobile?.trim() || !dto.contact?.email?.trim()) {
        throw new BadRequestException('Contact details are required for guest checkout');
      }
      if (method === PaymentMethod.Wallet) {
        throw new BadRequestException('Wallet payment is not available for guest checkout');
      }
    }

    const orderId = new Types.ObjectId();
    const reservations = await this.reserveStock(orderId, cart.items);

    try {
      const order = await this.orderModel.create({
        _id: orderId,
        orderNumber: await this.generateOrderNumber(),
        userId: new Types.ObjectId(userId),
        items: cart.items.map((line, index) => ({
          productId: new Types.ObjectId(line.productId),
          title: line.packageName
            ? `${line.title} (${line.packageName})`
            : line.title,
          slug: line.slug,
          variationValueId: line.variationValueId,
          customerInputs: line.customerInputs ?? [],
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
          deliveryType: reservations[index]?.deliveryType ?? DeliveryType.Auto,
          inventoryItemIds: reservations[index]?.inventoryItemIds ?? [],
          delivered: false,
        })),
        pricing: {
          subtotal: cart.subtotal,
          couponCode: cart.coupon?.code,
          couponDiscount: cart.coupon?.discount ?? 0,
          voucherCode: cart.voucher?.code,
          voucherDiscount: cart.voucher?.applied ?? 0,
          discountTotal: cart.discountTotal,
          total: cart.total,
          currency: cart.currency,
        },
        status: OrderStatus.Pending,
        payment: {
          method,
          status: PaymentStatus.Pending,
        },
        timeline: [
          { status: OrderStatus.Pending, at: new Date(), note: dto.note },
        ],
        contact: dto.contact
          ? {
              fullName: dto.contact.fullName.trim(),
              mobile: dto.contact.mobile.trim(),
              email: dto.contact.email.trim().toLowerCase(),
            }
          : undefined,
        origin: buildOrderOrigin(clientMeta, dto.paymentMethod),
        reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
      });

      await this.cart.clear(userId);

      // Schedule auto-cancel if payment is not completed in time. A queue
      // outage must not block order creation — the expiry is a safety net.
      try {
        await this.ordersQueue.add(
          OrderJob.Expire,
          { orderId: String(order._id) },
          { delay: RESERVATION_TTL_MS, jobId: `expire:${String(order._id)}` },
        );
      } catch (queueError) {
        this.logger.warn(
          `Could not schedule expiry for order ${String(order._id)}: ${
            queueError instanceof Error ? queueError.message : String(queueError)
          }`,
        );
      }

      // Operational alert to the store inbox — best-effort, never blocks checkout.
      void this.mailer
        .sendAdminNewOrder({
          orderNumber: order.orderNumber,
          customerName: order.contact?.fullName,
          customerEmail: order.contact?.email,
          items: order.items.map((it) => ({
            title: it.title,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
          total: order.pricing.total,
          currency: order.pricing.currency,
          orderUrl: `/admin/sales/orders/${String(order._id)}`,
        })
        .catch(() => undefined);

      // Pending checkout email (awaiting payment) — respects order.pending template toggle.
      void this.customerOrderMail
        .sendOrderPending(order, buyer)
        .catch(() => undefined);

      void this.cache.del(CacheKeys.admin.dashboardOverview);

      return this.withGuestReceiptToken(order, buyer?.isGuest === true);
    } catch (error) {
      // Roll back any held stock if order persistence failed.
      await Promise.all(reservations.map((r) => this.releaseReservation(r)));
      throw error;
    }
  }

  /**
   * Confirms a wallet payment for a pending order. The wallet is debited
   * atomically (with overdraft protection) BEFORE the order is marked paid, and
   * the debit is idempotent per order so retries never double-charge. Gateway
   * payments settle via the Payment module + {@link confirmPayment} instead.
   */
  async pay(
    userId: string,
    orderId: string,
    clientMeta?: OrderClientMeta,
  ): Promise<OrderDocument> {
    const order = await this.getOwned(userId, orderId);
    if (order.status !== OrderStatus.Pending) {
      throw new BadRequestException('Order is not awaiting payment');
    }
    if (order.payment.method !== PaymentMethod.Wallet) {
      throw new BadRequestException(
        'This order is not configured for wallet payment',
      );
    }

    this.ensureOrderOrigin(order, clientMeta);

    // Debit the wallet first. If the balance is insufficient (or any error
    // occurs), the order stays Pending and reserved stock is released on expiry.
    const txn = await this.wallet.debit({
      userId,
      amount: order.pricing.total,
      type: WalletTransactionType.Purchase,
      idempotencyKey: `order-pay:${String(order._id)}`,
      reference: { type: 'order', id: order._id },
      description: `Payment for order ${order.orderNumber}`,
      metadata: { orderNumber: order.orderNumber },
    });

    const paidAt = new Date();
    const paidOrder = await this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          userId: new Types.ObjectId(userId),
          status: OrderStatus.Pending,
          'payment.method': PaymentMethod.Wallet,
        },
        {
          $set: {
            status: OrderStatus.Paid,
            'payment.status': PaymentStatus.Paid,
            'payment.paidAt': paidAt,
            'payment.transactionId': txn._id as Types.ObjectId,
            ...(order.origin ? { origin: order.origin } : {}),
          },
          $push: {
            timeline: { status: OrderStatus.Paid, at: paidAt },
          },
        },
        { new: true },
      )
      .exec();

    // Concurrent retries share the idempotent wallet debit. Only the request
    // that wins the Pending -> Paid transition may launch fulfillment effects.
    if (!paidOrder) {
      const current = await this.getOwned(userId, orderId);
      if (current.status !== OrderStatus.Paid) {
        throw new BadRequestException('Order is not awaiting payment');
      }
      const buyer = await this.userModel
        .findById(userId)
        .select('isGuest')
        .lean();
      return this.withGuestReceiptToken(current, buyer?.isGuest === true);
    }

    void this.runPostPaymentSideEffects(paidOrder, userId);
    void this.cache.del(CacheKeys.admin.dashboardOverview);
    const buyer = await this.userModel.findById(userId).select('isGuest').lean();
    return this.withGuestReceiptToken(paidOrder, buyer?.isGuest === true);
  }

  async getGuestReceipt(token: string): Promise<{
    orderNumber: string;
    status: string;
    emailMasked: string;
    paid: boolean;
  }> {
    const receipt = await this.customerOrderMail.getGuestReceipt(token);
    if (!receipt) {
      throw new NotFoundException('Receipt not found or link expired');
    }
    return receipt;
  }

  /**
   * Marks an order paid after a successful gateway settlement. Driven by the
   * Payment module (no user context), idempotent, and enqueues fulfillment.
   */
  async confirmPayment(
    orderId: string,
    paymentRef?: Types.ObjectId,
  ): Promise<ConfirmPaymentResult> {
    const paidAt = new Date();
    const order = await this.orderModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(orderId), status: OrderStatus.Pending },
        {
          $set: {
            status: OrderStatus.Paid,
            'payment.status': PaymentStatus.Paid,
            'payment.paidAt': paidAt,
            ...(paymentRef
              ? { 'payment.transactionId': paymentRef }
              : {}),
          },
          $push: {
            timeline: { status: OrderStatus.Paid, at: paidAt },
          },
        },
        { new: true },
      )
      .exec();
    if (order) {
      void this.runPostPaymentSideEffects(order, String(order.userId));
      void this.cache.del(CacheKeys.admin.dashboardOverview);
      return {
        outcome: 'claimed',
        payerIntentId: paymentRef ? String(paymentRef) : undefined,
      };
    }

    const current = await this.orderModel
      .findById(orderId)
      .select('status payment.transactionId')
      .lean()
      .exec();
    if (!current) {
      return { outcome: 'missing' };
    }
    const payer = (current as { payment?: { transactionId?: unknown } }).payment
      ?.transactionId;
    return {
      outcome: 'already-paid',
      payerIntentId: payer ? String(payer) : undefined,
    };
  }

  /** Delivery, affiliate, and admin Telegram (paid) — must not fail the pay response. */
  private runPostPaymentSideEffects(
    order: OrderDocument,
    userId: string,
  ): void {
    const orderId = String(order._id);
    const logCtx = order.orderNumber ?? orderId;

    void (async () => {
      await runIsolatedSideEffect(
        `Customer order confirmation for ${logCtx}`,
        this.logger,
        () => this.customerOrderMail.sendOrderConfirmedAfterPayment(order),
      );
      await runIsolatedSideEffect(
        `Admin Telegram (paid) for order ${logCtx}`,
        this.logger,
        () => this.telegramOrders.notifyAdminOrderStage(order, 'paid'),
      );
      await runIsolatedSideEffect(
        `Delivery enqueue for order ${logCtx}`,
        this.logger,
        () => this.enqueueDelivery(orderId),
      );
      await runIsolatedSideEffect(
        `Affiliate commission for order ${logCtx}`,
        this.logger,
        () => this.recordAffiliateCommission(order),
      );
      await runIsolatedSideEffect(
        `Guest finalize for order ${logCtx}`,
        this.logger,
        () => this.users.finalizeEphemeralGuest(userId, order.orderNumber),
      );
    })();
  }

  async list(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<OrderDocument>> {
    const filter = customerOrdersFilter(userId);
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          'orderNumber status pricing items deliveryMessage manualGiftCards deliveredAt payment createdAt',
        )
        .lean()
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    return {
      items: items.map((item) =>
        this.projectOrderSecrets(item, true),
      ) as unknown as OrderDocument[],
      total,
      page,
      limit,
    };
  }

  async getCustomerStats(userId: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    currency: string;
  }> {
    const filter = {
      userId: new Types.ObjectId(userId),
      status: {
        $nin: [OrderStatus.Cancelled, OrderStatus.Refunded, OrderStatus.Failed],
      },
    };

    const [totalOrders, aggregate] = await Promise.all([
      this.orderModel.countDocuments(filter).exec(),
      this.orderModel
        .aggregate<{ total: number; currency: string }>([
          { $match: filter },
          {
            $group: {
              _id: null,
              total: { $sum: '$pricing.total' },
              currency: { $first: '$pricing.currency' },
            },
          },
        ])
        .exec(),
    ]);

    return {
      totalOrders,
      totalSpent: aggregate[0]?.total ?? 0,
      currency: aggregate[0]?.currency ?? DEFAULT_CURRENCY,
    };
  }

  /** All delivered digital goods for the downloads library. */
  async listDownloads(userId: string) {
    const orders = await this.orderModel
      .find({
        userId: new Types.ObjectId(userId),
        status: OrderStatus.Delivered,
      })
      .sort({ createdAt: -1 })
      .select('orderNumber items createdAt')
      .lean()
      .exec();

    const downloads: Array<{
      orderId: string;
      orderNumber?: string;
      orderDate?: Date;
      productId: string;
      title: string;
      slug: string;
      quantity: number;
      codes: Array<{ code: string; serial?: string; pin?: string }>;
    }> = [];

    for (const order of orders) {
      for (const item of order.items ?? []) {
        if (!item.deliveredCodes?.length) continue;
        downloads.push({
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          orderDate: order.createdAt,
          productId: String(item.productId),
          title: item.title,
          slug: item.slug,
          quantity: item.quantity,
          codes: item.deliveredCodes.map((c) =>
            this.crypto.openDeliveredSecret({
              code: c.code,
              serial: c.serial,
              pin: c.pin,
            }),
          ),
        });
      }
    }

    return { items: downloads, total: downloads.length };
  }

  /** Admin/support listing across all users with optional filters. */
  async adminList(filters: {
    status?: OrderStatus;
    q?: string;
    page: number;
    limit: number;
    user: AuthenticatedUser;
  }): Promise<PaginatedResult<OrderDocument>> {
    const { status, q, page, limit, user } = filters;
    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status;
    } else {
      // "All orders" view excludes trashed (failed) orders so they only appear
      // in the dedicated Trash tab.
      filter.status = { $ne: OrderStatus.Failed };
    }
    const searchOr = await this.buildAdminOrderSearchOr(q);
    if (searchOr) {
      filter.$or = searchOr;
    }
    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    const reveal = shouldRevealDeliveredCodes(user);
    return {
      items: items.map((item) => this.presentOrderSecrets(item, reveal)) as unknown as OrderDocument[],
      total,
      page,
      limit,
    };
  }

  /**
   * Builds a MongoDB `$or` array for admin order search.
   * Returns null when no search term is provided.
   */
  private async buildAdminOrderSearchOr(
    q?: string,
  ): Promise<Record<string, unknown>[] | null> {
    const term = q?.trim();
    if (!term) return null;

    const rx = escapeRegex(term);
    const rxOpts = { $regex: rx, $options: 'i' };
    const or: Record<string, unknown>[] = [
      { orderNumber: rxOpts },
      { 'contact.mobile': rxOpts },
      { 'contact.email': rxOpts },
    ];

    // Also match phone numbers when the user omits spaces/dashes.
    const phoneDigits = term.replace(/\D/g, '');
    if (phoneDigits.length >= 4 && phoneDigits !== term) {
      or.push({
        'contact.mobile': {
          $regex: escapeRegex(phoneDigits),
          $options: 'i',
        },
      });
    }

    // Redeem codes, customer notes, and line item titles (product names).
    if (term.length >= 2) {
      or.push(
        { deliveryMessage: rxOpts },
        { 'items.title': rxOpts },
        { 'manualGiftCards.code': rxOpts },
        { 'items.deliveredCodes.code': rxOpts },
        { 'items.deliveredCodes.serial': rxOpts },
        { 'items.deliveredCodes.pin': rxOpts },
      );
    }

    const lookupTasks: Promise<void>[] = [];

    // Registered customer lookup — only for meaningful terms.
    const looksLikePhone = phoneDigits.length >= 4;
    const looksLikeEmail = term.includes('@');
    if (term.length >= 2 || looksLikePhone || looksLikeEmail) {
      lookupTasks.push(
        this.userModel
          .find({
            $or: [
              { phone: rxOpts },
              { email: rxOpts },
              ...(term.length >= 2
                ? [
                    { 'profile.firstName': rxOpts },
                    { 'profile.lastName': rxOpts },
                    { 'profile.displayName': rxOpts },
                  ]
                : []),
            ],
          })
          .select('_id')
          .limit(200)
          .lean()
          .exec()
          .then((matchedUsers) => {
            if (matchedUsers.length) {
              or.push({ userId: { $in: matchedUsers.map((u) => u._id) } });
            }
          }),
      );
    }

    // Payment transaction IDs (MFS TrxID + gateway ref).
    if (term.length >= 4) {
      lookupTasks.push(
        this.paymentIntentModel
          .find({
            orderId: { $type: 'objectId' },
            $or: [{ submittedTrxId: rxOpts }, { gatewayRef: rxOpts }],
          })
          .select('orderId')
          .limit(200)
          .lean()
          .exec()
          .then((matchedIntents) => {
            const orderIds = matchedIntents
              .map((i) => i.orderId)
              .filter((id): id is Types.ObjectId => Boolean(id));
            if (orderIds.length) {
              or.push({ _id: { $in: orderIds } });
            }
          }),
      );
    }

    // Product catalog lookup — match orders containing products whose title/slug matches.
    if (term.length >= 2) {
      lookupTasks.push(
        this.productModel
          .find({
            $or: [
              { title: rxOpts },
              { titleNormalized: rxOpts },
              { slug: rxOpts },
            ],
          })
          .select('_id')
          .limit(200)
          .lean()
          .exec()
          .then((matchedProducts) => {
            if (matchedProducts.length) {
              or.push({
                'items.productId': {
                  $in: matchedProducts.map((p) => p._id),
                },
              });
            }
          }),
      );
    }

    if (lookupTasks.length) {
      await Promise.all(lookupTasks);
    }

    return or;
  }

  async getOne(user: AuthenticatedUser, orderId: string): Promise<OrderDocument> {
    const trimmed = orderId.trim();
    let order: OrderDocument | null = null;

    if (Types.ObjectId.isValid(trimmed)) {
      order = await this.orderModel.findById(trimmed).exec();
    }
    if (!order) {
      order = await this.orderModel.findOne({ orderNumber: trimmed }).exec();
    }
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    assertCanReadCustomerOrder(user, order);
    const isStaff = isChatStaff(user.roles);
    const isAdmin = shouldRevealDeliveredCodes(user);
    if (!isStaff) {
      return this.presentOrderSecrets(order, true) as OrderDocument;
    }

    const plain = this.presentOrderSecrets(order, isAdmin) as OrderDocument & {
      payment?: Record<string, unknown>;
    };
    if (!isAdmin) {
      return plain as OrderDocument;
    }

    const mfs = await this.resolveMfsPaymentDetails(
      String(order._id),
      order.contact?.mobile,
    );
    return {
      ...plain,
      payment: {
        ...(plain.payment ?? {}),
        ...(mfs ? { mfs } : {}),
      },
    } as OrderDocument;
  }

  private presentOrderSecrets(order: OrderDocument, revealCodes: boolean) {
    return this.projectOrderSecrets(order.toObject(), revealCodes);
  }

  private projectOrderSecrets<
    T extends {
      items?: Array<{ deliveredCodes?: Array<{ code: string; serial?: string; pin?: string }> }>;
      manualGiftCards?: Array<{ code: string }>;
    },
  >(plain: T, revealCodes: boolean): T {
    return {
      ...plain,
      items: (plain.items ?? []).map((item) => ({
        ...item,
        deliveredCodes: (item.deliveredCodes ?? []).map((code) =>
          revealCodes
            ? this.crypto.openDeliveredSecret(code)
            : this.crypto.redactDeliveredSecret(),
        ),
      })),
      ...(plain.manualGiftCards
        ? {
            manualGiftCards: plain.manualGiftCards.map((card) => ({
              ...card,
              code: revealCodes
                ? this.crypto.openDeliveredSecret({ code: card.code }).code
                : '••••',
            })),
          }
        : {}),
    };
  }

  /** MFS checkout verification fields for admin order view (Sender, TrxID, Amount). */
  private async resolveMfsPaymentDetails(
    orderId: string,
    contactMobile?: string,
  ): Promise<
    | {
        sender?: string;
        trxId?: string;
        amount?: number;
        senderMobile?: string;
      }
    | undefined
  > {
    const intent = await this.paymentIntentModel
      .findOne({
        orderId: new Types.ObjectId(orderId),
        gateway: PaymentGateway.Mfs,
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    if (!intent) return undefined;

    let trxId = intent.submittedTrxId?.trim();
    let sender: string | undefined;
    let amount: number | undefined = intent.amount;

    const matchedSms = await this.smsLogModel
      .findOne({ matchedPaymentIntentId: intent._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (matchedSms) {
      sender = matchedSms.sender?.trim() || undefined;
      if (matchedSms.trxId?.trim()) {
        trxId = matchedSms.trxId.trim();
      }
      if (matchedSms.amount !== undefined) {
        amount = matchedSms.amount;
      }
    }

    let senderMobile: string | undefined;

    if (matchedSms?.body) {
      senderMobile = parseMfsCustomerMobileFromSmsBody(matchedSms.body);
    } else if (trxId) {
      const smsByTrx = await this.smsLogModel
        .findOne({ trxId })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      if (smsByTrx) {
        if (!sender) {
          sender = smsByTrx.sender?.trim() || undefined;
        }
        if (smsByTrx.amount !== undefined) {
          amount = smsByTrx.amount;
        }
        if (smsByTrx.body) {
          senderMobile = parseMfsCustomerMobileFromSmsBody(smsByTrx.body);
        }
      }
    }

    if (!senderMobile && contactMobile?.trim()) {
      senderMobile = contactMobile.trim();
    }

    return {
      sender,
      trxId,
      amount,
      senderMobile,
    };
  }

  /** Admin/support manual status transitions (e.g., manual delivery). */
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    note?: string,
    deliveryMessage?: string,
    emailChannel?: EmailSenderChannel,
    giftCards?: ManualGiftCardDto[],
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    switch (status) {
      case OrderStatus.Delivered: {
        const wasAlreadyDelivered = order.status === OrderStatus.Delivered;
        const message = deliveryMessage?.trim();
        const normalizedGiftCards = this.normalizeManualGiftCards(giftCards);
        if (normalizedGiftCards.length > 0) {
          await this.syncManualDeliveryInventory(order, normalizedGiftCards);
          this.applyManualGiftCards(order, normalizedGiftCards);
        }
        if (message) {
          order.deliveryMessage = message;
        }
        await this.finalizeDelivery(order, true, message);
        if (!wasAlreadyDelivered) {
          const emailMessage = this.buildEmailMessageFromDeliveredOrder(
            order,
            message,
          );
          runIsolatedSideEffectVoid(
            `Order confirmed notifications for ${order.orderNumber}`,
            this.logger,
            () =>
              this.notifyOrderConfirmed(order, emailChannel, emailMessage),
          );
        }
        break;
      }
      case OrderStatus.Cancelled:
        if (
          order.status === OrderStatus.Delivered ||
          order.status === OrderStatus.Refunded
        ) {
          throw new BadRequestException('Order can no longer be cancelled');
        }
        // Skip stock release if already in a terminal released state to avoid
        // double-release that would corrupt stock counts.
        if (
          order.status !== OrderStatus.Cancelled &&
          order.status !== OrderStatus.Failed
        ) {
          await this.releaseOrderStock(order);
        }
        order.status = OrderStatus.Cancelled;
        this.appendTimelineEntry(order, OrderStatus.Cancelled, note);
        await order.save();
        await this.notifyCustomerOrderEmail(order, 'cancelled', note);
        break;
      case OrderStatus.Failed:
        if (
          order.status === OrderStatus.Delivered ||
          order.status === OrderStatus.Refunded
        ) {
          throw new BadRequestException('Order can no longer be moved to trash');
        }
        // Only release stock if it hasn't already been released (cancelled orders
        // already had their stock released; releasing again would corrupt stock counts).
        if (
          order.status !== OrderStatus.Cancelled &&
          order.status !== OrderStatus.Failed
        ) {
          await this.releaseOrderStock(order);
        }
        order.status = OrderStatus.Failed;
        this.appendTimelineEntry(order, OrderStatus.Failed, note);
        await order.save();
        break;
      case OrderStatus.Processing:
        if (order.status === OrderStatus.Delivered) {
          await this.reopenManualDeliveryOrder(order);
        }
        order.status = OrderStatus.Processing;
        this.appendTimelineEntry(order, OrderStatus.Processing, note);
        await order.save();
        this.notifyCustomerOrderEmail(order, 'processing', note, emailChannel);
        break;
      case OrderStatus.Refunded: {
        if (order.status === OrderStatus.Refunded) {
          break;
        }
        if (
          ![
            OrderStatus.Paid,
            OrderStatus.Processing,
            OrderStatus.Delivered,
          ].includes(order.status)
        ) {
          throw new BadRequestException('Order is not refundable');
        }
        await this.processRefund(String(order._id), note);
        const refunded = await this.orderModel.findById(orderId).exec();
        if (!refunded) {
          throw new NotFoundException('Order not found');
        }
        void this.cache.del(CacheKeys.admin.dashboardOverview);
        return refunded;
      }
      default:
        throw new BadRequestException(
          `Status ${status} cannot be set manually`,
        );
    }
    void this.cache.del(CacheKeys.admin.dashboardOverview);
    return order;
  }

  /** Permanently delete an order — removed from admin and customer views. */
  async adminDeleteOrder(orderId: string): Promise<{ deleted: boolean }> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (
      order.status === OrderStatus.Delivered ||
      order.status === OrderStatus.Refunded
    ) {
      throw new BadRequestException(
        'Delivered or refunded orders cannot be deleted',
      );
    }
    if (
      order.status !== OrderStatus.Cancelled &&
      order.status !== OrderStatus.Failed
    ) {
      await this.releaseOrderStock(order);
    }
    try {
      await this.ordersQueue.remove(`expire:${String(order._id)}`);
    } catch {
      /* queue job may already be gone */
    }
    await this.orderModel.deleteOne({ _id: order._id }).exec();
    void this.cache.del(CacheKeys.admin.dashboardOverview);
    return { deleted: true };
  }

  /** Restore a trashed (failed) order to its prior workflow status and re-hold stock. */
  async adminRestoreOrder(orderId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.Failed) {
      throw new BadRequestException('Only trashed orders can be restored');
    }

    const targetStatus = this.resolveRestoreStatus(order);
    const reservations: Reservation[] = [];

    try {
      for (const item of order.items) {
        if (item.delivered || (item.inventoryItemIds?.length ?? 0) > 0) {
          continue;
        }
        const reservation = await this.reserveLine(order._id, {
          productId: String(item.productId),
          title: item.title,
          slug: item.slug,
          variationValueId: item.variationValueId,
          customerInputs: item.customerInputs ?? [],
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          availableStock: 0,
        });
        reservations.push(reservation);
        item.inventoryItemIds = reservation.inventoryItemIds;
        item.deliveryType = reservation.deliveryType;
      }
    } catch (error) {
      await Promise.all(reservations.map((r) => this.releaseReservation(r)));
      throw error;
    }

    order.status = targetStatus;
    this.appendTimelineEntry(order, targetStatus, 'Restored from trash');
    await order.save();
    void this.cache.del(CacheKeys.admin.dashboardOverview);
    return order;
  }

  private resolveRestoreStatus(order: OrderDocument): OrderStatus {
    const restorable = new Set<OrderStatus>([
      OrderStatus.Processing,
      OrderStatus.Paid,
    ]);
    const timeline = order.timeline ?? [];

    let index = timeline.length - 1;
    while (index >= 0 && timeline[index]?.status === OrderStatus.Failed) {
      index -= 1;
    }
    while (index >= 0) {
      const status = timeline[index]?.status;
      if (status && restorable.has(status)) {
        return status;
      }
      index -= 1;
    }

    if (order.payment?.status === PaymentStatus.Paid) {
      return OrderStatus.Paid;
    }
    return OrderStatus.Processing;
  }

  /**
   * Save a customer-facing note and send it via email without changing the
   * order status. Uses the dedicated `order.customer_note` email template so
   * the note is always prominently displayed regardless of custom template
   * configuration.
   */
  async sendNote(
    orderId: string,
    message: string,
    emailChannel?: EmailSenderChannel,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (
      order.status === OrderStatus.Cancelled ||
      order.status === OrderStatus.Refunded ||
      order.status === OrderStatus.Failed
    ) {
      throw new BadRequestException('Order can no longer be updated');
    }

    const trimmed = message.trim();
    if (!trimmed) {
      throw new BadRequestException('Note message cannot be empty');
    }

    order.deliveryMessage = trimmed;
    this.appendTimelineEntry(order, order.status, trimmed);
    await order.save();

    try {
      await this.customerOrderMail.sendOrderNote(order, trimmed, emailChannel);
    } catch (err) {
      this.logger.error(
        `Customer order note email failed for ${order.orderNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    try {
      await this.dispatcher.dispatch(
        NotificationEvent.OrderNote,
        order.userId,
        {
          orderNumber: order.orderNumber,
          orderId: String(order._id),
          message: trimmed,
          emailChannel,
        },
      );
    } catch (err) {
      this.logger.error(
        `Order note in-app notification failed for ${order.orderNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return order;
  }

  /** Persist manual gift cards and optional note without completing the order. */
  async saveManualDelivery(
    orderId: string,
    dto: SaveManualDeliveryDto,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (
      order.status === OrderStatus.Cancelled ||
      order.status === OrderStatus.Refunded ||
      order.status === OrderStatus.Failed
    ) {
      throw new BadRequestException('Order can no longer be updated');
    }

    const giftCards = this.normalizeManualGiftCards(dto.giftCards);
    if (giftCards.length > 0) {
      await this.syncManualDeliveryInventory(order, giftCards);
      this.applyManualGiftCards(order, giftCards);
    } else {
      await this.syncManualDeliveryInventory(order, []);
    }

    const message = dto.deliveryMessage?.trim();
    if (message) {
      order.deliveryMessage = message;
    }

    await order.save();
    return order;
  }

  async requestRefund(
    orderId: string,
    reason?: string,
  ): Promise<{ queued: boolean }> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (
      ![
        OrderStatus.Paid,
        OrderStatus.Processing,
        OrderStatus.Delivered,
      ].includes(order.status)
    ) {
      throw new BadRequestException('Order is not refundable');
    }
    try {
      await this.ordersQueue.add(OrderJob.Refund, {
        orderId: String(order._id),
        reason,
      });
    } catch (queueError) {
      // Queue unavailable: process the refund synchronously.
      this.logger.warn(
        `Refund queue unavailable for order ${String(order._id)}, refunding synchronously: ${
          queueError instanceof Error ? queueError.message : String(queueError)
        }`,
      );
      await this.processRefund(String(order._id), reason);
    }
    return { queued: true };
  }

  // --- Worker handlers (invoked by OrderProcessor) ---

  async processFulfillment(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.status === OrderStatus.Delivered) {
      return;
    }
    if (
      order.status !== OrderStatus.Paid &&
      order.status !== OrderStatus.Processing
    ) {
      return;
    }

    await this.redeemPromotions(order);
    await this.finalizeDelivery(order, false);
    await runIsolatedSideEffect(
      `Admin Telegram after fulfillment for ${order.orderNumber}`,
      this.logger,
      () => this.notifyAdminTelegramAfterAutoFulfillment(order),
    );
    if (this.canAutoCompleteDeliveredOrder(order)) {
      const emailMessage = this.buildEmailMessageFromDeliveredOrder(order);
      await this.notifyOrderConfirmed(order, undefined, emailMessage);
    } else {
      this.notifyCustomerOrderEmail(order, 'processing');
    }
  }

  /**
   * Concludes an order delivered entirely by suppliers: redeems promotions,
   * finalizes status, and notifies. Idempotent across delivery retries.
   */
  async concludeSupplierDelivery(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.status === OrderStatus.Delivered) {
      return;
    }
    if (
      order.status !== OrderStatus.Paid &&
      order.status !== OrderStatus.Processing
    ) {
      return;
    }
    await this.redeemPromotions(order);
    const allDelivered = order.items.every((item) => item.delivered);
    this.applyAutoFulfillmentStatus(
      order,
      allDelivered ? 'Supplier auto-delivery complete' : undefined,
    );
    await order.save();
    await runIsolatedSideEffect(
      `Admin Telegram after supplier delivery for ${order.orderNumber}`,
      this.logger,
      () => this.notifyAdminTelegramAfterAutoFulfillment(order),
    );
    if (this.canAutoCompleteDeliveredOrder(order)) {
      const emailMessage = this.buildEmailMessageFromDeliveredOrder(order);
      await this.notifyOrderConfirmed(order, undefined, emailMessage);
    } else {
      this.notifyCustomerOrderEmail(order, 'processing');
    }
  }

  /** Redeems coupon/voucher once per order (guarded for retry safety). */
  async redeemPromotions(order: OrderDocument): Promise<void> {
    if (order.promotionsRedeemed) {
      return;
    }
    if (order.pricing.couponCode) {
      await this.coupons.redeem(order.pricing.couponCode);
    }
    if (order.pricing.voucherCode) {
      await this.vouchers.redeem(
        order.pricing.voucherCode,
        String(order.userId),
        order._id,
      );
    }
    order.promotionsRedeemed = true;
  }

  /** Customer email (delivered) + in-app when admin manually confirms — no admin Telegram. */
  private async notifyOrderConfirmed(
    order: OrderDocument,
    emailChannel?: EmailSenderChannel,
    emailMessage?: string,
  ): Promise<void> {
    try {
      await this.customerOrderMail.trySendStatusEmail(
        order,
        'delivered',
        emailMessage,
        emailChannel,
      );
    } catch (err) {
      this.logger.error(
        `Customer delivered email failed for ${order.orderNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    try {
      await this.dispatcher.dispatch(
        NotificationEvent.OrderDelivered,
        order.userId,
        {
          orderNumber: order.orderNumber,
          orderId: String(order._id),
          deliveryMessage: emailMessage ?? order.deliveryMessage,
        },
      );
    } catch (err) {
      this.logger.error(
        `Order delivered in-app notification failed for ${order.orderNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private notifyCustomerOrderEmail(
    order: OrderDocument,
    status: CustomerOrderEmailStatus,
    message?: string,
    emailChannel?: EmailSenderChannel,
  ): void {
    void this.customerOrderMail
      .trySendStatusEmail(order, status, message, emailChannel)
      .catch((err) => {
        this.logger.error(
          `Customer ${status} email failed for ${order.orderNumber}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
  }

  /** Customer payment-failed email for order checkout intents. */
  async notifyPaymentFailed(
    intent: PaymentIntentDocument,
    reason: string,
  ): Promise<void> {
    if (!intent.orderId) {
      return;
    }
    const order = await this.orderModel.findById(intent.orderId).exec();
    if (!order) {
      return;
    }
    await this.customerOrderMail.sendPaymentFailed(order, reason);
  }

  /** Admin Telegram when auto/supplier fulfillment completes — not on new-order paid. */
  private async notifyAdminTelegramAfterAutoFulfillment(
    order: OrderDocument,
  ): Promise<void> {
    const allDelivered = order.items.every((item) => item.delivered);
    if (!allDelivered) {
      return;
    }

    const fresh = await this.orderModel
      .findById(order._id)
      .select('adminTelegram.paidNotifiedAt')
      .lean()
      .exec();
    const paidNotifiedAt = fresh?.adminTelegram?.paidNotifiedAt;
    if (
      paidNotifiedAt &&
      Date.now() - new Date(paidNotifiedAt).getTime() < 2 * 60 * 1000
    ) {
      return;
    }

    await this.notifyAdminTelegramOrderStage(order, 'fulfilled');
  }

  private notifyAdminTelegramOrderStage(
    order: OrderDocument,
    stage: AdminOrderTelegramStage,
  ): void {
    void this.telegramOrders.notifyAdminOrderStage(order, stage).catch((err) => {
      this.logger.warn(
        `Admin Telegram ${stage} alert failed for ${order.orderNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  private async recordAffiliateCommission(order: OrderDocument): Promise<void> {
    await this.affiliate.recordCommissionForOrder({
      orderId: String(order._id),
      userId: order.userId,
      total: order.pricing.total,
      currency: order.pricing.currency,
    });
  }

  private async enqueueDelivery(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).select('userId').lean().exec();
    if (!order?.userId) {
      return;
    }

    const allowed = await this.rolePermissions.userIdHasPermission(
      order.userId,
      'auto_delivery',
    );
    if (!allowed) {
      this.logger.log(
        `Auto delivery skipped for order ${orderId} (user role lacks auto_delivery permission)`,
      );
      return;
    }

    try {
      await this.deliveryQueue.add(
        DeliveryJob.Deliver,
        { orderId },
        { ...DELIVERY_JOB_OPTIONS, jobId: `deliver:${orderId}` },
      );
    } catch (queueError) {
      // Queue unavailable (e.g. Redis offline): deliver from local inventory
      // synchronously so paid orders are still fulfilled.
      this.logger.warn(
        `Delivery queue unavailable for order ${orderId}, fulfilling synchronously: ${
          queueError instanceof Error ? queueError.message : String(queueError)
        }`,
      );
      await this.processFulfillment(orderId);
    }
  }

  async processExpiration(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.status !== OrderStatus.Pending) {
      return;
    }
    await this.releaseOrderStock(order);
    order.status = OrderStatus.Cancelled;
    this.appendTimelineEntry(
      order,
      OrderStatus.Cancelled,
      'Payment window expired',
    );
    await order.save();
    await this.notifyCustomerOrderEmail(
      order,
      'cancelled',
      'Payment window expired',
    );
  }
  async updatePendingOrderItemQuantity(
    userId: string,
    intentId: string,
    itemIndex: number,
    quantity: number,
  ): Promise<{ cancelled: boolean }> {
    const intent = await this.requireEditablePaymentIntent(userId, intentId);
    const order = await this.getOwnedPendingOrder(userId, intent.orderId);
    if (itemIndex < 0 || itemIndex >= order.items.length) {
      throw new BadRequestException('Invalid cart item');
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    const item = order.items[itemIndex];
    if (!item) {
      throw new BadRequestException('Invalid cart item');
    }
    if (quantity === item.quantity) {
      return { cancelled: false };
    }

    const delta = quantity - item.quantity;
    if (delta < 0) {
      await this.releaseOrderItemStock(item, -delta);
    } else {
      const reservation = await this.reserveLine(order._id, {
        productId: String(item.productId),
        title: item.title,
        slug: item.slug,
        variationValueId: item.variationValueId,
        quantity: delta,
        unitPrice: item.unitPrice,
        lineTotal: round2(item.unitPrice * delta),
        availableStock: 0,
      });
      item.inventoryItemIds = [
        ...(item.inventoryItemIds ?? []),
        ...reservation.inventoryItemIds,
      ];
    }

    item.quantity = quantity;
    item.lineTotal = round2(item.unitPrice * quantity);
    await this.recalculatePendingPricing(order);
    await order.save();
    await this.syncPaymentIntentForOrder(order);
    return { cancelled: false };
  }

  /** Remove a line from a pending unpaid order during MFS checkout. */
  async removePendingOrderItem(
    userId: string,
    intentId: string,
    itemIndex: number,
  ): Promise<{ cancelled: boolean }> {
    const intent = await this.requireEditablePaymentIntent(userId, intentId);
    const order = await this.getOwnedPendingOrder(userId, intent.orderId);
    if (itemIndex < 0 || itemIndex >= order.items.length) {
      throw new BadRequestException('Invalid cart item');
    }

    const item = order.items[itemIndex];
    if (!item) {
      throw new BadRequestException('Invalid cart item');
    }
    await this.releaseOrderItemStock(item, item.quantity);
    order.items.splice(itemIndex, 1);

    if (order.items.length === 0) {
      order.status = OrderStatus.Cancelled;
      this.appendTimelineEntry(
        order,
        OrderStatus.Cancelled,
        'All items removed before payment',
      );
      await order.save();
      await this.expirePaymentIntentsForOrder(order._id);
      await this.notifyCustomerOrderEmail(
        order,
        'cancelled',
        'All items removed before payment',
      );
      return { cancelled: true };
    }

    await this.recalculatePendingPricing(order);
    await order.save();
    await this.syncPaymentIntentForOrder(order);
    return { cancelled: false };
  }

  async processRefund(orderId: string, reason?: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      return;
    }

    // Idempotency guard: a refund may be retried by the queue or fall back to a
    // synchronous run. Without this, stock/affiliate reversals would be applied
    // multiple times (the wallet credit is already protected by its key).
    if (order.status === OrderStatus.Refunded) {
      return;
    }

    // Only orders whose payment actually settled should be credited back. This
    // keeps cancellations of unpaid orders from minting wallet balance.
    const wasPaid = order.payment.status === PaymentStatus.Paid;

    for (const item of order.items) {
      if (item.inventoryItemIds.length > 0) {
        await this.inventoryModel
          .updateMany(
            { _id: { $in: item.inventoryItemIds } },
            { $set: { status: InventoryStatus.Disabled } },
          )
          .exec();
      }
      const decrement = item.delivered
        ? { 'stock.sold': -item.quantity }
        : { 'stock.reserved': -item.quantity };
      await this.productModel
        .updateOne({ _id: item.productId }, { $inc: decrement })
        .exec();
    }

    order.status = OrderStatus.Refunded;
    order.payment.status = PaymentStatus.Refunded;
    order.refund = {
      reason,
      amount: order.pricing.total,
      refundedAt: new Date(),
    };
    this.appendTimelineEntry(order, OrderStatus.Refunded, reason);
    await order.save();

    if (wasPaid) {
      // Refund is issued as wallet credit (store credit) for every paid method.
      // The idempotency key guarantees a single credit even on retries.
      await this.wallet.refund({
        userId: order.userId,
        amount: order.pricing.total,
        reference: { type: 'order', id: order._id },
        idempotencyKey: `refund:${String(order._id)}`,
        description: `Refund for order ${order.orderNumber}`,
        notify: false,
      });
    }

    await this.affiliate.reverseCommissionForOrder(String(order._id));

    await this.notifyCustomerOrderEmail(order, 'refunded', reason);

    await this.dispatcher.dispatch(
      NotificationEvent.OrderRefunded,
      order.userId,
      {
        orderNumber: order.orderNumber,
        orderId: String(order._id),
        amount: order.pricing.total,
        currency: order.pricing.currency,
      },
    );
  }

  // --- Internals ---

  private async requireEditablePaymentIntent(
    userId: string,
    intentId: string,
  ): Promise<PaymentIntentDocument> {
    const intent = await this.paymentIntentModel.findById(intentId).exec();
    if (!intent) {
      throw new NotFoundException('Payment session not found');
    }
    if (String(intent.userId) !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (
      intent.status === PaymentIntentStatus.Succeeded ||
      intent.status === PaymentIntentStatus.Failed ||
      intent.status === PaymentIntentStatus.Expired ||
      intent.status === PaymentIntentStatus.Unmatched ||
      intent.status === PaymentIntentStatus.Superseded
    ) {
      throw new BadRequestException('Payment is already finalized');
    }
    if (!intent.orderId) {
      throw new BadRequestException('This payment session cannot be modified');
    }
    return intent;
  }

  private async getOwnedPendingOrder(
    userId: string,
    orderId?: Types.ObjectId,
  ): Promise<OrderDocument> {
    if (!orderId) {
      throw new BadRequestException('Order not found');
    }
    const order = await this.getOwned(userId, String(orderId));
    if (order.status !== OrderStatus.Pending) {
      throw new BadRequestException('Order can no longer be modified');
    }
    if (order.payment.status !== PaymentStatus.Pending) {
      throw new BadRequestException('Order payment is already processing');
    }
    return order;
  }

  private async recalculatePendingPricing(order: OrderDocument): Promise<void> {
    const subtotal = round2(
      order.items.reduce((sum, line) => sum + line.lineTotal, 0),
    );
    const userId = String(order.userId);

    let couponDiscount = 0;
    if (order.pricing.couponCode) {
      const evaluation = await this.coupons.evaluate(
        order.pricing.couponCode,
        subtotal,
        userId,
      );
      if (!evaluation.valid) {
        throw new BadRequestException(
          evaluation.reason ?? 'Applied coupon is no longer valid',
        );
      }
      couponDiscount = evaluation.discount;
    }

    let voucherDiscount = 0;
    if (order.pricing.voucherCode) {
      const evaluation = await this.vouchers.evaluate(
        order.pricing.voucherCode,
        userId,
      );
      if (!evaluation.valid) {
        throw new BadRequestException(
          evaluation.reason ?? 'Applied voucher is no longer valid',
        );
      }
      voucherDiscount = round2(
        Math.min(evaluation.amount, Math.max(0, subtotal - couponDiscount)),
      );
    }

    const discountTotal = round2(couponDiscount + voucherDiscount);
    order.pricing.subtotal = subtotal;
    order.pricing.couponDiscount = couponDiscount;
    order.pricing.voucherDiscount = voucherDiscount;
    order.pricing.discountTotal = discountTotal;
    order.pricing.total = round2(Math.max(0, subtotal - discountTotal));
  }

  private async syncPaymentIntentForOrder(order: OrderDocument): Promise<void> {
    await this.paymentIntentModel
      .updateMany(
        {
          orderId: order._id,
          status: {
            $nin: [
              PaymentIntentStatus.Succeeded,
              PaymentIntentStatus.Failed,
              PaymentIntentStatus.Expired,
              PaymentIntentStatus.Unmatched,
              PaymentIntentStatus.Superseded,
              PaymentIntentStatus.Initializing,
            ],
          },
        },
        {
          $set: {
            amount: order.pricing.total,
            status: PaymentIntentStatus.Created,
          },
          $unset: { mfsGatewayId: '', submittedTrxId: '' },
        },
      )
      .exec();
  }

  private async expirePaymentIntentsForOrder(
    orderId: Types.ObjectId,
  ): Promise<void> {
    await this.paymentIntentModel
      .updateMany(
        {
          orderId,
          $or: [
            {
              status: {
                $in: [
                  PaymentIntentStatus.Pending,
                  PaymentIntentStatus.Initializing,
                ],
              },
            },
            {
              status: PaymentIntentStatus.Created,
              gatewayRef: { $exists: true, $nin: [null, ''] },
            },
            {
              status: PaymentIntentStatus.Created,
              chargeLeaseUntil: { $exists: true, $ne: null },
            },
          ],
        },
        {
          $set: {
            status: PaymentIntentStatus.Superseded,
            lastError: 'Order cancelled or replaced',
          },
          $unset: { activeOrderSlot: 1, expiresAt: 1, chargeLeaseUntil: 1 },
        },
      )
      .exec();
    await this.paymentIntentModel
      .updateMany(
        {
          orderId,
          status: PaymentIntentStatus.Created,
        },
        {
          $set: { status: PaymentIntentStatus.Expired },
          $unset: { activeOrderSlot: 1 },
        },
      )
      .exec();
  }

  private async releaseOrderItemStock(
    item: OrderDocument['items'][number],
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) {
      return;
    }
    if (quantity > item.quantity) {
      throw new BadRequestException('Invalid quantity');
    }

    const inventoryIds = item.inventoryItemIds ?? [];
    if (inventoryIds.length > 0) {
      const idsToRelease =
        quantity >= inventoryIds.length
          ? inventoryIds
          : inventoryIds.slice(inventoryIds.length - quantity);
      await this.releaseReservation({
        productId: item.productId,
        quantity: idsToRelease.length,
        deliveryType: item.deliveryType,
        inventoryItemIds: idsToRelease,
      });
      item.inventoryItemIds =
        quantity >= inventoryIds.length
          ? []
          : inventoryIds.slice(0, inventoryIds.length - quantity);
      return;
    }

    if (item.variationValueId) {
      const product = await this.productModel.findById(item.productId).lean();
      if (product) {
        const stock = resolveLineStock(product, item.variationValueId);
        if (stock.manualVariation) {
          await this.releaseReservation({
            productId: item.productId,
            quantity,
            deliveryType: DeliveryType.Manual,
            inventoryItemIds: [],
            variationValueId: item.variationValueId,
            manualVariation: true,
          });
          return;
        }
      }
    }

    await this.releaseReservation({
      productId: item.productId,
      quantity,
      deliveryType: item.deliveryType,
      inventoryItemIds: [],
    });
  }

  private async assertPaymentMethodAllowed(method: PaymentMethod): Promise<void> {
    const checkout = (await this.customerPanel.getConfig()).checkout;
    const allowed =
      (method === PaymentMethod.Wallet && checkout.walletEnabled) ||
      (method === PaymentMethod.Gateway && checkout.gatewayEnabled) ||
      (method === PaymentMethod.Manual && checkout.manualEnabled);
    if (!allowed) {
      throw new BadRequestException('Selected payment method is not available');
    }
  }

  private async reserveStock(
    orderId: Types.ObjectId,
    lines: CartLineItem[],
  ): Promise<Reservation[]> {
    const reservations: Reservation[] = [];
    try {
      for (const line of lines) {
        const reservation = await this.reserveLine(orderId, line);
        reservations.push(reservation);
      }
      return reservations;
    } catch (error) {
      await Promise.all(reservations.map((r) => this.releaseReservation(r)));
      throw error;
    }
  }

  private async reserveLine(
    orderId: Types.ObjectId,
    line: CartLineItem,
  ): Promise<Reservation> {
    const productId = new Types.ObjectId(line.productId);
    const product = await this.productModel.findById(productId).exec();
    if (!product || product.status !== ProductStatus.Active) {
      throw new BadRequestException(`Product ${line.title} is unavailable`);
    }

    const stockInfo = resolveLineStock(product, line.variationValueId);
    if (stockInfo.manualVariation && stockInfo.variationValueId) {
      return this.reserveManualVariationStock(
        productId,
        line.quantity,
        stockInfo.variationValueId,
        line.title,
      );
    }

    if (product.deliveryType === DeliveryType.Auto || stockInfo.usesInventory) {
      const inventoryFilter: {
        productId: Types.ObjectId;
        status: InventoryStatus;
        variationValueId?: string;
      } = {
        productId,
        status: InventoryStatus.Available,
      };
      if (stockInfo.variationValueId) {
        inventoryFilter.variationValueId = stockInfo.variationValueId;
      }

      const claimed: Types.ObjectId[] = [];
      for (let i = 0; i < line.quantity; i++) {
        const item = await this.inventoryModel
          .findOneAndUpdate(
            inventoryFilter,
            { $set: { status: InventoryStatus.Reserved, orderId } },
            { new: true },
          )
          .exec();
        if (!item) {
          break;
        }
        claimed.push(item._id);
      }
      if (claimed.length < line.quantity) {
        await this.inventoryModel
          .updateMany(
            { _id: { $in: claimed } },
            { $set: { status: InventoryStatus.Available }, $unset: { orderId: 1 } },
          )
          .exec();
        throw new BadRequestException(`Insufficient stock for ${line.title}`);
      }
      await this.productModel
        .updateOne(
          { _id: productId },
          {
            $inc: {
              'stock.available': -line.quantity,
              'stock.reserved': line.quantity,
            },
          },
        )
        .exec();
      return {
        productId,
        quantity: line.quantity,
        deliveryType: DeliveryType.Auto,
        inventoryItemIds: claimed,
      };
    }

    // Manual delivery: reserve against the cached counter atomically.
    const result = await this.productModel
      .updateOne(
        { _id: productId, 'stock.available': { $gte: line.quantity } },
        {
          $inc: {
            'stock.available': -line.quantity,
            'stock.reserved': line.quantity,
          },
        },
      )
      .exec();
    if (result.modifiedCount === 0) {
      throw new BadRequestException(`Insufficient stock for ${line.title}`);
    }
    return {
      productId,
      quantity: line.quantity,
      deliveryType: DeliveryType.Manual,
      inventoryItemIds: [],
    };
  }

  private async reserveManualVariationStock(
    productId: Types.ObjectId,
    quantity: number,
    variationValueId: string,
    title: string,
  ): Promise<Reservation> {
    const valueIds = [
      variationValueId,
      Number.isFinite(Number(variationValueId))
        ? Number(variationValueId)
        : null,
    ].filter((id): id is string | number => id !== null && id !== '');

    for (const valueId of valueIds) {
      const result = await this.productModel
        .updateOne(
          { _id: productId },
          {
            $inc: {
              'attributes.variations.$[v].manualStock': -quantity,
            },
          },
          {
            arrayFilters: [
              {
                'v.valueId': valueId,
                'v.stockType': 'manual',
                'v.manualStock': { $gte: quantity },
              },
            ],
          },
        )
        .exec();

      if (result.modifiedCount > 0) {
        return {
          productId,
          quantity,
          deliveryType: DeliveryType.Manual,
          inventoryItemIds: [],
          variationValueId,
          manualVariation: true,
        };
      }
    }

    throw new BadRequestException(`Insufficient stock for ${title}`);
  }

  private async releaseReservation(reservation: Reservation): Promise<void> {
    if ((reservation.inventoryItemIds?.length ?? 0) > 0) {
      await this.inventoryModel
        .updateMany(
          {
            _id: { $in: reservation.inventoryItemIds },
            status: InventoryStatus.Reserved,
          },
          { $set: { status: InventoryStatus.Available }, $unset: { orderId: 1 } },
        )
        .exec();
    }

    if (reservation.manualVariation && reservation.variationValueId) {
      await this.productModel
        .updateOne(
          { _id: reservation.productId },
          {
            $inc: {
              'attributes.variations.$[v].manualStock': reservation.quantity,
            },
          },
          {
            arrayFilters: [{ 'v.valueId': reservation.variationValueId }],
          },
        )
        .exec();
      return;
    }

    await this.productModel
      .updateOne(
        { _id: reservation.productId },
        {
          $inc: {
            'stock.available': reservation.quantity,
            'stock.reserved': -reservation.quantity,
          },
        },
      )
      .exec();
  }

  private async releaseOrderStock(order: OrderDocument): Promise<void> {
    await this.syncManualDeliveryInventory(order, []);
    for (const item of order.items) {
      if (item.delivered) {
        continue;
      }
      await this.releaseReservation({
        productId: item.productId,
        quantity: item.quantity,
        deliveryType: item.deliveryType,
        inventoryItemIds: item.inventoryItemIds ?? [],
      });
    }
  }

  /** All lines delivered and eligible for auto-completion (no admin confirmation). */
  private canAutoCompleteDeliveredOrder(order: OrderDocument): boolean {
    if (order.items.length === 0) {
      return false;
    }
    if (!order.items.every((item) => item.delivered)) {
      return false;
    }
    return order.items.every((item) => this.isAutoCompletableLine(item));
  }

  /** Inventory-backed gift cards and supplier-fulfilled lines complete without admin. */
  private isAutoCompletableLine(item: OrderDocument['items'][number]): boolean {
    if (item.deliveryType === DeliveryType.Auto) {
      return true;
    }
    if (item.inventoryItemIds.length > 0) {
      return true;
    }
    if (item.deliverySource === 'supplier') {
      return true;
    }
    return false;
  }

  private applyAutoFulfillmentStatus(
    order: OrderDocument,
    deliveryNote?: string,
  ): void {
    if (this.canAutoCompleteDeliveredOrder(order)) {
      order.status = OrderStatus.Delivered;
      order.deliveredAt = new Date();
      this.appendTimelineEntry(
        order,
        OrderStatus.Delivered,
        deliveryNote ?? 'Auto-delivery complete',
      );
      return;
    }

    const allDelivered = order.items.every((item) => item.delivered);
    order.status = OrderStatus.Processing;
    this.appendTimelineEntry(
      order,
      OrderStatus.Processing,
      deliveryNote ??
        (allDelivered ? 'Delivery complete — awaiting confirmation' : undefined),
    );
  }

  private async finalizeDelivery(
    order: OrderDocument,
    includeManual: boolean,
    deliveryNote?: string,
  ): Promise<void> {
    for (const item of order.items) {
      if (item.delivered) {
        continue;
      }
      const hasInventory = item.inventoryItemIds.length > 0;
      const isAuto = item.deliveryType === DeliveryType.Auto;
      if (!isAuto && !includeManual && !hasInventory) {
        continue;
      }
      if (item.inventoryItemIds.length > 0) {
        // Read the deliverable secrets (select:false) and hand them to the buyer.
        const units = await this.inventoryModel
          .find({ _id: { $in: item.inventoryItemIds } })
          .select('+value')
          .exec();
        if (item.deliveredCodes.length === 0) {
          item.deliveredCodes = units.map((unit) =>
            this.crypto.sealDeliveredSecret({
              code: this.crypto.openInventoryValue(unit.value),
            }),
          );
        }
        await this.inventoryModel
          .updateMany(
            { _id: { $in: item.inventoryItemIds } },
            { $set: { status: InventoryStatus.Sold, soldAt: new Date() } },
          )
          .exec();
        item.deliverySource = 'inventory';
      }
      await this.productModel
        .updateOne(
          { _id: item.productId },
          {
            $inc: {
              'stock.reserved': -item.quantity,
              'stock.sold': item.quantity,
            },
          },
        )
        .exec();
      item.delivered = true;
    }

    const allDelivered = order.items.every((item) => item.delivered);
    const shouldComplete =
      allDelivered &&
      (includeManual || this.canAutoCompleteDeliveredOrder(order));

    if (shouldComplete) {
      order.status = OrderStatus.Delivered;
      order.deliveredAt = new Date();
    } else if (!allDelivered || order.status === OrderStatus.Paid) {
      order.status = OrderStatus.Processing;
    }
    this.appendTimelineEntry(order, order.status, deliveryNote);
    await this.markManualGiftInventorySold(order);
    await order.save();
  }

  /** Allow re-delivery after an admin moves a completed order back to Processing. */
  private async reopenManualDeliveryOrder(
    order: OrderDocument,
  ): Promise<void> {
    const manualInventoryIds = this.collectManualGiftInventoryIds(order);

    if (manualInventoryIds.length > 0) {
      await this.inventoryModel
        .updateMany(
          {
            _id: { $in: manualInventoryIds },
            orderId: order._id,
            status: InventoryStatus.Sold,
          },
          {
            $set: { status: InventoryStatus.Reserved },
            $unset: { soldAt: 1 },
          },
        )
        .exec();
    }

    for (const item of order.items) {
      if (item.deliveryType !== DeliveryType.Manual) {
        continue;
      }
      item.delivered = false;
      item.deliveredCodes = [];
    }
  }

  private collectManualGiftInventoryIds(
    order: OrderDocument,
  ): Types.ObjectId[] {
    return (order.manualGiftCards ?? [])
      .map((card) => card.inventoryItemId)
      .filter((id): id is Types.ObjectId => Boolean(id));
  }

  /** Reserve inventory units picked from stock for manual gift-card delivery. */
  private async syncManualDeliveryInventory(
    order: OrderDocument,
    giftCards: Array<{ inventoryItemId?: string }>,
  ): Promise<void> {
    const orderId = order._id;
    const nextIds = giftCards
      .map((card) => card.inventoryItemId?.trim())
      .filter((id): id is string => Boolean(id))
      .map((id) => new Types.ObjectId(id));
    const previousManualIds = this.collectManualGiftInventoryIds(order);
    const nextIdSet = new Set(nextIds.map((id) => id.toString()));

    await this.inventoryModel
      .updateMany(
        {
          orderId,
          status: InventoryStatus.Reserved,
          ...(nextIds.length > 0 ? { _id: { $nin: nextIds } } : {}),
        },
        {
          $set: { status: InventoryStatus.Available },
          $unset: { orderId: 1 },
        },
      )
      .exec();

    const soldManualIdsToRelease = previousManualIds.filter(
      (id) => !nextIdSet.has(id.toString()),
    );
    if (soldManualIdsToRelease.length > 0) {
      await this.inventoryModel
        .updateMany(
          {
            _id: { $in: soldManualIdsToRelease },
            orderId,
            status: InventoryStatus.Sold,
          },
          {
            $set: { status: InventoryStatus.Available },
            $unset: { orderId: 1, soldAt: 1 },
          },
        )
        .exec();
    }

    for (const itemId of nextIds) {
      const alreadyLinked = await this.inventoryModel
        .findOne({
          _id: itemId,
          orderId,
          status: { $in: [InventoryStatus.Reserved, InventoryStatus.Sold] },
        })
        .select('_id status')
        .lean()
        .exec();
      if (alreadyLinked) {
        if (alreadyLinked.status === InventoryStatus.Sold) {
          await this.inventoryModel
            .updateOne(
              { _id: itemId, orderId, status: InventoryStatus.Sold },
              {
                $set: { status: InventoryStatus.Reserved },
                $unset: { soldAt: 1 },
              },
            )
            .exec();
        }
        continue;
      }

      const claimed = await this.inventoryModel
        .findOneAndUpdate(
          {
            _id: itemId,
            $or: [
              { status: InventoryStatus.Available },
              { status: InventoryStatus.Reserved, orderId },
            ],
          },
          {
            $set: { status: InventoryStatus.Reserved, orderId },
            $unset: { soldAt: 1 },
          },
          { new: true },
        )
        .exec();
      if (!claimed) {
        throw new BadRequestException(
          'One or more selected stock codes are no longer available',
        );
      }
    }
  }

  private async markManualGiftInventorySold(
    order: OrderDocument,
  ): Promise<void> {
    const manualInventoryIds = (order.manualGiftCards ?? [])
      .map((card) => card.inventoryItemId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    if (manualInventoryIds.length === 0) {
      return;
    }

    await this.inventoryModel
      .updateMany(
        {
          _id: { $in: manualInventoryIds },
          orderId: order._id,
          status: { $in: [InventoryStatus.Reserved, InventoryStatus.Available] },
        },
        { $set: { status: InventoryStatus.Sold, soldAt: new Date() } },
      )
      .exec();
  }

  private normalizeManualGiftCards(
    giftCards?: ManualGiftCardDto[],
  ): Array<{
    code: string;
    amount?: string;
    fieldLabel?: string;
    inventoryItemId?: string;
  }> {
    if (!giftCards?.length) return [];
    return giftCards
      .map((card) => ({
        code: card.code.trim(),
        amount: card.amount?.trim() || undefined,
        fieldLabel: card.fieldLabel?.trim() || undefined,
        inventoryItemId: card.inventoryItemId?.trim() || undefined,
      }))
      .filter((card) => card.code.length > 0);
  }

  private applyManualGiftCards(
    order: OrderDocument,
    giftCards: Array<{
      code: string;
      amount?: string;
      fieldLabel?: string;
      inventoryItemId?: string;
    }>,
  ): void {
    order.manualGiftCards = giftCards.map((card) => ({
      code: this.crypto.sealDeliveredSecret({ code: card.code }).code,
      amount: card.amount,
      fieldLabel: card.fieldLabel,
      inventoryItemId: card.inventoryItemId
        ? new Types.ObjectId(card.inventoryItemId)
        : undefined,
    }));

    const target =
      order.items.find((item) => !item.delivered) ?? order.items[0];
    if (!target) return;

    target.deliveredCodes = giftCards.map((card) =>
      this.crypto.sealDeliveredSecret({ code: card.code }),
    );
    target.delivered = true;
  }

  private buildCustomerDeliveryEmailMessage(
    note?: string,
    giftCards?: Array<{ code: string; amount?: string; fieldLabel?: string }>,
  ): string | undefined {
    const parts: string[] = [];
    if (note?.trim()) {
      parts.push(note.trim());
    }
    if (giftCards?.length) {
      const lines = giftCards.map((card) => {
        const amountSuffix = card.amount ? ` (${card.amount})` : '';
        return `${card.code}${amountSuffix}`;
      });
      parts.push(`Gift cards:\n${lines.join('\n')}`);
    }
    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }

  /**
   * Builds the delivery email body for an order whose items have already been
   * processed by finalizeDelivery (i.e. item.deliveredCodes is populated).
   * Used by the auto-delivery and supplier-delivery paths that do NOT receive
   * explicit gift-card payloads from the admin.
   */
  private buildEmailMessageFromDeliveredOrder(
    order: OrderDocument,
    extraNote?: string,
  ): string | undefined {
    const parts: string[] = [];

    if (extraNote?.trim()) {
      parts.push(extraNote.trim());
    }

    // Codes unsealed from inventory stock during auto-delivery.
    for (const item of order.items) {
      if (item.delivered && item.deliveredCodes?.length > 0) {
        const label = (item.title ?? 'Item').trim();
        const lines = item.deliveredCodes.map(
          (c) => this.crypto.openDeliveredSecret(c).code,
        );
        parts.push(`${label}:\n${lines.join('\n')}`);
      }
    }

    // Manual gift-card codes the admin may have pre-staged on the order.
    if (order.manualGiftCards?.length) {
      const lines = order.manualGiftCards.map((card) => {
        const amountSuffix = card.amount ? ` (${card.amount})` : '';
        const code = this.crypto.openDeliveredSecret({ code: card.code }).code;
        return `${code}${amountSuffix}`;
      });
      parts.push(`Delivery codes:\n${lines.join('\n')}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }

  private ensureOrderOrigin(
    order: OrderDocument,
    clientMeta?: OrderClientMeta,
  ): void {
    if (!clientMeta?.customerIp && !clientMeta?.userAgent) {
      return;
    }
    if (order.origin?.customerIp && order.origin?.userAgent) {
      return;
    }
    order.origin = buildOrderOrigin(
      {
        customerIp: clientMeta.customerIp ?? order.origin?.customerIp,
        userAgent: clientMeta.userAgent ?? order.origin?.userAgent,
      },
      order.payment.method,
    );
  }

  /** Skips duplicate consecutive entries (e.g. processing pushed twice during fulfillment). */
  appendTimelineEntry(
    order: OrderDocument,
    status: OrderStatus,
    note?: string,
  ): void {
    const last = order.timeline[order.timeline.length - 1];
    if (
      last &&
      last.status === status &&
      (last.note ?? undefined) === (note ?? undefined)
    ) {
      return;
    }
    order.timeline.push({ status, at: new Date(), note });
  }

  private async getOwned(
    userId: string,
    orderId: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (String(order.userId) !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return order;
  }

  private async generateOrderNumber(): Promise<string> {
    await this.ensureCustomerOrderCounterInitialized();

    const floorSeq = CUSTOMER_ORDER_NUMBER_START - 1;
    await this.sequenceCounterModel
      .findOneAndUpdate(
        { key: CUSTOMER_ORDER_COUNTER_ID, seq: { $lt: floorSeq } },
        { $set: { seq: floorSeq } },
      )
      .exec();

    const updated = await this.sequenceCounterModel
      .findOneAndUpdate(
        { key: CUSTOMER_ORDER_COUNTER_ID },
        { $inc: { seq: 1 } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new Error('Could not generate a unique order number');
    }

    return String(updated.seq);
  }

  private async ensureCustomerOrderCounterInitialized(): Promise<void> {
    const existing = await this.sequenceCounterModel
      .findOne({ key: CUSTOMER_ORDER_COUNTER_ID })
      .lean()
      .exec();
    if (existing) {
      return;
    }

    const orders = await this.orderModel
      .find({}, { orderNumber: 1 })
      .lean()
      .exec();

    const floorSeq = CUSTOMER_ORDER_NUMBER_START - 1;
    let maxSeq = floorSeq;
    for (const order of orders) {
      const parsed = Number.parseInt(order.orderNumber ?? '', 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }

    await this.sequenceCounterModel
      .findOneAndUpdate(
        { key: CUSTOMER_ORDER_COUNTER_ID },
        { $setOnInsert: { key: CUSTOMER_ORDER_COUNTER_ID, seq: maxSeq } },
        { upsert: true },
      )
      .exec();
  }

  private withGuestReceiptToken(
    order: OrderDocument,
    isGuest: boolean,
  ): OrderDocument {
    if (!isGuest) {
      return order;
    }
    const token = this.customerOrderMail.guestReceiptToken(order, true);
    if (token) {
      (order as OrderDocument & { guestReceiptToken?: string }).guestReceiptToken =
        token;
    }
    return order;
  }
}
