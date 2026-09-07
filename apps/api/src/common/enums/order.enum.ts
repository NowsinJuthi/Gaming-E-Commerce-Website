export enum OrderStatus {
  Pending = 'pending',
  Paid = 'paid',
  Processing = 'processing',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
  Failed = 'failed',
}

export enum PaymentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum PaymentMethod {
  Wallet = 'wallet',
  Manual = 'manual',
  Gateway = 'gateway',
}
