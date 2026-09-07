/** Domain events that can trigger a multi-channel notification. */
export enum NotificationEvent {
  Welcome = 'user.welcome',
  EmailVerification = 'user.email_verification',
  PasswordChanged = 'user.password_changed',
  OrderPlaced = 'order.placed',
  OrderPaid = 'order.paid',
  OrderDelivered = 'order.delivered',
  OrderNote = 'order.note',
  OrderRefunded = 'order.refunded',
  PaymentFailed = 'payment.failed',
  WalletCredited = 'wallet.credited',
  WalletDebited = 'wallet.debited',
  WithdrawalProcessed = 'wallet.withdrawal_processed',
  AffiliatePayout = 'affiliate.payout',
  TicketReply = 'ticket.reply',
  Custom = 'custom',
}
