import type { CustomerOrderEmailStatus } from '../../modules/notifications/order-notification-policy';

/** Template library IDs for customer order lifecycle emails (admin can disable each). */
export const ORDER_CUSTOMER_EMAIL_TEMPLATE_ID: Record<
  CustomerOrderEmailStatus,
  string
> = {
  paid: 'order.paid',
  processing: 'order.processing',
  delivered: 'order.completed',
  cancelled: 'order.cancelled',
  refunded: 'order.refunded',
};

export const ORDER_CUSTOMER_NOTE_TEMPLATE_ID = 'order.customer_note';

export const ORDER_PENDING_TEMPLATE_ID = 'order.pending';

export const ORDER_FAILED_TEMPLATE_ID = 'order.failed';

export const ORDER_INVOICE_TEMPLATE_ID = 'order.invoice';

export const ORDER_GIFT_CARD_TEMPLATE_ID = 'order.gift_card';

/** Maps mailer status keys (paid, delivered, …) to template library IDs. */
export function resolveOrderStatusTemplateId(status: string): string {
  const statusKey = status.toLowerCase().replace(/\s+/g, '_');
  const templateMap: Record<string, string> = {
    paid: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.paid,
    cancelled: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.cancelled,
    canceled: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.cancelled,
    processing: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.processing,
    completed: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.delivered,
    delivered: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.delivered,
    refunded: ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.refunded,
    on_hold: 'order.on_hold',
    hold: 'order.on_hold',
  };
  return templateMap[statusKey] ?? ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.processing;
}
