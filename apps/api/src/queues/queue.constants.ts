export const ORDERS_QUEUE = 'orders';

export enum OrderJob {
  Fulfill = 'fulfill',
  Expire = 'expire',
  Refund = 'refund',
}

export interface OrderJobData {
  orderId: string;
  reason?: string;
}

export const PAYMENTS_QUEUE = 'payments';

export enum PaymentJob {
  /** Poll the gateway to settle a still-pending intent (retry workflow). */
  Verify = 'verify',
  /** Apply wallet/order side effects after a Succeeded claim. */
  Settle = 'settle',
}

export interface PaymentJobData {
  intentId: string;
  attempt?: number;
}

export const DELIVERY_QUEUE = 'delivery';

export enum DeliveryJob {
  /** Auto-deliver a paid order: procure from suppliers + hand over codes. */
  Deliver = 'deliver',
}

export interface DeliveryJobData {
  orderId: string;
}

/** Retry strategy for the auto-delivery pipeline. */
export const DELIVERY_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export const NOTIFICATIONS_QUEUE = 'notifications';

export enum NotificationJob {
  /** Deliver a rendered notification over a single external channel. */
  Send = 'send',
}

export interface NotificationJobData {
  userId: string;
  event: string;
  channel: string;
  recipient: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Retry strategy for channel delivery (transient provider failures). */
export const NOTIFICATION_JOB_OPTIONS = {
  attempts: 4,
  backoff: { type: 'exponential' as const, delay: 3000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export const CHAT_QUEUE = 'chat';

export enum ChatJob {
  /** Delete old chat image attachments (older than 90 days) */
  CleanupOldImages = 'cleanup-old-images',
}

export interface ChatJobData {
  /** Number of days before images are deleted */
  olderThanDays?: number;
}

/** Retry strategy for chat image cleanup (idempotent, safe to retry) */
export const CHAT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};
