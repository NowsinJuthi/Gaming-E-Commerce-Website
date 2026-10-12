import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  NotificationEvent,
  OrderStatus,
  PaymentGateway,
  PaymentIntentStatus,
  PaymentPurpose,
} from '../../common/enums';
import { round2 } from '../../common/utils/money';
import {
  PaymentIntent,
  PaymentIntentDocument,
} from '../../database/schemas/payment-intent.schema';
import { AuditActorType } from '../../database/schemas/audit-log.schema';
import { PaymentGatewayRegistry } from '../../integrations/payments/payment-gateway.registry';
import {
  PaymentJob,
  PaymentJobData,
  PAYMENTS_QUEUE,
} from '../../queues/queue.constants';
import { AuditService } from '../../shared/audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { OrderService } from '../orders/order.service';
import { WalletService } from '../wallet/wallet.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { classifyIdempotentIntent } from './payment-idempotency';
import {
  isSupportedPaymentCurrency,
  paymentCurrenciesMatch,
  webhookCurrencyMatches,
} from './payment-currency';
import { gatewayRefMatchesIntent } from './payment-gateway-ref';
import {
  decidePaymentFinalize,
  paymentSuccessClaimFilter,
  paymentUnmatchedClaimFilter,
  walletTopupIdempotencyKey,
} from './payment-finalize';
import {
  SETTLEMENT_APPLIED,
  SETTLEMENT_LEASE_MS,
  SETTLEMENT_PENDING,
  SETTLEMENT_UNMATCHED,
  SETTLEMENT_UNMATCHED_APPLIED,
  SETTLEMENT_UNMATCHED_MANUAL,
  settlementLeaseFilter,
} from './payment-settlement';
import {
  ACTIVE_ORDER_SLOT,
  ACTIVE_ORDER_SLOT_INDEX_SPEC,
  activeOrderIntentFilter,
  classifyActiveOrderCheckout,
  findDuplicateActiveOrderGroups,
  paymentIndexIsEnforcing,
  planDuplicateActiveIntentRecovery,
  settlingOrderIntentFilter,
  shouldFailClosedOnPaymentIndex,
  supersedeReplacementStatus,
} from './payment-active-intent';
import {
  CHARGE_LEASE_MS,
  chargeLeaseFilter,
  shouldSkipCreateCharge,
} from './payment-charge-lease';
import {
  decideDuplicateOrderSettlement,
  decideDuplicateRefund,
  duplicateRefundIdempotencyKey,
} from './payment-duplicate';
import { PaymentInvariantService } from './payment-invariant.service';
import { isProductionNodeEnv } from '../../config/production-env';
import { assertCanReadPaymentIntent } from '../../common/utils/order-access';
import { IntegrationNotConfiguredError } from '../../common/utils/sandbox-integrations';
import { webhookAmountMatches } from './webhook-amount';

const INTENT_TTL_MS = 60 * 60 * 1000; // abandoned intents expire after 1h
const FIRST_VERIFY_DELAY_MS = 30 * 1000;
const MAX_VERIFY_ATTEMPTS = 6;
const MAX_VERIFY_DELAY_MS = 10 * 60 * 1000;

const TERMINAL_STATUSES: ReadonlySet<PaymentIntentStatus> = new Set([
  PaymentIntentStatus.Succeeded,
  PaymentIntentStatus.Failed,
  PaymentIntentStatus.Expired,
  PaymentIntentStatus.Unmatched,
]);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: number }).code === 11000;

