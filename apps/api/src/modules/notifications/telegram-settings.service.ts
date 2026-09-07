import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { TelegramChannelConfig } from '../../config/namespaces/notifications.config';

import {

  TelegramSettings,

  TelegramSettingsDocument,

} from '../../database/schemas/telegram-settings.schema';

import { UpdateTelegramSettingsDto } from './dto/update-telegram-settings.dto';



const SETTINGS_KEY = 'global';

const HTTP_TIMEOUT_MS = 10_000;



export type TelegramSendOptions = {
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; url: string }>>;
  };
};

export type TelegramDiscoveredChat = {
  chatId: string;
  title: string;
  type: string;
  username?: string;
};

export type TelegramSettingsView = {

  enabled: boolean;

  chatId: string;

  notifyOnOrderPlaced: boolean;

  notifyOnCustomerChat: boolean;

  hasBotToken: boolean;

  botTokenMasked: string;

  botTokenFromEnv: boolean;

  botUsername?: string;

  configured: boolean;

  updatedAt?: Date;

};



type EffectiveTelegramConfig = {

  enabled: boolean;

  botToken: string;

  chatId: string;

  notifyOnOrderPlaced: boolean;

  notifyOnCustomerChat: boolean;

  apiBase: string;

  configured: boolean;

};



@Injectable()

export class TelegramSettingsService {

  private readonly logger = new Logger(TelegramSettingsService.name);



  constructor(

    @InjectModel(TelegramSettings.name)

    private readonly settingsModel: Model<TelegramSettingsDocument>,

    private readonly config: ConfigService,

  ) {}



  async getSettings(): Promise<TelegramSettingsView> {

    const doc = await this.getOrCreate();

    return this.toView(doc);

  }



  async getDeliveryConfig(): Promise<{ botToken: string; apiBase: string }> {

    const doc = await this.getOrCreate();

    return {

      botToken: this.resolveBotToken(doc),

      apiBase: this.apiBase(),

    };

  }



  async updateSettings(

    dto: UpdateTelegramSettingsDto,

  ): Promise<TelegramSettingsView> {

    const doc = await this.getOrCreate();



    if (dto.enabled !== undefined) {

      doc.enabled = dto.enabled;

    }

    if (dto.chatId !== undefined) {

      doc.chatId = normalizeChatId(dto.chatId);

    }

    if (dto.notifyOnOrderPlaced !== undefined) {

      doc.notifyOnOrderPlaced = dto.notifyOnOrderPlaced;

    }

    if (dto.notifyOnCustomerChat !== undefined) {

      doc.notifyOnCustomerChat = dto.notifyOnCustomerChat;

    }

    if (dto.botToken !== undefined) {

      const next = dto.botToken.trim();

      if (next && !next.includes('••••')) {

        doc.botToken = next;

      }

    }



    await doc.save();

    return this.toView(doc);

  }



