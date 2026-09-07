import { registerAs } from '@nestjs/config';

export interface EmailChannelConfig {
  apiUrl?: string;
  apiKey?: string;
  from: string;
}

export interface PushChannelConfig {
  fcmServerKey?: string;
  fcmUrl: string;
}

export interface TelegramChannelConfig {
  botToken?: string;
  apiBase: string;
}

/**
 * Channel provider credentials. When a channel's credentials are absent the
 * adapter degrades to a sandbox (log-only) send so the pipeline runs
 * end-to-end in development without live provider secrets.
 */
export const notificationsConfig = registerAs('notifications', () => ({
  email: {
    apiUrl: process.env.EMAIL_API_URL,
    apiKey: process.env.EMAIL_API_KEY,
    from: process.env.EMAIL_FROM ?? 'no-reply@uniqbd.local',
  } satisfies EmailChannelConfig,

  push: {
    fcmServerKey: process.env.FCM_SERVER_KEY,
    fcmUrl: process.env.FCM_URL ?? 'https://fcm.googleapis.com/fcm/send',
  } satisfies PushChannelConfig,

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    apiBase: process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org',
  } satisfies TelegramChannelConfig,
}));