export interface PaymentIntentResult {
  intentId: string;
  gateway: PaymentGateway;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  checkoutUrl?: string;
}

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(PaymentIntent.name)
    private readonly paymentModel: Model<PaymentIntentDocument>,
    @InjectQueue(PAYMENTS_QUEUE)
    private readonly paymentsQueue: Queue<PaymentJobData>,
    @Inject(forwardRef(() => PaymentGatewayRegistry))
    private readonly registry: PaymentGatewayRegistry,
    private readonly audit: AuditService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly orders: OrderService,
    private readonly wallet: WalletService,
    private readonly invariants: PaymentInvariantService,
  ) {}

  async onModuleInit(): Promise<void> {
    const production = isProductionNodeEnv(process.env.NODE_ENV);
    let indexReady = false;
    try {
      await this.paymentModel.collection.createIndex(
        ACTIVE_ORDER_SLOT_INDEX_SPEC.key,
        {
          unique: ACTIVE_ORDER_SLOT_INDEX_SPEC.unique,
          sparse: ACTIVE_ORDER_SLOT_INDEX_SPEC.sparse,
          name: ACTIVE_ORDER_SLOT_INDEX_SPEC.name,
        },
      );
      const indexes = await this.paymentModel.collection.indexes();
      const spec = indexes.find(
        (index) => index.name === ACTIVE_ORDER_SLOT_INDEX_SPEC.name,
      );
      indexReady = paymentIndexIsEnforcing(spec);
    } catch (error) {
      this.logger.error(
        `Could not ensure ${ACTIVE_ORDER_SLOT_INDEX_SPEC.name}: ${errorMessage(error)}`,
      );
    }

    let duplicateRows = await this.listActiveOrderIntentRows();
    let duplicateGroups = findDuplicateActiveOrderGroups(duplicateRows);
    if (duplicateGroups.length > 0 && !production) {
      await this.recoverDuplicateActiveIntents(duplicateRows);
      duplicateRows = await this.listActiveOrderIntentRows();
      duplicateGroups = findDuplicateActiveOrderGroups(duplicateRows);
    }

    if (
      shouldFailClosedOnPaymentIndex({
        production,
        indexReady,
        duplicateActiveCount: duplicateGroups.length,
      })
    ) {
      const reason = !indexReady
        ? `unique index ${ACTIVE_ORDER_SLOT_INDEX_SPEC.name} is missing or not unique`
        : `${duplicateGroups.length} orders have duplicate active payment intents`;
      this.invariants.markBlocked(reason);
      throw new Error(`Refusing to start payments: ${reason}`);
    }

    if (!indexReady || duplicateGroups.length > 0) {
      const reason = !indexReady
        ? `unique index ${ACTIVE_ORDER_SLOT_INDEX_SPEC.name} is missing or not unique`
        : `${duplicateGroups.length} orders have duplicate active payment intents`;
      this.invariants.markBlocked(reason);
      this.logger.error(`Payments disabled: ${reason}`);
      return;
    }

    this.invariants.markReady();
  }

  // --- Public API ---

  async createPayment(
    user: AuthenticatedUser,
    dto: CreatePaymentDto,
    ip?: string,
  ): Promise<PaymentIntentResult> {
    if (!this.invariants.isReady()) {
      this.logger.error(
        `createPayment blocked: ${this.invariants.blockReason()}`,
      );
      throw new ServiceUnavailableException(
        'Payments are temporarily unavailable',
      );
    }
    const amount = round2(dto.amount);
    let orderId: Types.ObjectId | undefined;

    const currency = (dto.currency ?? 'BDT').trim().toUpperCase();
    if (!isSupportedPaymentCurrency(currency)) {
      throw new BadRequestException('Unsupported payment currency');
    }

    if (dto.purpose === PaymentPurpose.Order) {
      if (!dto.orderId) {
        throw new BadRequestException('orderId is required for order payments');
      }
      const order = await this.orders.getOne(user, dto.orderId);
      if (order.status !== OrderStatus.Pending) {
        throw new BadRequestException('Order is not awaiting payment');
      }
      if (Math.abs(round2(order.pricing.total) - amount) > 0.001) {
        throw new BadRequestException('Amount does not match the order total');
      }
      if (!paymentCurrenciesMatch(order.pricing.currency, currency)) {
        throw new BadRequestException('Currency does not match the order');
      }
      orderId = order._id;
    }

    if (dto.idempotencyKey) {
      const existing = await this.paymentModel
        .findOne({ idempotencyKey: dto.idempotencyKey })
        .exec();
      const classified = classifyIdempotentIntent(existing, user.id);
      if (classified === 'reuse' && existing) {
        if (
          existing.status === PaymentIntentStatus.Pending &&
          existing.checkoutUrl
        ) {
          return this.toResult(existing);
        }
        if (TERMINAL_STATUSES.has(existing.status)) {
          return this.toResult(existing);
        }
      }
      if (classified === 'foreign') {
        throw new ForbiddenException('Invalid idempotency key');
      }
    }

    let intent: PaymentIntentDocument | null = null;
    if (orderId) {
      const existing = await this.takeActiveOrderIntentSlot(
        user,
        orderId,
        dto.gateway,
      );
      if (existing) {
        if (
          existing.status === PaymentIntentStatus.Pending &&
          existing.checkoutUrl
        ) {
          return this.toResult(existing);
        }
        intent = existing;
      }
    }

    try {
      if (!intent) {
        intent = await this.paymentModel.create({
          userId: new Types.ObjectId(user.id),
          gateway: dto.gateway,
          purpose: dto.purpose,
          orderId,
          amount,
          currency,
          status: PaymentIntentStatus.Created,
          idempotencyKey: dto.idempotencyKey,
          expiresAt: new Date(Date.now() + INTENT_TTL_MS),
          metadata: { ip },
          ...(orderId ? { activeOrderSlot: ACTIVE_ORDER_SLOT } : {}),
        });
      }
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        if (dto.idempotencyKey) {
          const existing = await this.paymentModel
            .findOne({ idempotencyKey: dto.idempotencyKey })
            .exec();
          const classified = classifyIdempotentIntent(existing, user.id);
          if (classified === 'reuse' && existing) {
            return this.toResult(existing);
          }
          if (classified === 'foreign') {
            throw new ForbiddenException('Invalid idempotency key');
          }
        }
        if (orderId) {
          const active = await this.paymentModel
            .findOne(activeOrderIntentFilter(orderId))
            .exec();
          const decision = classifyActiveOrderCheckout(active, {
            userId: user.id,
            gateway: dto.gateway,
          });
          if (decision === 'reuse' && active) {
            if (
              active.status === PaymentIntentStatus.Pending &&
              active.checkoutUrl
            ) {
              return this.toResult(active);
            }
            intent = active;
          } else if (decision === 'forbidden') {
            throw new ForbiddenException('Invalid payment session');
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (!intent) {
      throw new BadRequestException('Failed to initiate payment');
    }

    if (shouldSkipCreateCharge(intent)) {
      return this.toResult(intent);
    }

    intent = await this.ensureGatewayCharge(intent, user, dto, ip);

    await this.audit.record({
      action: 'payment.created',
      actorType: AuditActorType.User,
      actorId: user.id,
      entityType: 'payment_intent',
      entityId: String(intent._id),
      gateway: dto.gateway,
      status: intent.status,
      ip,
      metadata: { amount, purpose: dto.purpose },
    });

    // Safety-net poll in case the webhook is missed (retry workflow). A queue
    // outage must not block checkout — the intent is already usable.
    try {
      await this.scheduleVerify(String(intent._id), 1, FIRST_VERIFY_DELAY_MS);
    } catch (queueError) {
      this.logger.warn(
        `Could not schedule verify poll for intent ${String(intent._id)}: ${errorMessage(queueError)}`,
      );
    }

    return this.toResult(intent);
  }

  async getOne(
    user: AuthenticatedUser,
    intentId: string,
  ): Promise<PaymentIntentResult> {
    const intent = await this.getOwned(user, intentId);
    return this.toResult(intent);
  }

  /** Manual reconciliation triggered by the shopper or support. */
  async verifyPayment(
    user: AuthenticatedUser,
    intentId: string,
  ): Promise<PaymentIntentResult> {
    const intent = await this.getOwned(user, intentId);
    await this.runVerification(intent, AuditActorType.User, user.id);
    return this.toResult(intent);
  }

  /** Called by MFS verification when TrxID + SMS match succeeds. */
  async completeVerifiedIntent(
    intentId: string,
    source: string,
  ): Promise<void> {
    const intent = await this.paymentModel.findById(intentId).exec();
    if (!intent || intent.gateway !== PaymentGateway.Mfs) {
      return;
    }
    if (intent.status === PaymentIntentStatus.Succeeded) {
      await this.applyPendingSettlement(String(intent._id));
      return;
    }
    if (TERMINAL_STATUSES.has(intent.status)) {
      return;
    }
    intent.verificationSource = source as PaymentIntentDocument['verificationSource'];
    await intent.save();
    await this.finalizeSuccess(intent);
  }

  async applyPendingSettlement(intentId: string): Promise<void> {
    const now = new Date();
    const leased = await this.paymentModel
      .findOneAndUpdate(
        settlementLeaseFilter(intentId, now),
        {
          $set: {
            settlementLeaseUntil: new Date(now.getTime() + SETTLEMENT_LEASE_MS),
          },
        },
        { new: true },
      )
      .exec();
    if (!leased) {
      return;
    }
    try {
      if (leased.settlementState === SETTLEMENT_UNMATCHED) {
        await this.applyDuplicateRefund(leased);
        return;
      }
      if (leased.purpose === PaymentPurpose.Order && leased.orderId) {
        const confirmed = await this.orders.confirmPayment(
          String(leased.orderId),
          leased._id,
        );
        const decision = decideDuplicateOrderSettlement({
          confirmOutcome: confirmed.outcome,
          payerIntentId: confirmed.payerIntentId,
          settlingIntentId: String(leased._id),
        });
        if (decision === 'retry') {
          throw new Error('Order missing during settlement apply');
        }
        if (decision === 'unmatched') {
          await this.paymentModel
            .updateOne(
              { _id: leased._id, status: PaymentIntentStatus.Succeeded },
              { $set: { settlementState: SETTLEMENT_UNMATCHED } },
            )
            .exec();
          await this.applyDuplicateRefund(leased);
          return;
        }
      } else if (leased.purpose === PaymentPurpose.WalletTopup) {
        await this.wallet.deposit({
          userId: leased.userId,
          amount: leased.amount,
          reference: { type: 'payment_intent', id: leased._id },
          idempotencyKey: walletTopupIdempotencyKey(String(leased._id)),
          description: `Wallet top-up via ${leased.gateway}`,
          notify: false,
        });
      }
      await this.paymentModel
        .updateOne(
          { _id: leased._id, status: PaymentIntentStatus.Succeeded },
          {
            $set: { settlementState: SETTLEMENT_APPLIED },
            $unset: { settlementLeaseUntil: 1 },
          },
        )
        .exec();
    } catch (error) {
      await this.scheduleSettle(String(leased._id), 5_000);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileUnsettledPayments(): Promise<void> {
    const rows = await this.paymentModel
      .find({
        status: PaymentIntentStatus.Succeeded,
        settlementState: {
          $nin: [
            SETTLEMENT_APPLIED,
            SETTLEMENT_UNMATCHED_APPLIED,
            SETTLEMENT_UNMATCHED_MANUAL,
          ],
        },
      })
      .select('_id')
      .limit(50)
      .lean()
      .exec();
    for (const row of rows) {
      await this.scheduleSettle(String(row._id));
    }
  }

  async handleWebhook(
    gateway: PaymentGateway,
    payload: unknown,
    signature: string | undefined,
    rawBody?: Buffer,
    ip?: string,
  ): Promise<{ received: boolean }> {
    const client = this.registry.get(gateway);
    const parsed = client.parseWebhook(payload, signature, rawBody);

    await this.audit.record({
      action: 'payment.webhook',
      actorType: AuditActorType.Gateway,
      gateway,
      status: parsed.status,
      ip,
      metadata: {
        gatewayRef: parsed.gatewayRef,
        signatureValid: parsed.signatureValid,
      },
    });

    if (!parsed.signatureValid) {
      this.logger.warn(`Rejected ${gateway} webhook: invalid signature`);
      return { received: true };
    }

    const intent = await this.findByGatewayRef(gateway, parsed.gatewayRef);
    if (!intent) {
      this.logger.warn(
        `No intent for ${gateway} webhook ref=${parsed.gatewayRef}`,
      );
      return { received: true };
    }

    if (parsed.status === 'succeeded') {
      if (!webhookAmountMatches(parsed.amount, intent.amount)) {
        this.logger.warn(
          `Rejected ${gateway} webhook: amount mismatch for ${parsed.gatewayRef}`,
        );
        return { received: true };
      }
      if (!webhookCurrencyMatches(parsed.currency, intent.currency)) {
        this.logger.warn(
          `Rejected ${gateway} webhook: currency mismatch for ${parsed.gatewayRef}`,
        );
        return { received: true };
      }
      await this.finalizeSuccess(intent);
    } else if (parsed.status === 'failed') {
      await this.markFailed(intent, 'Gateway reported failure (webhook)');
    }
    return { received: true };
  }

  // --- Worker handler (invoked by PaymentProcessor) ---

  async pollVerify(intentId: string, attempt: number): Promise<void> {
    const intent = await this.paymentModel.findById(intentId).exec();
    if (!intent || TERMINAL_STATUSES.has(intent.status)) {
      return;
    }

    intent.attempts = attempt;
    await intent.save();

    const status = await this.runVerification(
      intent,
      AuditActorType.System,
    );

    if (TERMINAL_STATUSES.has(status)) {
      return;
    }

    if (attempt >= MAX_VERIFY_ATTEMPTS) {
      if (intent.status === PaymentIntentStatus.Superseded) {
        return;
      }
      intent.status = PaymentIntentStatus.Expired;
      intent.lastError = 'Verification attempts exhausted';
      await intent.save();
      await this.releaseActiveOrderSlot(intent._id);
      await this.audit.record({
        action: 'payment.expired',
        entityType: 'payment_intent',
        entityId: String(intent._id),
        gateway: intent.gateway,
        status: PaymentIntentStatus.Expired,
      });
      return;
    }

    await this.scheduleVerify(intentId, attempt + 1, this.backoff(attempt));
  }

  // --- Internals ---

  private async runVerification(
    intent: PaymentIntentDocument,
    actorType: AuditActorType,
    actorId?: string,
  ): Promise<PaymentIntentStatus> {
    if (TERMINAL_STATUSES.has(intent.status)) {
      return intent.status;
    }
    if (!intent.gatewayRef && intent.gateway !== PaymentGateway.Mfs) {
      return intent.status;
    }

    const client = this.registry.get(intent.gateway);
    try {
      const ref = intent.gatewayRef ?? String(intent._id);
      const result = await client.verify(ref);
      await this.audit.record({
        action: 'payment.verify',
        actorType,
        actorId,
        entityType: 'payment_intent',
        entityId: String(intent._id),
        gateway: intent.gateway,
        status: result.status,
      });
      if (result.status === 'succeeded') {
        if (!webhookAmountMatches(result.amount, intent.amount)) {
          this.logger.warn(
            `Rejected ${intent.gateway} verify: amount mismatch for ${ref}`,
          );
          return intent.status;
        }
        if (!webhookCurrencyMatches(result.currency, intent.currency)) {
          this.logger.warn(
            `Rejected ${intent.gateway} verify: currency mismatch for ${ref}`,
          );
          return intent.status;
        }
        await this.finalizeSuccess(intent);
      } else if (result.status === 'failed') {
        await this.markFailed(intent, 'Gateway reported failure (verify)');
      }
    } catch (error) {
      intent.lastError = errorMessage(error);
      await intent.save();
      await this.audit.record({
        action: 'payment.verify_error',
        actorType,
        actorId,
        entityType: 'payment_intent',
        entityId: String(intent._id),
        gateway: intent.gateway,
        metadata: { error: intent.lastError },
      });
    }
    return intent.status;
  }

  private async finalizeSuccess(intent: PaymentIntentDocument): Promise<void> {
    const decision = decidePaymentFinalize(intent);
    if (decision === 'already-succeeded') {
      await this.applyPendingSettlement(String(intent._id));
      return;
    }
    if (decision === 'reject-terminal') {
      this.logger.warn(
        `Ignored success for terminal intent ${String(intent._id)} (${intent.status})`,
      );
      return;
    }
    if (decision === 'claim-unmatched') {
      const paidAt = new Date();
      const claimed = await this.paymentModel
        .findOneAndUpdate(
          paymentUnmatchedClaimFilter(intent._id),
          {
            $set: {
              status: PaymentIntentStatus.Succeeded,
              paidAt,
              settlementState: SETTLEMENT_UNMATCHED,
            },
            $unset: { expiresAt: 1, activeOrderSlot: 1, chargeLeaseUntil: 1 },
          },
          { new: true },
        )
        .exec();
      if (!claimed) {
        const latest = await this.paymentModel.findById(intent._id).exec();
        if (latest?.status === PaymentIntentStatus.Succeeded) {
          await this.applyPendingSettlement(String(intent._id));
        }
        return;
      }
      try {
        await this.applyPendingSettlement(String(claimed._id));
      } catch (error) {
        this.logger.warn(
          `Unmatched settlement deferred for ${String(claimed._id)}: ${errorMessage(error)}`,
        );
      }
      await this.audit.record({
        action: 'payment.superseded_captured',
        actorType: AuditActorType.System,
        actorId: String(claimed.userId),
        entityType: 'payment_intent',
        entityId: String(claimed._id),
        gateway: claimed.gateway,
        status: PaymentIntentStatus.Succeeded,
        metadata: {
          amount: claimed.amount,
          purpose: claimed.purpose,
          settlementState: SETTLEMENT_UNMATCHED,
        },
      });
      return;
    }
    if (decision === 'reject-expired') {
      if (intent.status !== PaymentIntentStatus.Expired) {
        intent.status = PaymentIntentStatus.Expired;
        intent.lastError = 'Payment intent expired before settlement';
        await intent.save();
        await this.releaseActiveOrderSlot(intent._id);
      }
      this.logger.warn(
        `Ignored late success for expired intent ${String(intent._id)}`,
      );
      return;
    }

    const paidAt = new Date();
    const claimed = await this.paymentModel
      .findOneAndUpdate(
        paymentSuccessClaimFilter(intent._id, paidAt),
        {
          $set: {
            status: PaymentIntentStatus.Succeeded,
            paidAt,
            settlementState: SETTLEMENT_PENDING,
          },
          $unset: { expiresAt: 1, activeOrderSlot: 1 },
        },
        { new: true },
      )
      .exec();
    if (!claimed) {
      const latest = await this.paymentModel.findById(intent._id).exec();
      if (latest?.status === PaymentIntentStatus.Succeeded) {
        await this.applyPendingSettlement(String(intent._id));
        return;
      }
      this.logger.warn(
        `Could not claim intent ${String(intent._id)} for success (status=${latest?.status})`,
      );
      return;
    }

    try {
      await this.applyPendingSettlement(String(claimed._id));
    } catch (error) {
      this.logger.warn(
        `Settlement apply deferred for ${String(claimed._id)}: ${errorMessage(error)}`,
      );
    }

    const finalized = claimed;

    await this.audit.record({
      action: 'payment.succeeded',
      actorType: AuditActorType.System,
      actorId: String(finalized.userId),
      entityType: 'payment_intent',
      entityId: String(finalized._id),
      gateway: finalized.gateway,
      status: PaymentIntentStatus.Succeeded,
      metadata: {
        amount: finalized.amount,
        purpose: finalized.purpose,
      },
    });

    // Only a wallet top-up credits the wallet. Order payment success is notified
    // only when the order is marked complete/delivered — not on payment settle.
    if (finalized.purpose === PaymentPurpose.WalletTopup) {
      try {
        await this.dispatcher.dispatch(
          NotificationEvent.WalletCredited,
          finalized.userId,
          { amount: finalized.amount, currency: finalized.currency },
        );
      } catch (error) {
        this.logger.warn(
          `WalletCredited notification failed for ${String(finalized._id)}: ${errorMessage(error)}`,
        );
      }
    }
  }

  private async markFailed(
    intent: PaymentIntentDocument,
    reason: string,
  ): Promise<void> {
    if (
      TERMINAL_STATUSES.has(intent.status) ||
      intent.status === PaymentIntentStatus.Superseded
    ) {
      return;
    }
    intent.status = PaymentIntentStatus.Failed;
    intent.lastError = reason;
    await intent.save();
    await this.releaseActiveOrderSlot(intent._id);

    await this.audit.record({
      action: 'payment.failed',
      actorType: AuditActorType.System,
      entityType: 'payment_intent',
      entityId: String(intent._id),
      gateway: intent.gateway,
      status: PaymentIntentStatus.Failed,
      metadata: { reason },
    });

    if (intent.purpose === PaymentPurpose.Order && intent.orderId) {
      void this.orders
        .notifyPaymentFailed(intent, reason)
        .catch((err) => {
          this.logger.warn(
            `Payment failed email for intent ${String(intent._id)}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
    }
  }

  private async findByGatewayRef(
    gateway: PaymentGateway,
    ref: string,
  ): Promise<PaymentIntentDocument | null> {
    if (!ref) {
      return null;
    }
    const byRef = await this.paymentModel
      .findOne({ gateway, gatewayRef: ref })
      .exec();
    if (byRef) {
      return byRef;
    }
    if (Types.ObjectId.isValid(ref)) {
      const byId = await this.paymentModel.findById(ref).exec();
      if (gatewayRefMatchesIntent(byId, gateway)) {
        return byId;
      }
    }
    return null;
  }

  private async ensureGatewayCharge(
    intent: PaymentIntentDocument,
    user: AuthenticatedUser,
    dto: CreatePaymentDto,
    ip?: string,
  ): Promise<PaymentIntentDocument> {
    if (shouldSkipCreateCharge(intent)) {
      return intent;
    }

    const now = new Date();
    const leased = await this.paymentModel
      .findOneAndUpdate(
        chargeLeaseFilter(intent._id, now),
        {
          $set: {
            status: PaymentIntentStatus.Initializing,
            chargeLeaseUntil: new Date(now.getTime() + CHARGE_LEASE_MS),
          },
        },
        { new: true },
      )
      .exec();
    if (!leased) {
      const latest = await this.paymentModel.findById(intent._id).exec();
      if (latest && shouldSkipCreateCharge(latest)) {
        return latest;
      }
      throw new ServiceUnavailableException(
        'Payment is being initialized',
      );
    }

    const client = this.registry.get(dto.gateway);
    try {
      const charge = await client.createCharge({
        reference: String(leased._id),
        amount: leased.amount,
        currency: leased.currency,
        customer: { id: user.id, email: user.email },
        metadata: {
          purpose: dto.purpose,
          orderId: leased.orderId ? String(leased.orderId) : undefined,
        },
      });
      const updated = await this.paymentModel
        .findOneAndUpdate(
          {
            _id: leased._id,
            status: {
              $in: [
                PaymentIntentStatus.Initializing,
                PaymentIntentStatus.Superseded,
              ],
            },
          },
          [
            {
              $set: {
                gatewayRef: charge.gatewayRef,
                checkoutUrl: charge.checkoutUrl,
                status: {
                  $cond: {
                    if: {
                      $eq: ['$status', PaymentIntentStatus.Initializing],
                    },
                    then: PaymentIntentStatus.Pending,
                    else: '$status',
                  },
                },
              },
            },
            { $unset: ['chargeLeaseUntil'] },
          ],
          { new: true },
        )
        .exec();
      if (!updated) {
        const latest = await this.paymentModel.findById(leased._id).exec();
        if (latest && shouldSkipCreateCharge(latest)) {
          return latest;
        }
        throw new BadRequestException('Failed to initiate payment');
      }
      if (updated.status === PaymentIntentStatus.Superseded) {
        throw new BadRequestException(
          'Payment session was replaced; retry checkout',
        );
      }
      return updated;
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      leased.status = PaymentIntentStatus.Failed;
      leased.lastError = errorMessage(error);
      await leased.save();
      await this.releaseActiveOrderSlot(leased._id);
      await this.audit.record({
        action: 'payment.create_failed',
        actorType: AuditActorType.User,
        actorId: user.id,
        entityType: 'payment_intent',
        entityId: String(leased._id),
        gateway: dto.gateway,
        status: PaymentIntentStatus.Failed,
        ip,
        metadata: { error: leased.lastError },
      });
      this.logger.error(
        `Gateway ${dto.gateway} createCharge failed: ${leased.lastError}`,
      );
      throw new BadRequestException(
        error instanceof IntegrationNotConfiguredError
          ? error.message
          : 'Failed to initiate payment with gateway',
      );
    }
  }

  private async listActiveOrderIntentRows(): Promise<
    { id: string; orderId: string; createdAt: number }[]
  > {
    const rows = await this.paymentModel
      .find({
        purpose: PaymentPurpose.Order,
        activeOrderSlot: ACTIVE_ORDER_SLOT,
        orderId: { $exists: true },
      })
      .select('_id orderId createdAt')
      .lean()
      .exec();
    return rows
      .filter((row) => row.orderId)
      .map((row) => ({
        id: String(row._id),
        orderId: String(row.orderId),
        createdAt: row.createdAt ? new Date(row.createdAt).getTime() : 0,
      }));
  }

  private async recoverDuplicateActiveIntents(
    rows: { id: string; orderId: string; createdAt: number }[],
  ): Promise<void> {
    const plans = planDuplicateActiveIntentRecovery(rows);
    for (const plan of plans) {
      if (!plan.supersedeIds.length) continue;
      await this.paymentModel
        .updateMany(
          { _id: { $in: plan.supersedeIds } },
          {
            $set: {
              status: PaymentIntentStatus.Superseded,
              lastError: 'Duplicate active intent recovered',
            },
            $unset: { activeOrderSlot: 1, expiresAt: 1, chargeLeaseUntil: 1 },
          },
        )
        .exec();
    }
  }

  private async releaseActiveOrderSlot(id: unknown): Promise<void> {
    await this.paymentModel
      .updateOne({ _id: id }, { $unset: { activeOrderSlot: 1 } })
      .exec();
  }

  private async takeActiveOrderIntentSlot(
    user: AuthenticatedUser,
    orderId: Types.ObjectId,
    gateway: PaymentGateway,
  ): Promise<PaymentIntentDocument | null> {
    const settling = await this.paymentModel
      .findOne(settlingOrderIntentFilter(orderId))
      .exec();
    if (settling) {
      throw new BadRequestException(
        'A payment for this order is already settling',
      );
    }

    const active = await this.paymentModel
      .findOne(activeOrderIntentFilter(orderId))
      .exec();
    const decision = classifyActiveOrderCheckout(active, {
      userId: user.id,
      gateway,
    });
    if (decision === 'forbidden') {
      throw new ForbiddenException('Invalid payment session');
    }
    if (decision === 'reuse' && active) {
      return active;
    }
    if (decision === 'supersede' && active) {
      const nextStatus = supersedeReplacementStatus(active);
      await this.paymentModel
        .findOneAndUpdate(
          {
            _id: active._id,
            status: {
              $in: [
                PaymentIntentStatus.Created,
                PaymentIntentStatus.Initializing,
                PaymentIntentStatus.Pending,
              ],
            },
          },
          {
            $set: {
              status: nextStatus,
              lastError: 'Superseded by a new checkout',
            },
            $unset: { activeOrderSlot: 1, expiresAt: 1, chargeLeaseUntil: 1 },
          },
        )
        .exec();
    }
    return null;
  }

  private async applyDuplicateRefund(
    leased: PaymentIntentDocument,
  ): Promise<void> {
    const intentId = String(leased._id);
    const idempotencyKey = duplicateRefundIdempotencyKey(intentId);
    const client = this.registry.get(leased.gateway);
    const gatewayRefund = client.refundCharge
      ? await client.refundCharge({
          gatewayRef: leased.gatewayRef ?? intentId,
          amount: leased.amount,
          currency: leased.currency,
          idempotencyKey,
          reason: 'Superseded or duplicate payment capture',
        })
      : { supported: false as const };
    const refundAttempt = gatewayRefund.supported
      ? { supported: true, ok: gatewayRefund.ok }
      : { supported: false, ok: false };
    const decision = decideDuplicateRefund({
      settlementState: leased.settlementState,
      gatewayRefund: refundAttempt,
    });
    if (decision === 'already-applied') {
      return;
    }
    if (decision === 'retry') {
      throw new Error(
        gatewayRefund.supported && !gatewayRefund.ok
          ? gatewayRefund.error
          : 'Gateway refund not confirmed',
      );
    }

    const refundRef =
      gatewayRefund.supported && gatewayRefund.ok
        ? gatewayRefund.refundRef
        : undefined;
    const settlementState =
      decision === 'gateway'
        ? SETTLEMENT_UNMATCHED_APPLIED
        : SETTLEMENT_UNMATCHED_MANUAL;
    const lastError =
      decision === 'gateway'
        ? 'Duplicate or superseded payment; refunded at gateway'
        : 'Duplicate or superseded payment; manual reconciliation required';

    await this.paymentModel
      .updateOne(
        {
          _id: leased._id,
          status: PaymentIntentStatus.Succeeded,
          settlementState: {
            $nin: [SETTLEMENT_UNMATCHED_APPLIED, SETTLEMENT_UNMATCHED_MANUAL],
          },
        },
        {
          $set: {
            status: PaymentIntentStatus.Unmatched,
            settlementState,
            lastError,
            ...(refundRef ? { gatewayRefundRef: refundRef } : {}),
            metadata: {
              ...(leased.metadata ?? {}),
              refundChannel: decision,
              refundIdempotencyKey: idempotencyKey,
            },
          },
          $unset: { settlementLeaseUntil: 1, activeOrderSlot: 1 },
        },
      )
      .exec();
    await this.audit.record({
      action:
        decision === 'gateway'
          ? 'payment.duplicate_refund_gateway'
          : 'payment.duplicate_unmatched_manual',
      actorType: AuditActorType.System,
      actorId: String(leased.userId),
      entityType: 'payment_intent',
      entityId: intentId,
      gateway: leased.gateway,
      status: PaymentIntentStatus.Unmatched,
      metadata: {
        orderId: leased.orderId ? String(leased.orderId) : undefined,
        amount: leased.amount,
        refundChannel: decision,
        refundIdempotencyKey: idempotencyKey,
      },
    });
  }

  private async scheduleVerify(
    intentId: string,
    attempt: number,
    delay: number,
  ): Promise<void> {
    await this.paymentsQueue.add(
      PaymentJob.Verify,
      { intentId, attempt },
      { delay, jobId: `verify:${intentId}:${attempt}` },
    );
  }

  private async scheduleSettle(intentId: string, delay = 0): Promise<void> {
    try {
      await this.paymentsQueue.add(
        PaymentJob.Settle,
        { intentId },
        {
          delay,
          jobId: `settle:${intentId}`,
          removeOnComplete: true,
          removeOnFail: true,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      );
    } catch {
      /* duplicate settle job id — already queued */
    }
  }

  private backoff(attempt: number): number {
    return Math.min(
      FIRST_VERIFY_DELAY_MS * 2 ** attempt,
      MAX_VERIFY_DELAY_MS,
    );
  }

  private async getOwned(
    user: AuthenticatedUser,
    intentId: string,
  ): Promise<PaymentIntentDocument> {
    const intent = await this.paymentModel.findById(intentId).exec();
    if (!intent) {
      throw new NotFoundException('Payment not found');
    }
    assertCanReadPaymentIntent(user, String(intent.userId));
    return intent;
  }

  private toResult(intent: PaymentIntentDocument): PaymentIntentResult {
    return {
      intentId: String(intent._id),
      gateway: intent.gateway,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      checkoutUrl: intent.checkoutUrl,
    };
  }
}
