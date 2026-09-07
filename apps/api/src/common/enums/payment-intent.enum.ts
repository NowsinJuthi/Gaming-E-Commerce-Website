export enum PaymentIntentStatus {
  Created = 'created',
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Expired = 'expired',
}

export enum PaymentPurpose {
  WalletTopup = 'wallet_topup',
  Order = 'order',
}
