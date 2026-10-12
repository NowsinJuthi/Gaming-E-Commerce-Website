export enum PaymentIntentStatus {
  Created = 'created',
  /** Exclusive lease while the first createCharge() call is in flight. */
  Initializing = 'initializing',
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Expired = 'expired',
  /**
   * Replaced by another gateway for the same order. Not a Failed terminal:
   * a late capture must still enter unmatched reconciliation.
   */
  Superseded = 'superseded',
  /** Gateway captured money after the order was already paid by another intent. */
  Unmatched = 'unmatched',
}

export enum PaymentPurpose {
  WalletTopup = 'wallet_topup',
  Order = 'order',
}
