export enum WalletStatus {
  Active = 'active',
  Frozen = 'frozen',
}

export enum WalletTransactionType {
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
  Cashback = 'cashback',
  ReferralBonus = 'referral_bonus',
  AffiliateCommission = 'affiliate_commission',
  Purchase = 'purchase',
  Refund = 'refund',
  Adjustment = 'adjustment',
}

export enum WalletTransactionDirection {
  Credit = 'credit',
  Debit = 'debit',
}

export enum WalletTransactionStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
  Reversed = 'reversed',
}
