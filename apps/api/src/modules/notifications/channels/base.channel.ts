import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '../../../common/enums';
import {
  ChannelSendInput,
  ChannelSendResult,
  NotificationChannelAdapter,
} from './notification-channel.interface';

type Json = Record<string, unknown>;

const HTTP_TIMEOUT_MS = 10_000;

/**
 * Shared channel behavior: config access, a JSON HTTP helper, and a sandbox
 * fallback (log-only) used whenever the provider is not configured.
 */
export abstract class BaseChannel implements NotificationChannelAdapter {
  abstract readonly channel: NotificationChannel;
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly config: ConfigService) {}

  abstract send(input: ChannelSendInput): Promise<ChannelSendResult>;

  protected abstract isConfigured(): boolean;

  protected sandbox(input: ChannelSendInput): ChannelSendResult {
    this.logger.warn(
      `${this.channel} not configured — sandbox delivery to ${input.recipient}: ${input.title}`,
    );
    return { success: true, skipped: true };
  }

  protected async httpJson(
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ): Promise<Json> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `${this.channel} HTTP ${res.status}: ${text.slice(0, 500)}`,
        );
      }
      if (!text) {
        return {};
      }
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? (parsed as Json) : {};
    } finally {
      clearTimeout(timer);
    }
  }

  protected asString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
  }
}
