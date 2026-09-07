import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '../../../common/enums';
import { TelegramChannelConfig } from '../../../config/namespaces/notifications.config';
import { TelegramSettingsService } from '../telegram-settings.service';
import { BaseChannel } from './base.channel';
import {
  ChannelSendInput,
  ChannelSendResult,
} from './notification-channel.interface';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Telegram channel via the Bot API. Uses the admin-saved bot token (or
 * `TELEGRAM_BOT_TOKEN` env fallback). Without a token it logs only.
 */
@Injectable()
export class TelegramChannel extends BaseChannel {
  readonly channel = NotificationChannel.Telegram;

  constructor(
    config: ConfigService,
    private readonly telegramSettings: TelegramSettingsService,
  ) {
    super(config);
  }

  private cfg(): TelegramChannelConfig {
    return this.config.getOrThrow<TelegramChannelConfig>(
      'notifications.telegram',
    );
  }

  protected isConfigured(): boolean {
    return Boolean(this.cfg().botToken);
  }

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const { botToken, apiBase } = await this.telegramSettings.getDeliveryConfig();
    if (!botToken) {
      return this.sandbox(input);
    }

    const url = `${apiBase}/bot${botToken}/sendMessage`;
    const text = `<b>${escapeHtml(input.title)}</b>\n${escapeHtml(input.body)}`;
    try {
      const json = await this.httpJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: input.recipient.trim(),
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (json.ok === false) {
        return {
          success: false,
          error: this.asString(json.description) ?? 'Telegram API error',
        };
      }
      const result =
        json.result && typeof json.result === 'object'
          ? (json.result as Record<string, unknown>)
          : {};
      return { success: true, providerRef: this.asString(result.message_id) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
