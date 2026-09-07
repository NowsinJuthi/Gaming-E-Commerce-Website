import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationChannel } from '../../common/enums';
import {
  NotificationPreference,
  NotificationPreferenceDocument,
} from '../../database/schemas/notification-preference.schema';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class NotificationPreferenceService {
  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly prefModel: Model<NotificationPreferenceDocument>,
  ) {}

  async getOrCreate(
    userId: string | Types.ObjectId,
  ): Promise<NotificationPreferenceDocument> {
    const ownerId = new Types.ObjectId(userId);
    const pref = await this.prefModel
      .findOneAndUpdate(
        { userId: ownerId },
        { $setOnInsert: { userId: ownerId } },
        { new: true, upsert: true },
      )
      .exec();
    if (!pref) {
      throw new Error('Notification preferences could not be created');
    }
    return pref;
  }

  async update(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<NotificationPreferenceDocument> {
    await this.getOrCreate(userId);
    const set: Record<string, unknown> = {};
    if (dto.channels) {
      for (const [key, value] of Object.entries(dto.channels)) {
        if (value !== undefined) {
          set[`channels.${key}`] = value;
        }
      }
    }
    if (dto.mutedEvents) {
      set.mutedEvents = dto.mutedEvents;
    }
    const pref = await this.prefModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: set },
        { new: true },
      )
      .exec();
    if (!pref) {
      throw new Error('Notification preferences not found');
    }
    return pref;
  }

  async setTelegramChatId(
    userId: string,
    chatId: string,
  ): Promise<NotificationPreferenceDocument> {
    await this.getOrCreate(userId);
    const trimmed = chatId.trim();
    // Empty string = remove the chat ID and disable the Telegram channel.
    // Non-empty = save it and automatically enable the Telegram channel so
    // notifications start flowing without a separate toggle step.
    const update = trimmed
      ? { $set: { telegramChatId: trimmed, 'channels.telegram': true } }
      : { $set: { 'channels.telegram': false }, $unset: { telegramChatId: '' } };
    const pref = await this.prefModel
      .findOneAndUpdate({ userId: new Types.ObjectId(userId) }, update, {
        new: true,
      })
      .exec();
    return pref as NotificationPreferenceDocument;
  }

  async addPushToken(
    userId: string,
    token: string,
  ): Promise<NotificationPreferenceDocument> {
    await this.getOrCreate(userId);
    const pref = await this.prefModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $addToSet: { pushTokens: token } },
        { new: true },
      )
      .exec();
    return pref as NotificationPreferenceDocument;
  }

  async removePushToken(
    userId: string,
    token: string,
  ): Promise<NotificationPreferenceDocument> {
    await this.getOrCreate(userId);
    const pref = await this.prefModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $pull: { pushTokens: token } },
        { new: true },
      )
      .exec();
    return pref as NotificationPreferenceDocument;
  }

  isChannelEnabled(
    pref: NotificationPreferenceDocument,
    channel: NotificationChannel,
  ): boolean {
    switch (channel) {
      case NotificationChannel.InApp:
        return pref.channels.inApp;
      case NotificationChannel.Email:
        return pref.channels.email;
      case NotificationChannel.Push:
        return pref.channels.push;
      case NotificationChannel.Telegram:
        return pref.channels.telegram;
      default:
        return false;
    }
  }
}
