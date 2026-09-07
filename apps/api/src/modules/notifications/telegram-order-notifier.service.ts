import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import {
  ADMIN_TELEGRAM_STAGE_EMOJI,
  ADMIN_TELEGRAM_STAGE_LABEL,
  blocksAdminTelegramForPendingOrder,
  type AdminOrderTelegramStage,
} from './order-notification-policy';
import { TelegramSettingsService } from './telegram-settings.service';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const STAGE_FLAG_FIELD: Record<AdminOrderTelegramStage, string> = {
  paid: 'adminTelegram.paidNotifiedAt',
  processing: 'adminTelegram.processingNotifiedAt',
  fulfilled: 'adminTelegram.fulfilledNotifiedAt',
};

/**
 * Admin Telegram alerts for order lifecycle (paid / processing / auto-fulfilled).
 * Does not send customer email and is not wired to admin manual complete.
 */
@Injectable()
export class TelegramOrderNotifier {
  private readonly logger = new Logger(TelegramOrderNotifier.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly telegram: TelegramSettingsService,
    private readonly config: ConfigService,
  ) {}

  /** Paid, processing, or auto-fulfilled — not pending checkout or admin manual complete. */
  async notifyAdminOrderStage(
    order: OrderDocument,
    stage: AdminOrderTelegramStage,
  ): Promise<void> {
    try {
      if (blocksAdminTelegramForPendingOrder(order)) {
        this.logger.warn(
          `Telegram ${stage} alert skipped for ${order.orderNumber} — order is still pending checkout`,
        );
        return;
      }

      const settings = await this.telegram.getSettings();
      if (!settings.configured || !settings.notifyOnOrderPlaced) {
        return;
      }

      const flagField = STAGE_FLAG_FIELD[stage];
      const claimed = await this.orderModel
        .findOneAndUpdate(
          { _id: order._id, [flagField]: { $exists: false } },
          { $set: { [flagField]: new Date() } },
          { new: false },
        )
        .exec();
      if (!claimed) {
        return;
      }

      const appUrl =
        this.config.get<string>('payments.appUrl') ?? 'http://localhost:3000';
      const adminUrl = `${appUrl.replace(/\/$/, '')}/admin/sales/orders/${String(order._id)}`;
      const currency = order.pricing?.currency ?? 'BDT';
      const customerName = order.contact?.fullName?.trim() || '—';
      const customerEmail = order.contact?.email?.trim() || '—';
      const customerMobile = order.contact?.mobile?.trim() || '—';
      const paymentMethod = order.payment?.method ?? '—';
      const itemLines = (order.items ?? [])
        .map((item) => {
          const lineTotal = item.lineTotal ?? item.unitPrice * item.quantity;
          return `• ${escapeHtml(item.title)} ×${item.quantity} — ${escapeHtml(
            formatMoney(lineTotal, currency),
          )}`;
        })
        .join('\n');

      const discounts: string[] = [];
      if (order.pricing?.couponDiscount) {
        discounts.push(
          `Coupon (${escapeHtml(order.pricing.couponCode ?? 'applied')}): -${escapeHtml(
            formatMoney(order.pricing.couponDiscount, currency),
          )}`,
        );
      }
      if (order.pricing?.voucherDiscount) {
        discounts.push(
          `Voucher (${escapeHtml(order.pricing.voucherCode ?? 'applied')}): -${escapeHtml(
            formatMoney(order.pricing.voucherDiscount, currency),
          )}`,
        );
      }

      const stageLabel = ADMIN_TELEGRAM_STAGE_LABEL[stage];
      const stageEmoji = ADMIN_TELEGRAM_STAGE_EMOJI[stage];

      const text = [
        `<b>${stageEmoji} ${escapeHtml(stageLabel)}</b>`,
        '',
        `<b>Order:</b> ${escapeHtml(order.orderNumber)}`,
        `<b>Status:</b> ${escapeHtml(order.status)}`,
        `<b>Payment:</b> ${escapeHtml(String(paymentMethod))}`,
        `<b>Customer:</b> ${escapeHtml(customerName)}`,
        `<b>Email:</b> ${escapeHtml(customerEmail)}`,
        `<b>Mobile:</b> ${escapeHtml(customerMobile)}`,
        '',
        '<b>Items</b>',
        itemLines || '• —',
        ...(discounts.length ? ['', '<b>Discounts</b>', ...discounts] : []),
        '',
        `<b>Total:</b> ${escapeHtml(formatMoney(order.pricing?.total ?? 0, currency))}`,
        '',
        `<a href="${escapeHtml(adminUrl)}">Open in admin</a>`,
      ].join('\n');

      const result = await this.telegram.sendHtmlMessage(text);
      if (!result.success && !result.skipped) {
        await this.clearStageFlag(order._id, stage);
        this.logger.warn(
          `Telegram ${stage} alert failed for ${order.orderNumber}: ${result.error ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      await this.clearStageFlag(order._id, stage);
      this.logger.warn(
        `Telegram ${stage} alert error for ${order.orderNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async clearStageFlag(
    orderId: unknown,
    stage: AdminOrderTelegramStage,
  ): Promise<void> {
    const field = STAGE_FLAG_FIELD[stage].replace('adminTelegram.', '');
    await this.orderModel
      .updateOne({ _id: orderId }, { $unset: { [`adminTelegram.${field}`]: '' } })
      .exec();
  }
}

function formatMoney(amount: number, currency: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
