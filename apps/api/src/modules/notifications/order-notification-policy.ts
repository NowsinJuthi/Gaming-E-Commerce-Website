import { OrderStatus } from '../../common/enums';
import type { OrderDocument } from '../../database/schemas/order.schema';

/**
 * Order notification policy — channels are independent (email fixes must not touch Telegram).
 *
 * | Event                    | Customer email | Admin email | Admin Telegram | In-app |
 * |--------------------------|----------------|-------------|----------------|--------|
 * | Pending order create     | No             | Yes         | No             | No     |
 * | Payment submitted/paid   | Yes (confirmed)| No          | Yes (paid)     | No     |
 * | Status → Processing      | No*            | No          | No**           | No     |
 * | Status → Delivered       | Yes            | No          | No**           | Yes    |
 * | Status → Cancelled       | Yes            | No          | No             | No     |
 * | Status → Refunded        | Yes            | No          | No             | Yes    |
 * | Live chat message        | No             | No          | Yes (chat)     | No     |
 *
 * Customer email: CustomerOrderMailService.trySendStatusEmail (SMTP, direct).
 * Admin email: MailerService.sendAdminNewOrder on pending create only.
 * Admin Telegram: TelegramOrderNotifier.notifyAdminOrderStage (not manual complete).
 * In-app: NotificationDispatcher on delivered, note, refunded.
 *
 * *Processing customer email is skipped when order confirmation was already sent at payment.
 *
 * **Admin Telegram: one alert per new paid order (`paid` stage). Processing alerts are not
 * sent. Fulfilled alerts only when delivery completes later (skipped if auto-delivered
 * within 2 minutes of the paid alert). Chat alerts use TelegramChatNotifier separately.
 */

export type AdminOrderTelegramStage = 'paid' | 'processing' | 'fulfilled';

export type CustomerOrderEmailStatus =
  | 'paid'
  | 'processing'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export const CUSTOMER_ORDER_EMAIL_STATUSES: CustomerOrderEmailStatus[] = [
  'paid',
  'processing',
  'delivered',
  'cancelled',
  'refunded',
];

export const ADMIN_TELEGRAM_STAGE_LABEL: Record<AdminOrderTelegramStage, string> =
  {
    paid: 'Order paid',
    processing: 'Order processing',
    fulfilled: 'Order fulfilled',
  };

export const ADMIN_TELEGRAM_STAGE_EMOJI: Record<AdminOrderTelegramStage, string> =
  {
    paid: '💰',
    processing: '⚙️',
    fulfilled: '✅',
  };

/** Statuses that may trigger admin Telegram alerts (never Pending or manual Delivered). */
export const ADMIN_TELEGRAM_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.Paid,
  OrderStatus.Processing,
]);

type OrderNotificationSnapshot = Pick<
  OrderDocument,
  'status' | 'orderNumber' | 'payment'
>;

/** Pending checkout must never trigger admin Telegram (paid / processing / fulfilled). */
export function blocksAdminTelegramForPendingOrder(
  order: OrderNotificationSnapshot,
): boolean {
  return order.status === OrderStatus.Pending;
}

/**
 * Block customer SMTP only on unpaid checkout (Pending). Paid / processing /
 * delivered / refunded paths must keep working — do not add extra status gates here.
 */
export function allowsCustomerOrderEmail(
  order: OrderNotificationSnapshot,
  emailStatus: CustomerOrderEmailStatus,
): boolean {
  if (emailStatus === 'cancelled') {
    return true;
  }
  return order.status !== OrderStatus.Pending;
}
