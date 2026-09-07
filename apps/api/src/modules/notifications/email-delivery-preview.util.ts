import { NotificationEvent } from '../../common/enums';
import type { OrderDocument } from '../../database/schemas/order.schema';
import type { EffectiveEmailSettings } from '../../integrations/mail/email-settings.service';
import {
  ORDER_CUSTOMER_EMAIL_TEMPLATE_ID,
  ORDER_CUSTOMER_NOTE_TEMPLATE_ID,
  ORDER_PENDING_TEMPLATE_ID,
  resolveOrderStatusTemplateId,
} from '../../integrations/mail/order-email-template.ids';
import {
  genericEmail,
  orderCompletedEmail,
  orderConfirmationEmail,
  orderCustomerNoteEmail,
  orderPaidConfirmationEmail,
  orderPendingEmail,
  orderStatusUpdateEmail,
  paymentFailedEmail,
  type EmailContent,
  type EmailOrderItem,
} from '../../integrations/mail/email-templates';

type PreviewVars = Record<string, string | undefined>;

export type DeliveryPreviewBuildResult =
  | {
      kind: 'template';
      templateId: string;
      content: EmailContent;
      vars: PreviewVars;
    }
  | {
      kind: 'generic';
      content: EmailContent;
    };

type BuildInput = {
  event: string;
  title?: string;
  settings: EffectiveEmailSettings;
  order: OrderDocument | null;
  name?: string;
  orderUrl?: string;
  items?: EmailOrderItem[];
  recipient?: string;
};

function orderPricing(order: OrderDocument | null) {
  return {
    total: order?.pricing?.total ?? 0,
    currency: order?.pricing?.currency ?? 'BDT',
  };
}

function templatePreview(
  templateId: string,
  content: EmailContent,
  vars: PreviewVars,
): DeliveryPreviewBuildResult {
  return { kind: 'template', templateId, content, vars };
}

export function buildDeliveryPreviewContent(
  input: BuildInput,
): DeliveryPreviewBuildResult | null {
  const { event, title, settings, order, name, orderUrl, items, recipient } =
    input;
  const { total, currency } = orderPricing(order);
  const orderNumber = order?.orderNumber ?? '—';
  const baseVars: PreviewVars = {
    customer_name: name,
    order_number: orderNumber,
    order_id: orderUrl?.split('/').pop(),
    order_total: order ? `${currency} ${total}` : undefined,
  };

  switch (event) {
    case ORDER_PENDING_TEMPLATE_ID:
      if (!order) return null;
      return templatePreview(
        ORDER_PENDING_TEMPLATE_ID,
        orderPendingEmail(settings, {
          name,
          orderNumber,
          items,
          total,
          currency,
          orderUrl,
        }),
        baseVars,
      );

    case ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.paid:
    case NotificationEvent.OrderPaid:
      if (!order) return null;
      return templatePreview(
        ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.paid,
        orderPaidConfirmationEmail(settings, {
          name,
          orderNumber,
          items,
          total,
          currency,
          customerEmail: recipient,
          customerMobile: order.contact?.mobile,
          paymentMethod: order.payment?.method,
          orderUrl,
        }),
        baseVars,
      );

    case NotificationEvent.OrderPlaced:
      if (!order) return null;
      return templatePreview(
        ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.processing,
        orderConfirmationEmail(settings, {
          name,
          orderNumber,
          items,
          total,
          currency,
          orderUrl,
        }),
        baseVars,
      );

    case ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.processing:
      if (!order) return null;
      return templatePreview(
        ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.processing,
        orderStatusUpdateEmail(settings, {
          name,
          orderNumber,
          status: 'processing',
          orderUrl,
        }),
        baseVars,
      );

    case ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.delivered:
    case NotificationEvent.OrderDelivered:
      if (!order) return null;
      return templatePreview(
        ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.delivered,
        orderCompletedEmail(settings, {
          name,
          orderNumber,
          message:
            order.deliveryMessage?.trim() ||
            'Your order is complete. Open your order details for codes and instructions.',
          orderUrl,
        }),
        baseVars,
      );

    case ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.cancelled:
      if (!order) return null;
      return templatePreview(
        ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.cancelled,
        orderStatusUpdateEmail(settings, {
          name,
          orderNumber,
          status: 'cancelled',
          orderUrl,
        }),
        baseVars,
      );

    case ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.refunded:
    case NotificationEvent.OrderRefunded:
      if (!order) return null;
      return templatePreview(
        ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.refunded,
        orderStatusUpdateEmail(settings, {
          name,
          orderNumber,
          status: 'refunded',
          orderUrl,
        }),
        baseVars,
      );

    case ORDER_CUSTOMER_NOTE_TEMPLATE_ID:
    case NotificationEvent.OrderNote:
      if (!order) return null;
      return templatePreview(
        ORDER_CUSTOMER_NOTE_TEMPLATE_ID,
        orderCustomerNoteEmail(settings, {
          name,
          orderNumber,
          message:
            order.deliveryMessage?.trim() ||
            'Message content is no longer available on this order.',
          orderUrl,
        }),
        {
          ...baseVars,
          note_message: order.deliveryMessage?.replace(/\n/g, '<br/>'),
        },
      );

    case NotificationEvent.PaymentFailed:
    case 'payment.failed':
      return templatePreview(
        'order.failed',
        paymentFailedEmail(settings, {
          name,
          orderNumber: order?.orderNumber,
          amount: total,
          currency,
          retryUrl: orderUrl,
        }),
        {
          ...baseVars,
          failure_reason: undefined,
        },
      );

    default: {
      if (order) {
        const statusTemplateId = resolveOrderStatusTemplateId(event);
        if (statusTemplateId.startsWith('order.')) {
          if (statusTemplateId === ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.delivered) {
            return templatePreview(
              statusTemplateId,
              orderCompletedEmail(settings, {
                name,
                orderNumber,
                message: order.deliveryMessage?.trim(),
                orderUrl,
              }),
              baseVars,
            );
          }
          if (statusTemplateId === ORDER_CUSTOMER_EMAIL_TEMPLATE_ID.paid) {
            return templatePreview(
              statusTemplateId,
              orderPaidConfirmationEmail(settings, {
                name,
                orderNumber,
                items,
                total,
                currency,
                customerEmail: recipient,
                orderUrl,
              }),
              baseVars,
            );
          }
          return templatePreview(
            statusTemplateId,
            orderStatusUpdateEmail(settings, {
              name,
              orderNumber,
              status: event.replace(/^order\./, '').replace(/_/g, ' '),
              orderUrl,
            }),
            baseVars,
          );
        }
      }

      const fallbackTitle = title?.trim() || event;
      return {
        kind: 'generic',
        content: genericEmail(settings, {
          title: fallbackTitle,
          body:
            title?.trim() ||
            'This notification was sent to the customer. Detailed body text was not stored for this log entry.',
        }),
      };
    }
  }
}
