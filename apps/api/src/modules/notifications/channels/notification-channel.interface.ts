import { NotificationChannel } from '../../../common/enums';

export interface ChannelSendInput {
  userId: string;
  /** Channel-specific address: email / telegram chatId / device token. */
  recipient: string;
  title: string;
  body: string;
  event: string;
  data?: Record<string, unknown>;
}

export interface ChannelSendResult {
  success: boolean;
  /** True when no provider is configured and the send was logged only. */
  skipped?: boolean;
  providerRef?: string;
  error?: string;
}

/** Anti-corruption contract every delivery channel implements. */
export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
}

export const NOTIFICATION_CHANNELS = 'NOTIFICATION_CHANNELS';