  async sendHtmlMessage(

    text: string,

    chatId?: string,

    options?: TelegramSendOptions,

  ): Promise<{ success: boolean; error?: string; skipped?: boolean }> {

    const cfg = await this.getEffectiveConfig();

    if (!cfg.enabled) {
      return { success: true, skipped: true };
    }

    const targetChatId = normalizeChatId(chatId ?? cfg.chatId);

    if (!cfg.botToken || !targetChatId) {

      this.logger.warn(

        'Telegram not configured — skipping message delivery (sandbox).',

      );

      return { success: true, skipped: true };

    }



    const url = `${cfg.apiBase}/bot${cfg.botToken}/sendMessage`;

    const payload: Record<string, unknown> = {
      chat_id: coerceChatIdForApi(targetChatId),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    if (options?.replyMarkup) {
      payload.reply_markup = options.replyMarkup;
    }

    try {

      const json = await this.httpJson(url, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload),

      });

      if (json.ok === false) {

        return {

          success: false,

          error: formatTelegramError(asString(json.description)),

        };

      }

      return { success: true };

    } catch (error) {

      return {

        success: false,

        error: error instanceof Error ? error.message : String(error),

      };

    }

  }



  async sendTestMessage(): Promise<{

    success: boolean;

    error?: string;

    botUsername?: string;

  }> {

    const cfg = await this.getEffectiveConfig();

    if (!cfg.botToken) {

      return {

        success: false,

        error: 'Telegram bot token is required. Save a bot token first.',

      };

    }

    if (!cfg.chatId) {

      return {

        success: false,

        error:

          'Telegram chat ID is required. Start a chat with your bot, send any message, then copy chat.id from getUpdates.',

      };

    }



    const verify = await this.verifyBotToken(cfg.botToken, cfg.apiBase);

    if (!verify.ok) {

      return {

        success: false,

        error: verify.error ?? 'Bot token verification failed.',

      };

    }



    const result = await this.sendHtmlMessage(

      '<b>UniQbd test notification</b>\nYour Telegram bot is connected successfully.',

    );

    if (result.skipped) {

      return {

        success: false,

        error: 'Telegram is not configured.',

        botUsername: verify.username,

      };

    }

    if (!result.success) {

      return {

        success: false,

        error: result.error ?? 'Failed to send test message.',

        botUsername: verify.username,

      };

    }

    return { success: true, botUsername: verify.username };

  }



  async discoverChats(botTokenOverride?: string): Promise<{

    chats: TelegramDiscoveredChat[];

    hint?: string;

    webhookWasCleared?: boolean;

  }> {

    const doc = await this.getOrCreate();

    const botToken = botTokenOverride?.trim() || this.resolveBotToken(doc);

    if (!botToken) {

      return {

        chats: [],

        hint: 'Save a bot token first, then try again.',

      };

    }



    const apiBase = this.apiBase();

    const verify = await this.verifyBotToken(botToken, apiBase);

    if (!verify.ok) {

      return {

        chats: [],

        hint: verify.error ?? 'Invalid bot token.',

      };

    }



    let webhookWasCleared = false;

    const webhookInfo = await this.getWebhookInfo(botToken, apiBase);

    if (webhookInfo.url) {

      await this.deleteWebhook(botToken, apiBase);

      webhookWasCleared = true;

    }



    const updates = await this.fetchUpdates(botToken, apiBase);

    const chats = extractChatsFromUpdates(updates);

    if (chats.length) {

      return { chats, webhookWasCleared };

    }



    const botLabel = verify.username ?? 'your bot';

    return {

      chats: [],

      webhookWasCleared,

      hint: `No chats found yet. Open ${botLabel} in Telegram, press Start, send any message (for example "hi"), then click Find chat ID again.`,

    };

  }



  private async getWebhookInfo(

    botToken: string,

    apiBase: string,

  ): Promise<{ url?: string }> {

    try {

      const json = await this.httpJson(`${apiBase}/bot${botToken}/getWebhookInfo`, {

        method: 'GET',

        headers: {},

      });

      const result =

        json.result && typeof json.result === 'object'

          ? (json.result as Record<string, unknown>)

          : {};

      return { url: asString(result.url) };

    } catch {

      return {};

    }

  }



  private async deleteWebhook(botToken: string, apiBase: string): Promise<void> {

    await this.httpJson(`${apiBase}/bot${botToken}/deleteWebhook`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ drop_pending_updates: false }),

    });

  }



  private async fetchUpdates(

    botToken: string,

    apiBase: string,

  ): Promise<Record<string, unknown>[]> {

    const json = await this.httpJson(

      `${apiBase}/bot${botToken}/getUpdates?limit=100&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'edited_message', 'channel_post']))}`,

      {

        method: 'GET',

        headers: {},

      },

    );

    if (json.ok === false) {

      throw new Error(asString(json.description) ?? 'Failed to read Telegram updates.');

    }

    return Array.isArray(json.result)

      ? (json.result as Record<string, unknown>[])

      : [];

  }



  private async verifyBotToken(

    botToken: string,

    apiBase: string,

  ): Promise<{ ok: boolean; username?: string; error?: string }> {

    try {

      const json = await this.httpJson(`${apiBase}/bot${botToken}/getMe`, {

        method: 'GET',

        headers: {},

      });

      if (json.ok === false) {

        return {

          ok: false,

          error: formatTelegramError(

            asString(json.description) ?? 'Invalid bot token.',

          ),

        };

      }

      const result =

        json.result && typeof json.result === 'object'

          ? (json.result as Record<string, unknown>)

          : {};

      const username = asString(result.username);

      return { ok: true, username: username ? `@${username}` : undefined };

    } catch (error) {

      return {

        ok: false,

        error: error instanceof Error ? error.message : String(error),

      };

    }

  }



  private async getEffectiveConfig(): Promise<EffectiveTelegramConfig> {

    const doc = await this.getOrCreate();

    const botToken = this.resolveBotToken(doc);

    const chatId = normalizeChatId(doc.chatId ?? '');

    const apiBase = this.apiBase();

    return {

      enabled: doc.enabled,

      botToken,

      chatId,

      notifyOnOrderPlaced: doc.notifyOnOrderPlaced !== false,

      notifyOnCustomerChat: doc.notifyOnCustomerChat !== false,

      apiBase,

      configured: Boolean(doc.enabled && botToken && chatId),

    };

  }



  private async toView(doc: TelegramSettingsDocument): Promise<TelegramSettingsView> {

    const botToken = this.resolveBotToken(doc);

    const chatId = normalizeChatId(doc.chatId ?? '');

    const view: TelegramSettingsView = {

      enabled: doc.enabled,

      chatId,

      notifyOnOrderPlaced: doc.notifyOnOrderPlaced !== false,

      notifyOnCustomerChat: doc.notifyOnCustomerChat !== false,

      hasBotToken: Boolean(botToken),

      botTokenMasked: maskSecret(botToken),

      botTokenFromEnv: !doc.botToken?.trim() && Boolean(this.envBotToken()),

      configured: Boolean(doc.enabled && botToken && chatId),

      updatedAt: doc.updatedAt,

    };



    if (botToken) {

      const verify = await this.verifyBotToken(botToken, this.apiBase());

      if (verify.ok && verify.username) {

        view.botUsername = verify.username;

      }

    }



    return view;

  }



  private resolveBotToken(doc: TelegramSettingsDocument): string {

    return doc.botToken?.trim() || this.envBotToken();

  }



  private envBotToken(): string {

    return (

      this.config.get<TelegramChannelConfig>('notifications.telegram')?.botToken?.trim() ??

      ''

    );

  }



  private apiBase(): string {

    return (

      this.config.get<TelegramChannelConfig>('notifications.telegram')?.apiBase ??

      'https://api.telegram.org'

    );

  }



  private async getOrCreate(): Promise<TelegramSettingsDocument> {

    let doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();

    if (!doc) {

      doc = await this.settingsModel.create({ key: SETTINGS_KEY });

    }

    return doc;

  }



  private async httpJson(

    url: string,

    init: { method: string; headers: Record<string, string>; body?: string },

  ): Promise<Record<string, unknown>> {

    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    try {

      const res = await fetch(url, { ...init, signal: controller.signal });

      const text = await res.text();

      if (!text) {

        if (!res.ok) {

          throw new Error(`Telegram HTTP ${res.status}`);

        }

        return {};

      }

      const parsed: unknown = JSON.parse(text);

      const json =

        parsed && typeof parsed === 'object'

          ? (parsed as Record<string, unknown>)

          : {};

      if (!res.ok && json.ok !== false) {

        throw new Error(`Telegram HTTP ${res.status}: ${text.slice(0, 500)}`);

      }

      return json;

    } finally {

      clearTimeout(timer);

    }

  }

}



