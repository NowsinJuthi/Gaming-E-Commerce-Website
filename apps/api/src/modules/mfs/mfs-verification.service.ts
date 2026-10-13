import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PaymentGateway,
  PaymentIntentStatus,
  PaymentPurpose,
} from '../../common/enums';
import { round2 } from '../../common/utils/money';
import { isChatStaff } from '../../common/utils/role.utils';
import {
  Order,
  OrderDocument,
} from '../../database/schemas/order.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import {
  PaymentIntent,
  PaymentIntentDocument,
} from '../../database/schemas/payment-intent.schema';
import {
  SmsLog,
  SmsLogDocument,
  SmsLogStatus,
} from '../../database/schemas/sms-log.schema';
import { PaymentService } from '../payments/payment.service';
import { OrderService } from '../orders/order.service';
import { MfsGatewayService } from './mfs-gateway.service';
import {
  flattenSmsPayloads,
  inferSmsSenderWithFormats,
  isAllowedSmsSenderWithFormats,
  parseSmsFieldsWithFormats,
} from './mfs-sms.parser';
import { MfsSmsFormatService } from './mfs-sms-format.service';
import { buildGuestThankYouPath } from '../../common/utils/guest-order-url';
import { createGuestOrderAccessToken } from '../../common/utils/guest-order-access';
import { resolveGuestOrderAccessSecret } from '../../common/utils/guest-order-secret';
import { assertCanManuallyApproveMfs } from '../../common/utils/mfs-approve-access';
import { AuditActorType } from '../../database/schemas/audit-log.schema';
import { AuditService } from '../../shared/audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';

const TERMINAL = new Set<PaymentIntentStatus>([
  PaymentIntentStatus.Succeeded,
  PaymentIntentStatus.Failed,
  PaymentIntentStatus.Expired,
  PaymentIntentStatus.Unmatched,
]);

export type MfsCheckoutOrderItem = {
  itemIndex: number;
  productId: string;
  slug: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  customerInputs: { label: string; value: string }[];
};

export type MfsCheckoutSummary = {
  purpose: PaymentPurpose;
  title: string;
  orderNumber?: string;
  orderId?: string;
  amount: number;
  currency: string;
  items?: MfsCheckoutOrderItem[];
  subtotal?: number;
  discountTotal?: number;
  couponCode?: string;
  voucherCode?: string;
  contact?: { fullName: string; mobile: string; email: string };
  note?: string;
};

export type MfsCheckoutSession = {
  intentId: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  orderId?: string;
  selectedGateway?: ReturnType<MfsGatewayService['toView']>;
  gateways: ReturnType<MfsGatewayService['toView']>[];
  submittedTrxId?: string;
  redirectUrl?: string;
  summary?: MfsCheckoutSummary;
};

@Injectable()
export class MfsVerificationService {
  private readonly logger = new Logger(MfsVerificationService.name);

  constructor(
    @InjectModel(PaymentIntent.name)
    private readonly paymentModel: Model<PaymentIntentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(SmsLog.name)
    private readonly smsModel: Model<SmsLogDocument>,
    @Inject(forwardRef(() => PaymentService))
    private readonly payments: PaymentService,
    private readonly orders: OrderService,
    private readonly gateways: MfsGatewayService,
    private readonly smsFormats: MfsSmsFormatService,
    private readonly config: ConfigService,
    private readonly rolePermissions: RolePermissionsService,
    private readonly audit: AuditService,
  ) {}

  async listCheckoutGateways() {
    return this.gateways.listActive();
  }

  assertSmsSyncToken(header?: string): void {
    const expected = this.config.get<string>('payments.mfsSmsSyncToken')?.trim();
    if (!expected) {
      throw new UnauthorizedException('MFS SMS sync is not configured');
    }
    if (!header || header !== expected) {
      throw new UnauthorizedException('Invalid SMS sync token');
    }
  }

