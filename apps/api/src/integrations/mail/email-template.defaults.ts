import {
  EmailTemplateCategory,
  EmailTemplateRecipient,
} from '../../database/schemas/email-template.schema';

export interface EmailTemplateDefault {
  id: string;
  category: EmailTemplateCategory;
  recipient: EmailTemplateRecipient;
  label: string;
  description: string;
  subject: string;
  heading: string;
  bodyText: string;
  buttonLabel: string;
  buttonUrl: string;
  enabled: boolean;
}

const emptyBody = {
  heading: '',
  bodyText: '',
  buttonLabel: '',
  buttonUrl: '',
};

/** Built-in transactional email definitions (seeded on first access). */
export const EMAIL_TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
  {
    id: 'order.new_admin',
    category: 'orders',
    recipient: 'admin',
    label: 'New Order',
    description:
      'Sent to the store admin when a customer places a new order.',
    subject: '[{{store_name}}] New order incoming — #{{order_number}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.pending',
    category: 'orders',
    recipient: 'customer',
    label: 'Pending Order',
    description:
      'Sent when a customer places an order that is awaiting payment (checkout).',
    subject:
      'Complete payment for order #{{order_number}} — {{store_name}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.cancelled',
    category: 'orders',
    recipient: 'customer',
    label: 'Cancelled Order',
    description: 'Sent when an order is cancelled.',
    subject:
      'Your {{store_name}} order #{{order_number}} has been cancelled',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.processing',
    category: 'orders',
    recipient: 'customer',
    label: 'Processing Order',
    description:
      'Sent when an order moves to processing. Skipped if a payment confirmation email was already sent.',
    subject:
      'Your {{store_name}} order #{{order_number}} is being processed',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.completed',
    category: 'orders',
    recipient: 'customer',
    label: 'Completed Order',
    description: 'Sent when an order is completed or delivered.',
    subject: 'Your {{store_name}} order #{{order_number}} is complete',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.refunded',
    category: 'orders',
    recipient: 'customer',
    label: 'Refunded Order',
    description: 'Sent when a refund is processed.',
    subject: 'Refund processed for order #{{order_number}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.on_hold',
    category: 'orders',
    recipient: 'customer',
    label: 'On Hold Order',
    description:
      'Reserved — no on-hold order status yet. Toggle has no effect until this workflow is added.',
    subject: 'Your {{store_name}} order #{{order_number}} is on hold',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.paid',
    category: 'orders',
    recipient: 'customer',
    label: 'Paid Order',
    description:
      'Payment confirmation receipt (thank-you page design). Sent when an order is paid.',
    subject: 'Payment confirmed — order #{{order_number}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.invoice',
    category: 'orders',
    recipient: 'customer',
    label: 'Invoice',
    description:
      'Payment receipt fallback when Paid Order is disabled. Uses the same receipt layout as Paid Order.',
    subject: 'Payment confirmed — order #{{order_number}}',
    ...emptyBody,
    enabled: false,
  },
  {
    id: 'order.failed',
    category: 'orders',
    recipient: 'customer',
    label: 'Failed Order',
    description:
      'Sent when a gateway payment fails for an order. Requires customer order emails enabled in Email settings.',
    subject: 'Payment issue with order #{{order_number}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.customer_note',
    category: 'orders',
    recipient: 'customer',
    label: 'Note',
    description: 'Sent when staff adds a note to an order.',
    subject: 'Note added to your order #{{order_number}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'order.gift_card',
    category: 'orders',
    recipient: 'customer',
    label: 'Gift Card Delivery',
    description:
      'Reserved — gift card codes are included in the Completed Order email. Separate send coming later.',
    subject: 'Your gift card — order #{{order_number}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'account.verify_email',
    category: 'account',
    recipient: 'customer',
    label: 'Verify Email Address',
    description: 'Sent when a customer needs to verify their email.',
    subject: 'Verify your {{store_name}} email address',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'account.otp_login',
    category: 'account',
    recipient: 'customer',
    label: 'OTP Login Code',
    description: 'Sent when a customer requests an OTP code to log in.',
    subject: 'Your {{store_name}} login code',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'account.new_account',
    category: 'account',
    recipient: 'customer',
    label: 'New Account',
    description: 'Welcome email for new customer accounts.',
    subject: 'Welcome to {{store_name}}!',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'account.reset_password',
    category: 'account',
    recipient: 'customer',
    label: 'Reset Password',
    description: 'Sent when a customer requests a password reset.',
    subject: 'Reset your {{store_name}} password',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'account.chat_reply',
    category: 'account',
    recipient: 'customer',
    label: 'Live Chat Reply',
    description:
      'Sent to the customer when support replies to their live chat message.',
    subject: 'Support replied to your live chat — {{store_name}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'account.product_request_reply',
    category: 'account',
    recipient: 'customer',
    label: 'Product Request Reply',
    description:
      'Sent to the customer when an admin replies to their product request.',
    subject: 'Reply to your product request — {{store_name}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'account.contact_inquiry_reply',
    category: 'account',
    recipient: 'customer',
    label: 'Contact Email Reply',
    description:
      'Sent to the customer when an admin replies to their contact form message.',
    subject: 'Re: {{inquiry_subject}} — {{store_name}}',
    ...emptyBody,
    enabled: true,
  },
  {
    id: 'system.smtp_test',
    category: 'system',
    recipient: 'admin',
    label: 'SMTP Test Email',
    description:
      'Used when verifying SMTP configuration from admin settings.',
    subject: '{{store_name}} — Test email',
    ...emptyBody,
    enabled: true,
  },
];

export const EMAIL_TEMPLATE_ID_SET = new Set(
  EMAIL_TEMPLATE_DEFAULTS.map((d) => d.id),
);
