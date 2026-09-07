import {
  NotificationChannel,
  NotificationEvent,
  NotificationType,
} from '../../common/enums';

export type NotificationContext = Record<string, unknown>;

export interface RenderedNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationTemplate {
  type: NotificationType;
  defaultChannels: NotificationChannel[];
  render(ctx: NotificationContext): RenderedNotification;
}

const str = (ctx: NotificationContext, key: string, fallback = ''): string => {
  const value = ctx[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
};

const ALL: NotificationChannel[] = [
  NotificationChannel.InApp,
  NotificationChannel.Email,
  NotificationChannel.Push,
  NotificationChannel.Telegram,
];

const INAPP_PUSH: NotificationChannel[] = [
  NotificationChannel.InApp,
  NotificationChannel.Push,
];

/**
 * Event → template registry. `render` maps a loosely-typed context into a
 * channel-agnostic title/body. `defaultChannels` is intersected with the
 * user's enabled channels at dispatch time.
 */
export const NOTIFICATION_TEMPLATES: Record<
  NotificationEvent,
  NotificationTemplate
> = {
  [NotificationEvent.Welcome]: {
    type: NotificationType.System,
    defaultChannels: [NotificationChannel.InApp, NotificationChannel.Email],
    render: (ctx) => ({
      title: 'Welcome to UniQbd',
      body: `Hi ${str(ctx, 'name', 'there')}, your account is ready. Happy shopping!`,
    }),
  },
  [NotificationEvent.EmailVerification]: {
    type: NotificationType.System,
    defaultChannels: [NotificationChannel.Email],
    render: (ctx) => ({
      title: 'Verify your email',
      body: `Use this code to verify your email: ${str(ctx, 'code')}`,
      data: { code: str(ctx, 'code') },
    }),
  },
  [NotificationEvent.PasswordChanged]: {
    type: NotificationType.System,
    defaultChannels: [NotificationChannel.InApp, NotificationChannel.Email],
    render: () => ({
      title: 'Password changed',
      body: 'Your password was changed. If this was not you, contact support immediately.',
    }),
  },
  [NotificationEvent.OrderPlaced]: {
    type: NotificationType.Order,
    defaultChannels: INAPP_PUSH,
    render: (ctx) => ({
      title: `Order ${str(ctx, 'orderNumber')} placed`,
      body: `We received your order ${str(ctx, 'orderNumber')}. Total: ${str(ctx, 'total')} ${str(ctx, 'currency', 'BDT')}.`,
      data: { orderId: str(ctx, 'orderId') },
    }),
  },
  [NotificationEvent.OrderPaid]: {
    type: NotificationType.Order,
    defaultChannels: INAPP_PUSH,
    render: (ctx) => ({
      title: `Payment received for ${str(ctx, 'orderNumber')}`,
      body: `Your payment for order ${str(ctx, 'orderNumber')} was successful. We are preparing your delivery.`,
      data: { orderId: str(ctx, 'orderId') },
    }),
  },
  [NotificationEvent.OrderDelivered]: {
    type: NotificationType.Order,
    defaultChannels: INAPP_PUSH,
    render: (ctx) => {
      const custom = str(ctx, 'deliveryMessage');
      return {
        title: `Order ${str(ctx, 'orderNumber')} delivered`,
        body:
          custom ||
          `Your order ${str(ctx, 'orderNumber')} has been delivered. Check your account for the details.`,
        data: {
          orderId: str(ctx, 'orderId'),
          deliveryMessage: custom || undefined,
          emailChannel: str(ctx, 'emailChannel') || undefined,
        },
      };
    },
  },
  [NotificationEvent.OrderNote]: {
    type: NotificationType.Order,
    defaultChannels: INAPP_PUSH,
    render: (ctx) => ({
      title: `Message for order ${str(ctx, 'orderNumber')}`,
      body: str(ctx, 'message') || `You have a new message regarding order ${str(ctx, 'orderNumber')}.`,
      data: {
        orderId: str(ctx, 'orderId'),
        message: str(ctx, 'message') || undefined,
        emailChannel: str(ctx, 'emailChannel') || undefined,
      },
    }),
  },
  [NotificationEvent.OrderRefunded]: {
    type: NotificationType.Order,
    defaultChannels: INAPP_PUSH,
    render: (ctx) => ({
      title: `Order ${str(ctx, 'orderNumber')} refunded`,
      body: `A refund of ${str(ctx, 'amount')} ${str(ctx, 'currency', 'BDT')} has been processed for order ${str(ctx, 'orderNumber')}.`,
      data: { orderId: str(ctx, 'orderId') },
    }),
  },
  [NotificationEvent.PaymentFailed]: {
    type: NotificationType.Order,
    defaultChannels: INAPP_PUSH,
    render: (ctx) => ({
      title: 'Payment failed',
      body: `Your payment of ${str(ctx, 'amount')} ${str(ctx, 'currency', 'BDT')} could not be completed. No money has been deducted — you can try again.`,
      data: {
        amount: str(ctx, 'amount'),
        currency: str(ctx, 'currency', 'BDT'),
        reason: str(ctx, 'reason'),
        orderId: str(ctx, 'orderId'),
        orderNumber: str(ctx, 'orderNumber'),
      },
    }),
  },
  [NotificationEvent.WalletCredited]: {
    type: NotificationType.Wallet,
    defaultChannels: INAPP_PUSH,
    render: (ctx) => ({
      title: 'Wallet credited',
      body: `${str(ctx, 'amount')} ${str(ctx, 'currency', 'BDT')} was added to your wallet.`,
    }),
  },
  [NotificationEvent.WalletDebited]: {
    type: NotificationType.Wallet,
    defaultChannels: INAPP_PUSH,
    render: (ctx) => ({
      title: 'Wallet debited',
      body: `${str(ctx, 'amount')} ${str(ctx, 'currency', 'BDT')} was deducted from your wallet.`,
    }),
  },
  [NotificationEvent.WithdrawalProcessed]: {
    type: NotificationType.Wallet,
    defaultChannels: [NotificationChannel.InApp, NotificationChannel.Email],
    render: (ctx) => ({
      title: 'Withdrawal update',
      body: `Your withdrawal of ${str(ctx, 'amount')} ${str(ctx, 'currency', 'BDT')} is now ${str(ctx, 'status', 'updated')}.`,
    }),
  },
  [NotificationEvent.AffiliatePayout]: {
    type: NotificationType.Wallet,
    defaultChannels: [NotificationChannel.InApp, NotificationChannel.Email],
    render: (ctx) => ({
      title: 'Affiliate commission paid',
      body: `Your commission of ${str(ctx, 'amount')} ${str(ctx, 'currency', 'BDT')} has been credited.`,
    }),
  },
  [NotificationEvent.TicketReply]: {
    type: NotificationType.System,
    defaultChannels: ALL,
    render: (ctx) => ({
      title: `New reply on ticket ${str(ctx, 'ticketNumber')}`,
      body: str(ctx, 'preview', 'You have a new reply on your support ticket.'),
      data: { ticketId: str(ctx, 'ticketId') },
    }),
  },
  [NotificationEvent.Custom]: {
    type: NotificationType.System,
    defaultChannels: [NotificationChannel.InApp],
    render: (ctx) => ({
      title: str(ctx, 'title', 'Notification'),
      body: str(ctx, 'body'),
      data: ctx,
    }),
  },
};
