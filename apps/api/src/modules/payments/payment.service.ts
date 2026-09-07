import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
import { isChatStaff } from '../../common/utils/role.utils';
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

const INTENT_TTL_MS = 60 * 60 * 1000; // abandoned intents expire after 1h
const FIRST_VERIFY_DELAY_MS = 30 * 1000;
const MAX_VERIFY_ATTEMPTS = 6;
const MAX_VERIFY_DELAY_MS = 10 * 60 * 1000;

const TERMINAL_STATUSES: ReadonlySet<PaymentIntentStatus> = new Set([
  PaymentIntentStatus.Succeeded,
  PaymentIntentStatus.Failed,
  PaymentIntentStatus.Expired,
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
export class PaymentService {
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
  ) {}

  // --- Public API ---

  async createPayment(
    user: AuthenticatedUser,
    dto: CreatePaymentDto,
    ip?: string,
  ): Promise<PaymentIntentResult> {
    const amount = round2(dto.amount);
    let orderId: Types.ObjectId | undefined;

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
      orderId = order._id;
    }

    if (dto.idempotencyKey) {
      const existing = await this.paymentModel
        .findOne({ idempotencyKey: dto.idempotencyKey })
        .exec();
      if (existing) {
        return this.toResult(existing);
      }
    }

    let intent: PaymentIntentDocument;
    try {
      intent = await this.paymentModel.create({
        userId: new Types.ObjectId(user.id),
        gateway: dto.gateway,
        purpose: dto.purpose,
        orderId,
        amount,
        currency: dto.currency ?? 'BDT',
        status: PaymentIntentStatus.Created,
        idempotencyKey: dto.idempotencyKey,
        expiresAt: new Date(Date.now() + INTENT_TTL_MS),
        metadata: { ip },
      });
    } catch (error) {
      if (dto.idempotencyKey && isDuplicateKeyError(error)) {
        const existing = await this.paymentModel
          .findOne({ idempotencyKey: dto.idempotencyKey })
          .exec();
        if (existing) {
          return this.toResult(existing);
        }
      }
      throw error;
    }

    const client = this.registry.get(dto.gateway);
    try {
      const charge = await client.createCharge({
        reference: String(intent._id),
        amount: intent.amount,
        currency: intent.currency,
        customer: { id: user.id, email: user.email },
        metadata: {
          purpose: dto.purpose,
          orderId: orderId ? String(orderId) : undefined,
        },
      });
      intent.gatewayRef = charge.gatewayRef;
      intent.checkoutUrl = charge.checkoutUrl;
      intent.status = PaymentIntentStatus.Pending;
      await intent.save();
    } catch (error) {
      intent.status = PaymentIntentStatus.Failed;
      intent.lastError = errorMessage(error);
      await intent.save();
      await this.audit.record({
        action: 'payment.create_failed',
        actorType: AuditActorType.User,
        actorId: user.id,
        entityType: 'payment_intent',
        entityId: String(intent._id),
        gateway: dto.gateway,
        status: PaymentIntentStatus.Failed,
        ip,
        metadata: { error: intent.lastError },
      });
      this.logger.error(
        `Gateway ${dto.gateway} createCharge failed: ${intent.lastError}`,
      );
      throw new BadRequestException('Failed to initiate payment with gateway');
    }

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
    if (!intent || TERMINAL_STATUSES.has(intent.status)) {
      return;
    }
    if (intent.gateway !== PaymentGateway.Mfs) {
      return;
    }
    intent.verificationSource = source as PaymentIntentDocument['verificationSource'];
    await intent.save();
    await this.finalizeSuccess(intent);
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
      intent.status = PaymentIntentStatus.Expired;
      intent.lastError = 'Verification attempts exhausted';
      await intent.save();
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
    if (intent.status === PaymentIntentStatus.Succeeded) {
      return; // idempotent: webhook + poll may both arrive
    }

    // Apply the money-moving side effects BEFORE marking the intent succeeded.
    // Both operations are idempotent (order confirmation is a no-op once paid;
    // the deposit is guarded by an idempotency key), so if either throws here
    // the intent stays non-terminal and the webhook/poll retry re-runs them —
    // instead of silently swallowing the failure and stranding the customer's
    // money.
    if (intent.purpose === PaymentPurpose.Order && intent.orderId) {
      await this.orders.confirmPayment(String(intent.orderId), intent._id);
    } else if (intent.purpose === PaymentPurpose.WalletTopup) {
      await this.wallet.deposit({
        userId: intent.userId,
        amount: intent.amount,
        reference: { type: 'payment_intent', id: intent._id },
        idempotencyKey: `topup:${String(intent._id)}`,
        description: `Wallet top-up via ${intent.gateway}`,
        notify: false,
      });
    }

    const paidAt = new Date();
    const finalized = await this.paymentModel
      .findOneAndUpdate(
        {
          _id: intent._id,
          status: { $ne: PaymentIntentStatus.Succeeded },
        },
        {
          $set: {
            status: PaymentIntentStatus.Succeeded,
            paidAt,
          },
          $unset: { expiresAt: 1 },
        },
        { new: true },
      )
      .exec();
    if (!finalized) {
      return;
    }

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
    if (TERMINAL_STATUSES.has(intent.status)) {
      return;
    }
    intent.status = PaymentIntentStatus.Failed;
    intent.lastError = reason;
    await intent.save();

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
      return this.paymentModel.findById(ref).exec();
    }
    return null;
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
    const isStaff = isChatStaff(user.roles);
    if (!isStaff && String(intent.userId) !== user.id) {
      throw new ForbiddenException('Access denied');
    }
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