function maskSecret(value: string): string {

  const trimmed = value.trim();

  if (!trimmed) return '';

  if (trimmed.length <= 8) return '••••••••';

  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;

}



function normalizeChatId(value: string): string {
  let next = value.trim().replace(/\s+/g, '');
  next = next.replace(/^["'`]+|["'`]+$/g, '');
  next = next.replace(/^(chat\.?id|id)[:\s=]+/i, '');
  return next;
}

function coerceChatIdForApi(chatId: string): string | number {
  const normalized = normalizeChatId(chatId);
  if (/^-?\d+$/.test(normalized)) {
    const asNumber = Number(normalized);
    if (Number.isSafeInteger(asNumber)) {
      return asNumber;
    }
  }
  return normalized;
}

function extractChatsFromUpdates(
  updates: Record<string, unknown>[],
): TelegramDiscoveredChat[] {
  const byId = new Map<string, TelegramDiscoveredChat>();

  for (const update of updates) {
    const message =
      (update.message as Record<string, unknown> | undefined) ??
      (update.edited_message as Record<string, unknown> | undefined) ??
      (update.channel_post as Record<string, unknown> | undefined);
    if (!message) continue;

    const chat =
      message.chat && typeof message.chat === 'object'
        ? (message.chat as Record<string, unknown>)
        : null;
    if (!chat) continue;

    const chatId = chat.id;
    if (typeof chatId !== 'number' && typeof chatId !== 'string') continue;

    const id = String(chatId);
    const type = asString(chat.type) ?? 'unknown';
    const username = asString(chat.username);
    const title =
      asString(chat.title)?.trim() ||
      [asString(chat.first_name), asString(chat.last_name)]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      username ||
      `Chat ${id}`;

    byId.set(id, {
      chatId: id,
      title,
      type,
      username: username ? `@${username}` : undefined,
    });
  }

  return [...byId.values()];
}



function formatTelegramError(message?: string): string {

  if (!message) return 'Telegram API error';

  if (/chat not found/i.test(message)) {
    return `${message} — use Find chat ID in admin settings (do not copy from.id). Open the bot in Telegram, press Start, send a message, then click Find chat ID.`;
  }

  if (/bot was blocked/i.test(message)) {

    return `${message} — open Telegram and unblock the bot, then send it a message.`;

  }

  if (/can't initiate conversation/i.test(message)) {

    return `${message} — send any message to your bot in Telegram first.`;

  }

  if (/unauthorized/i.test(message)) {

    return `${message} — the bot token is invalid or revoked.`;

  }

  return message;

}



function asString(value: unknown): string | undefined {

  return typeof value === 'string' ? value : undefined;

}


