import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { deepReplaceLegacyBrand } from '../../common/utils/legacy-brand-migration';
import {
  ChatQuickReplyDoc,
  ChatSettings,
  ChatSettingsDocument,
} from '../../database/schemas/chat-settings.schema';
import { UpdateChatQuickRepliesDto } from './dto/update-chat-quick-replies.dto';
import { UpdateChatWelcomeAutoReplyDto } from './dto/update-chat-welcome-auto-reply.dto';

const SETTINGS_KEY = 'global';
const MAX_QUICK_REPLIES = 50;
const DEFAULT_WELCOME_AUTO_REPLY =
  'Welcome to UniQbd Support! Thanks for reaching out. Our support team will reply as soon as possible.';

export interface ChatQuickReplyConfig {
  id: string;
  label: string;
  category: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
}

export interface ChatQuickRepliesResponse {
  quickReplies: ChatQuickReplyConfig[];
  updatedAt?: Date;
}

export interface ChatWelcomeAutoReplyResponse {
  enabled: boolean;
  message: string;
  updatedAt?: Date;
}

@Injectable()
export class ChatSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ChatSettingsService.name);

  constructor(
    @InjectModel(ChatSettings.name)
    private readonly settingsModel: Model<ChatSettingsDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
      if (!doc?.quickReplies?.length) return;

      const result = deepReplaceLegacyBrand(doc.quickReplies);
      if (!result.changed) return;

      doc.quickReplies = result.value as ChatQuickReplyDoc[];
      doc.markModified('quickReplies');
      await doc.save();
      this.logger.log('Migrated legacy brand text to UniQbd in chat quick replies');
    } catch (err) {
      this.logger.warn('Could not run legacy brand migration in chat settings', err);
    }
  }

  async getQuickReplies(): Promise<ChatQuickRepliesResponse> {
    const doc = await this.getOrCreate();
    return this.toQuickRepliesResponse(doc);
  }

  async getStaffQuickReplies(): Promise<{
    quickReplies: ChatQuickReplyConfig[];
  }> {
    const doc = await this.getOrCreate();
    const quickReplies = (doc.quickReplies ?? [])
      .filter((item) => item.enabled !== false)
      .map((item) => ({
        id: item.id,
        label: item.label,
        category: item.category ?? '',
        body: item.body ?? '',
        enabled: true,
        sortOrder: item.sortOrder ?? 0,
      }))
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
      );
    return { quickReplies };
  }

  async updateQuickReplies(
    dto: UpdateChatQuickRepliesDto,
  ): Promise<ChatQuickRepliesResponse> {
    const quickReplies = this.normalizeQuickReplies(dto.quickReplies);

    const doc = await this.settingsModel
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set: { quickReplies } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!doc) {
      throw new BadRequestException('Could not update chat quick replies');
    }

    return this.toQuickRepliesResponse(doc);
  }

  async getWelcomeAutoReply(): Promise<ChatWelcomeAutoReplyResponse> {
    const doc = await this.getOrCreate();
    return this.toWelcomeAutoReplyResponse(doc);
  }

  async updateWelcomeAutoReply(
    dto: UpdateChatWelcomeAutoReplyDto,
  ): Promise<ChatWelcomeAutoReplyResponse> {
    const message = dto.message.trim();
    if (!message) {
      throw new BadRequestException('Welcome auto-reply message is required');
    }

    const doc = await this.settingsModel
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        {
          $set: {
            welcomeAutoReplyEnabled: dto.enabled,
            welcomeAutoReplyMessage: message,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!doc) {
      throw new BadRequestException('Could not update welcome auto-reply');
    }

    return this.toWelcomeAutoReplyResponse(doc);
  }

  private async getOrCreate(): Promise<ChatSettingsDocument> {
    let doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.settingsModel.create({ key: SETTINGS_KEY });
    }
    return doc;
  }

  private normalizeQuickReplies(
    items: UpdateChatQuickRepliesDto['quickReplies'],
  ): ChatQuickReplyDoc[] {
    if (!items?.length) {
      return [];
    }

    if (items.length > MAX_QUICK_REPLIES) {
      throw new BadRequestException(
        `Maximum ${MAX_QUICK_REPLIES} quick replies allowed`,
      );
    }

    const seenIds = new Set<string>();
    const normalized: ChatQuickReplyDoc[] = [];

    for (const [index, item] of items.entries()) {
      const label = item.label.trim();
      const body = item.body.trim();
      if (!label || !body) continue;

      let id = (item.id ?? '').trim();
      if (!id) {
        id = randomUUID();
      }
      if (seenIds.has(id)) {
        throw new BadRequestException(`Duplicate quick reply id: ${id}`);
      }
      seenIds.add(id);

      normalized.push({
        id,
        label,
        category: (item.category ?? '').trim(),
        body,
        enabled: item.enabled !== false,
        sortOrder:
          typeof item.sortOrder === 'number' && item.sortOrder >= 0
            ? item.sortOrder
            : index,
      });
    }

    return normalized;
  }

  private toQuickRepliesResponse(
    doc: ChatSettingsDocument,
  ): ChatQuickRepliesResponse {
    const quickReplies = (doc.quickReplies ?? [])
      .map((item) => ({
        id: item.id,
        label: item.label,
        category: item.category ?? '',
        body: item.body ?? '',
        enabled: item.enabled !== false,
        sortOrder: item.sortOrder ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

    return {
      quickReplies,
      updatedAt: doc.updatedAt,
    };
  }

  private toWelcomeAutoReplyResponse(
    doc: ChatSettingsDocument,
  ): ChatWelcomeAutoReplyResponse {
    return {
      enabled: doc.welcomeAutoReplyEnabled === true,
      message:
        doc.welcomeAutoReplyMessage?.trim() || DEFAULT_WELCOME_AUTO_REPLY,
      updatedAt: doc.updatedAt,
    };
  }
}
