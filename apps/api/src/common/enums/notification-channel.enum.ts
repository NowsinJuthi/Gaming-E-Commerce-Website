export enum NotificationChannel {
  InApp = 'in_app',
  Email = 'email',
  Push = 'push',
  Telegram = 'telegram',
}

export enum NotificationDeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
  Skipped = 'skipped',
}
