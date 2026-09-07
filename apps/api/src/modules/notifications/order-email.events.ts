import { NotificationEvent } from '../../common/enums';

/**
 * Customer order emails use CustomerOrderMailService on status transitions.
 * Admin Telegram uses TelegramOrderNotifier — separate code paths.
 */
export const ORDER_CUSTOMER_EMAIL_EVENTS = new Set<NotificationEvent>([
  NotificationEvent.OrderDelivered,
]);

export function isOrderCustomerEmailEvent(event: string): boolean {
  return ORDER_CUSTOMER_EMAIL_EVENTS.has(event as NotificationEvent);
}

/** Customer SMTP must not fire for pending, payment, or payment-failure events. */
export function blocksCustomerSmtpEmail(event: string): boolean {
  return (
    isOrderCustomerEmailEvent(event) ||
    event === NotificationEvent.PaymentFailed ||
    event === NotificationEvent.OrderPlaced ||
    event === NotificationEvent.OrderPaid ||
    event === NotificationEvent.OrderNote ||
    event === NotificationEvent.OrderRefunded
  );
}

/** No guest-checkout SMTP emails — guests receive mail only on order delivered. */
export const GUEST_CHECKOUT_EMAIL_EVENTS = new Set<NotificationEvent>();
