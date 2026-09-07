import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '../../../common/enums';
import { PushChannelConfig } from '../../../config/namespaces/notifications.config';
import { BaseChannel } from './base.channel';
import {
  ChannelSendInput,
  ChannelSendResult,
} from './notification-channel.interface';

/**
 * Push channel via Firebase Cloud Messaging legacy HTTP API. The recipient is
 * a device token. Without `FCM_SERVER_KEY` it logs only.
 */
@Injectable()
export class PushChannel extends BaseChannel {
  readonly channel = NotificationChannel.Push;

  constructor(config: ConfigService) {
    super(config);
  }

  private cfg(): PushChannelConfig {
    return this.config.getOrThrow<PushChannelConfig>('notifications.push');
  }

  protected isConfigured(): boolean {
    return Boolean(this.cfg().fcmServerKey);
  }

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!this.isConfigured()) {
      return this.sandbox(input);
    }
    const cfg = this.cfg();
    try {
      const json = await this.httpJson(cfg.fcmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${cfg.fcmServerKey ?? ''}`,
        },
        body: JSON.stringify({
          to: input.recipient,
          notification: { title: input.title, body: input.body },
          data: { event: input.event, ...input.data },
        }),
      });
      const failure = typeof json.failure === 'number' ? json.failure : 0;
      if (failure > 0) {
        return { success: false, error: 'FCM reported a delivery failure' };
      }
      return {
        success: true,
        providerRef: this.asString(json.multicast_id),
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
