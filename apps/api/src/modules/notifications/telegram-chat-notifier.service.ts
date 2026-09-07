import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import type { ChatRoomDocument } from '../../database/schemas/chat-room.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TelegramSettingsService } from './telegram-settings.service';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

@Injectable()
export class TelegramChatNotifier {
  private readonly logger = new Logger(TelegramChatNotifier.name);

  constructor(
    private readonly telegram: TelegramSettingsService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async notifyCustomerMessage(
    room: ChatRoomDocument,
    sender: AuthenticatedUser,
    body?: string,
    imageUrl?: string,
  ): Promise<void> {
    try {
      const settings = await this.telegram.getSettings();
      if (!settings.enabled || !settings.configured || !settings.notifyOnCustomerChat) {
        return;
      }

      const roomId = String(room._id);
      const throttleKey = CacheKeys.telegram.chatAlertThrottle(roomId);
      const throttled = await this.cache.get(throttleKey);
      if (throttled) {
        return;
      }

      const preview = previewMessage(body, imageUrl);
      const replyUrl = this.buildReplyUrl(roomId);
      const subject = room.subject?.trim() || 'Live Support';
      const customerLabel = sender.email?.trim() || 'Customer';

      const text = [
        '<b>💬 New customer message</b>',
        '',
        `<b>Chat:</b> ${escapeHtml(subject)}`,
        `<b>Customer:</b> ${escapeHtml(customerLabel)}`,
        `<b>Message:</b> ${escapeHtml(preview || '—')}`,
        '',
        `<b>Reply link:</b>`,
        `<a href="${escapeHtml(replyUrl)}">${escapeHtml(replyUrl)}</a>`,
      ].join('\n');

      const result = await this.telegram.sendHtmlMessage(text, undefined, {
        replyMarkup: {
          inline_keyboard: [
            [{ text: '💬 Reply in chat', url: replyUrl }],
          ],
        },
      });

      if (result.success) {
        await this.cache.set(
          throttleKey,
          String(Date.now()),
          CacheKeys.ttl.telegramChatAlert,
        );
      } else if (!result.skipped) {
        this.logger.warn(
          `Telegram chat alert failed for room ${roomId}: ${result.error ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Telegram chat alert error for room ${String(room._id)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private buildReplyUrl(roomId: string): string {
    const appUrl =
      this.config.get<string>('payments.appUrl') ??
      process.env.WEB_APP_URL ??
      'http://localhost:3000';
    return `${appUrl.replace(/\/$/, '')}/admin/chat?room=${encodeURIComponent(roomId)}`;
  }
}

function previewMessage(body?: string, imageUrl?: string): string {
  const text = body?.trim() ?? '';
  if (text) return text.slice(0, 500);
  if (imageUrl?.trim()) return '[Image]';
  return '';
}