  async getCheckoutSession(
    userId: string,
    intentId: string,
    isStaff: boolean,
  ): Promise<MfsCheckoutSession> {
    const intent = await this.getMfsIntent(intentId);
    if (!isStaff && String(intent.userId) !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const gateways = await this.gateways.listActive();
    let selectedGateway;
    if (intent.mfsGatewayId) {
      try {
        selectedGateway = this.gateways.toView(
          await this.gateways.getById(String(intent.mfsGatewayId)),
        );
      } catch {
        selectedGateway = undefined;
      }
    }

    const appUrl =
      this.config.get<string>('payments.appUrl') ?? 'http://localhost:3000';
    const redirectUrl = await this.resolvePaidOrderRedirectUrl(intent, appUrl);

    const summary = await this.resolveCheckoutSummary(intent);

    return {
      intentId: String(intent._id),
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      orderId: intent.orderId ? String(intent.orderId) : undefined,
      selectedGateway,
      gateways,
      submittedTrxId: intent.submittedTrxId,
      redirectUrl,
      summary,
    };
  }

  private async resolvePaidOrderRedirectUrl(
    intent: PaymentIntentDocument,
    appUrl: string,
  ): Promise<string | undefined> {
    if (intent.status !== PaymentIntentStatus.Succeeded) {
      return undefined;
    }

    if (intent.purpose === PaymentPurpose.WalletTopup) {
      return `${appUrl}/wallet`;
    }

    if (!intent.orderId) {
      return undefined;
    }

    const order = await this.orderModel.findById(intent.orderId).lean();
    if (!order) {
      return `${appUrl}/orders/${String(intent.orderId)}`;
    }

    const payer = await this.userModel
      .findById(intent.userId)
      .select('isGuest')
      .lean()
      .exec();
    if (payer?.isGuest) {
      const secret = resolveGuestOrderAccessSecret(this.config);
      const token = createGuestOrderAccessToken(
        String(order._id),
        order.orderNumber,
        secret,
      );
      return `${appUrl}${buildGuestThankYouPath({ guestAccessToken: token })}`;
    }

    return `${appUrl}/orders/${String(intent.orderId)}`;
  }

  private async resolveCheckoutSummary(
    intent: PaymentIntentDocument,
  ): Promise<MfsCheckoutSummary | undefined> {
    if (intent.purpose === PaymentPurpose.WalletTopup) {
      return {
        purpose: PaymentPurpose.WalletTopup,
        title: 'Wallet top-up',
        amount: intent.amount,
        currency: intent.currency,
      };
    }

    if (!intent.orderId) return undefined;

    const order = await this.orderModel.findById(intent.orderId).lean();
    if (!order || String(order.userId) !== String(intent.userId)) {
      return undefined;
    }

    const note = order.timeline?.[0]?.note?.trim();

    return {
      purpose: PaymentPurpose.Order,
      title: `Order ${order.orderNumber}`,
      orderNumber: order.orderNumber,
      orderId: String(order._id),
      amount: intent.amount,
      currency: intent.currency,
      items: order.items.map((item, index) => ({
        itemIndex: index,
        productId: String(item.productId),
        slug: item.slug,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        customerInputs: (item.customerInputs ?? []).map((field) => ({
          label: field.label,
          value: field.value,
        })),
      })),
      subtotal: order.pricing.subtotal,
      discountTotal: order.pricing.discountTotal,
      couponCode: order.pricing.couponCode,
      voucherCode: order.pricing.voucherCode,
      contact: order.contact
        ? {
            fullName: order.contact.fullName,
            mobile: order.contact.mobile,
            email: order.contact.email,
          }
        : undefined,
      note: note || undefined,
    };
  }

  async selectGateway(
    userId: string,
    intentId: string,
    gatewayId: string,
    isStaff: boolean,
  ): Promise<MfsCheckoutSession> {
    const intent = await this.getMfsIntent(intentId);
    if (!isStaff && String(intent.userId) !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (TERMINAL.has(intent.status)) {
      throw new BadRequestException('Payment is already finalized');
    }

    const gateway = await this.gateways.getById(gatewayId);
    if (!gateway.isActive) {
      throw new BadRequestException('Selected gateway is not active');
    }
    this.gateways.assertAmountAllowed(gateway, intent.amount);

    intent.mfsGatewayId = gateway._id;
    intent.status = PaymentIntentStatus.Pending;
    await intent.save();

    return this.getCheckoutSession(userId, intentId, isStaff);
  }

  async resetGateway(
    userId: string,
    intentId: string,
    isStaff: boolean,
  ): Promise<MfsCheckoutSession> {
    const intent = await this.getMfsIntent(intentId);
    if (!isStaff && String(intent.userId) !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (TERMINAL.has(intent.status)) {
      throw new BadRequestException('Payment is already finalized');
    }
    intent.mfsGatewayId = undefined;
    await intent.save();
    return this.getCheckoutSession(userId, intentId, isStaff);
  }

  async updateCheckoutItemQuantity(
    userId: string,
    intentId: string,
    itemIndex: number,
    quantity: number,
    isStaff: boolean,
  ): Promise<MfsCheckoutSession> {
    const result = await this.orders.updatePendingOrderItemQuantity(
      userId,
      intentId,
      itemIndex,
      quantity,
    );
    if (result.cancelled) {
      return this.getCheckoutSession(userId, intentId, isStaff);
    }
    return this.getCheckoutSession(userId, intentId, isStaff);
  }

  async removeCheckoutItem(
    userId: string,
    intentId: string,
    itemIndex: number,
    isStaff: boolean,
  ): Promise<MfsCheckoutSession> {
    await this.orders.removePendingOrderItem(userId, intentId, itemIndex);
    return this.getCheckoutSession(userId, intentId, isStaff);
  }

  async submitTrxId(
    userId: string,
    intentId: string,
    trxId: string,
    isStaff: boolean,
  ): Promise<MfsCheckoutSession> {
    const intent = await this.getMfsIntent(intentId);
    if (!isStaff && String(intent.userId) !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (TERMINAL.has(intent.status)) {
      return this.getCheckoutSession(userId, intentId, isStaff);
    }
    if (!intent.mfsGatewayId) {
      throw new BadRequestException('Select a payment method first');
    }

    const normalized = trxId.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Transaction ID is required');
    }

    await this.assertTrxIdAvailable(normalized, intent._id);

    intent.submittedTrxId = normalized;
    await intent.save();

    const matched = await this.tryMatchIntent(intent, normalized, 'trx_submit');
    if (!matched) {
      const sms = await this.smsModel
        .findOne({ trxId: normalized, status: SmsLogStatus.Unmatched })
        .exec();
      if (sms?.amount !== undefined && round2(sms.amount) === round2(intent.amount)) {
        await this.markSmsMatched(sms, intent, 'trx_submit');
        await this.payments.completeVerifiedIntent(String(intent._id), 'trx_submit');
      }
    }

    return this.getCheckoutSession(userId, intentId, isStaff);
  }

  async adminApprove(
    intentId: string,
    actor: AuthenticatedUser,
    reason: string,
  ): Promise<MfsCheckoutSession> {
    const hasFinance = await this.rolePermissions.rolesHavePermission(
      actor.roles,
      'approve_mfs_payments',
    );
    assertCanManuallyApproveMfs(actor.roles, hasFinance);

    const intent = await this.getMfsIntent(intentId);
    if (TERMINAL.has(intent.status)) {
      return this.getCheckoutSession('', intentId, true);
    }
    intent.verificationSource = 'admin';
    await intent.save();
    await this.audit.record({
      action: 'mfs.manual_approve',
      actorType: AuditActorType.User,
      actorId: actor.id,
      entityType: 'payment_intent',
      entityId: String(intent._id),
      gateway: intent.gateway,
      metadata: { reason: reason.trim() },
    });
    await this.payments.completeVerifiedIntent(String(intent._id), 'admin');
    return this.getCheckoutSession('', intentId, true);
  }

  async syncSms(raw: unknown): Promise<{ processed: number; matched: number }> {
    const formats = await this.smsFormats.getActiveFormats();
    const payloads = flattenSmsPayloads(raw);
    let processed = 0;
    let matched = 0;

    for (const payload of payloads) {
      const effectiveSender = inferSmsSenderWithFormats(
        payload.sender,
        payload.body,
        formats,
      );
      const parsed = parseSmsFieldsWithFormats(
        effectiveSender,
        payload.body,
        payload.trxId,
        payload.amount,
        formats,
      );
      const allowed = isAllowedSmsSenderWithFormats(payload.sender, payload.body, formats);
      if (!allowed && !parsed.trxId && parsed.amount === undefined) {
        continue;
      }

      const normalizedTrx = parsed.trxId?.trim().toUpperCase();
      if (normalizedTrx) {
        const duplicate = await this.smsModel
          .exists({ trxId: normalizedTrx })
          .exec();
        if (duplicate) {
          continue;
        }
      }

      const log = await this.smsModel.create({
        sender: effectiveSender || payload.sender || 'sms',
        body: payload.body,
        trxId: normalizedTrx ?? parsed.trxId,
        amount: parsed.amount,
        status: SmsLogStatus.Unmatched,
        smsTimestamp: payload.smsTimestamp ?? new Date(),
      });
      processed += 1;

      if (!normalizedTrx || parsed.amount === undefined) continue;

      const didMatch = await this.matchSmsLog(log, normalizedTrx, parsed.amount);
      if (didMatch) matched += 1;
    }

    return { processed, matched };
  }

  /** Response shape expected by the legacy pay.uniqbd.com Android app. */
  async syncSmsLegacyApp(raw: unknown): Promise<{
    httpStatus: 200 | 403;
    body: Record<string, string>;
  }> {
    const formats = await this.smsFormats.getActiveFormats();
    const payloads = flattenSmsPayloads(raw);
    let processed = 0;
    let alreadyStored = 0;
    let rejectedDump = '';

    for (const payload of payloads) {
      const effectiveSender = inferSmsSenderWithFormats(
        payload.sender,
        payload.body,
        formats,
      );
      const parsed = parseSmsFieldsWithFormats(
        effectiveSender,
        payload.body,
        payload.trxId,
        payload.amount,
        formats,
      );
      if (!payload.body.trim()) {
        rejectedDump = JSON.stringify(payload).slice(0, 100);
        continue;
      }

      const normalizedTrx = parsed.trxId?.trim().toUpperCase();
      if (normalizedTrx) {
        const duplicate = await this.smsModel
          .exists({ trxId: normalizedTrx })
          .exec();
        if (duplicate) {
          alreadyStored += 1;
          continue;
        }
      }

      const log = await this.smsModel.create({
        sender: effectiveSender || payload.sender || 'sms',
        body: payload.body,
        trxId: normalizedTrx ?? parsed.trxId,
        amount: parsed.amount,
        status: SmsLogStatus.Unmatched,
        smsTimestamp: payload.smsTimestamp ?? new Date(),
      });
      processed += 1;

      if (normalizedTrx && parsed.amount !== undefined) {
        await this.matchSmsLog(log, normalizedTrx, parsed.amount);
      }
    }

    if (processed === 0 && alreadyStored === 0) {
      return {
        httpStatus: 403,
        body: {
          status: 'error',
          message: `Ignored. Dump: ${rejectedDump || JSON.stringify(raw).slice(0, 100)}`,
        },
      };
    }

    return {
      httpStatus: 200,
      body: {
        status: 'success',
        message: 'SMS synced and analyzed',
      },
    };
  }

  async getVerificationStatus(
    intentId: string,
  ): Promise<'succeeded' | 'pending' | 'failed'> {
    const intent = await this.paymentModel.findById(intentId).exec();
    if (!intent) return 'failed';
    if (intent.status === PaymentIntentStatus.Succeeded) return 'succeeded';
    if (TERMINAL.has(intent.status)) return 'failed';
    if (!intent.submittedTrxId) return 'pending';

    const sms = await this.smsModel
      .findOne({
        trxId: intent.submittedTrxId,
        status: SmsLogStatus.Unmatched,
      })
      .exec();
    if (sms?.amount !== undefined && round2(sms.amount) === round2(intent.amount)) {
      await this.markSmsMatched(sms, intent, 'sms');
      await this.payments.completeVerifiedIntent(String(intent._id), 'sms');
      return 'succeeded';
    }

    const refreshed = await this.paymentModel.findById(intentId).exec();
    if (refreshed?.status === PaymentIntentStatus.Succeeded) {
      return 'succeeded';
    }
    return 'pending';
  }

  async listSmsLogs(opts: {
    status?: SmsLogStatus;
    trxId?: string;
    limit?: number;
  }): Promise<
    Array<{
      _id: string;
      sender?: string;
      body: string;
      trxId?: string;
      amount?: number;
      status: SmsLogStatus;
      matchedPaymentIntentId?: string;
      smsTimestamp?: Date;
      createdAt?: Date;
      updatedAt?: Date;
    }>
  > {
    const filter: Record<string, unknown> = {};
    if (opts.status) filter.status = opts.status;
    const trx = opts.trxId?.trim();
    if (trx) {
      const escaped = trx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = { $regex: escaped, $options: 'i' };
      filter.$or = [{ trxId: pattern }, { body: pattern }];
    }
    const docs = await this.smsModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(trx ? 200 : (opts.limit ?? 100))
      .exec();
    return docs.map((doc) => ({
      _id: String(doc._id),
      sender: doc.sender,
      body: doc.body,
      trxId: doc.trxId,
      amount: doc.amount,
      status: doc.status,
      matchedPaymentIntentId: doc.matchedPaymentIntentId
        ? String(doc.matchedPaymentIntentId)
        : undefined,
      smsTimestamp: doc.smsTimestamp,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  async deleteSmsLog(id: string): Promise<{ deleted: number }> {
    return this.deleteSmsLogs([id]);
  }

  async deleteSmsLogs(
    ids?: string[],
    trxIds?: string[],
  ): Promise<{ deleted: number }> {
    const uniqueIds = [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
    const uniqueTrx = [
      ...new Set(
        (trxIds ?? [])
          .map((trx) => trx.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];

    if (uniqueIds.length === 0 && uniqueTrx.length === 0) {
      throw new BadRequestException('No SMS logs selected');
    }

    const or: Record<string, unknown>[] = [];
    const objectIds = uniqueIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (objectIds.length > 0) {
      or.push({ _id: { $in: objectIds } });
    }
    if (uniqueTrx.length > 0) {
      or.push({ trxId: { $in: uniqueTrx } });
    }
    if (or.length === 0) {
      throw new BadRequestException('Invalid SMS log ids');
    }

    const result = await this.smsModel.deleteMany({ $or: or });
    const deleted = result.deletedCount ?? 0;
    if (deleted === 0) {
      throw new NotFoundException('SMS log not found');
    }
    return { deleted };
  }

  async updateSmsLogStatus(
    id: string,
    status: SmsLogStatus,
  ): Promise<SmsLogDocument> {
    const doc = await this.smsModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('SMS log not found');
    }
    doc.status = status;
    if (status !== SmsLogStatus.Matched) {
      doc.matchedPaymentIntentId = undefined;
    }
    await doc.save();
    return doc;
  }

  async bulkUpdateSmsLogStatus(
    ids: string[],
    status: SmsLogStatus,
  ): Promise<{ updated: number }> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('No SMS logs selected');
    }
    const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));
    const update =
      status === SmsLogStatus.Matched
        ? { $set: { status } }
        : {
            $set: { status },
            $unset: { matchedPaymentIntentId: 1 },
          };
    const result = await this.smsModel.updateMany(
      { _id: { $in: objectIds } },
      update,
    );
    return { updated: result.modifiedCount ?? 0 };
  }

  async listMfsIntents(opts: {
    status?: PaymentIntentStatus;
    limit?: number;
  }): Promise<PaymentIntentDocument[]> {
    const filter: Record<string, unknown> = { gateway: PaymentGateway.Mfs };
    if (opts.status) filter.status = opts.status;
    return this.paymentModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(opts.limit ?? 100)
      .exec();
  }

  private async getMfsIntent(intentId: string): Promise<PaymentIntentDocument> {
    const intent = await this.paymentModel.findById(intentId).exec();
    if (!intent) throw new NotFoundException('Payment not found');
    if (intent.gateway !== PaymentGateway.Mfs) {
      throw new BadRequestException('Not an MFS payment');
    }
    return intent;
  }

  private async assertTrxIdAvailable(
    trxId: string,
    currentIntentId: Types.ObjectId,
  ): Promise<void> {
    // Find any other intent that already claims this TrxID.
    const existing = await this.paymentModel
      .findOne({ submittedTrxId: trxId, _id: { $ne: currentIntentId } })
      .select('status')
      .lean()
      .exec();

    if (!existing) return;

    if (existing.status === PaymentIntentStatus.Succeeded) {
      throw new BadRequestException('This transaction ID was already used');
    }
    // Block non-terminal conflicts: a pending intent held by another session
    // (possibly a different user) already claims this TrxID. Allowing it would
    // let an attacker submit a legitimate TrxID to their own intent and race
    // the SMS matcher to steal the completed payment.
    if (!TERMINAL.has(existing.status)) {
      throw new BadRequestException(
        'This transaction ID is already submitted for another payment',
      );
    }
  }

  private async matchSmsLog(
    log: SmsLogDocument,
    trxId: string,
    amount: number,
  ): Promise<boolean> {
    const normalizedTrx = trxId.trim().toUpperCase();
    let intent = await this.paymentModel
      .findOne({
        gateway: PaymentGateway.Mfs,
        status: PaymentIntentStatus.Pending,
        submittedTrxId: normalizedTrx,
        amount: round2(amount),
      })
      .exec();

    if (!intent) {
      intent = await this.paymentModel
        .findOne({
          gateway: PaymentGateway.Mfs,
          status: PaymentIntentStatus.Pending,
          submittedTrxId: normalizedTrx,
        })
        .exec();
      if (intent && round2(intent.amount) !== round2(amount)) {
        return false;
      }
    }

    if (!intent) return false;

    await this.markSmsMatched(log, intent, 'sms');
    await this.payments.completeVerifiedIntent(String(intent._id), 'sms');
    return true;
  }

  private async tryMatchIntent(
    intent: PaymentIntentDocument,
    trxId: string,
    source: 'sms' | 'trx_submit' | 'admin',
  ): Promise<boolean> {
    const sms = await this.smsModel
      .findOne({ trxId, status: SmsLogStatus.Unmatched })
      .exec();
    if (!sms?.amount || round2(sms.amount) !== round2(intent.amount)) {
      return false;
    }
    await this.markSmsMatched(sms, intent, source);
    await this.payments.completeVerifiedIntent(String(intent._id), source);
    return true;
  }

  private async markSmsMatched(
    log: SmsLogDocument,
    intent: PaymentIntentDocument,
    source: 'sms' | 'trx_submit' | 'admin',
  ): Promise<void> {
    log.status = SmsLogStatus.Matched;
    log.matchedPaymentIntentId = intent._id;
    await log.save();
    intent.verificationSource = source;
    await intent.save();
  }
}

export function isStaffUser(roles: string[]): boolean {
  return isChatStaff(roles);
}
