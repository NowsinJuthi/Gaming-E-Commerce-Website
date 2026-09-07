import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CustomOrderFieldDoc,
  DeliverySettings,
  DeliverySettingsDocument,
  SavedDeliveryNoteDoc,
} from '../../database/schemas/delivery-settings.schema';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';

const SETTINGS_KEY = 'global';

export interface CustomOrderFieldConfig {
  label: string;
  enabled: boolean;
  messages: string[];
  regions: string[];
}

export interface SavedDeliveryNoteConfig {
  label: string;
  enabled: boolean;
  note: string;
}

export interface DeliverySettingsResponse {
  customOrderFields: CustomOrderFieldConfig[];
  savedDeliveryNotes: SavedDeliveryNoteConfig[];
  updatedAt?: Date;
}

@Injectable()
export class DeliverySettingsService {
  constructor(
    @InjectModel(DeliverySettings.name)
    private readonly settingsModel: Model<DeliverySettingsDocument>,
  ) {}

  async getSettings(): Promise<DeliverySettingsResponse> {
    const doc = await this.getOrCreate();
    return this.toResponse(doc);
  }

  async updateSettings(
    dto: UpdateDeliverySettingsDto,
  ): Promise<DeliverySettingsResponse> {
    const update: Record<string, unknown> = {};

    if (dto.customOrderFields !== undefined) {
      update.customOrderFields = this.normalizeFields(dto.customOrderFields);
    }

    if (dto.savedDeliveryNotes !== undefined) {
      update.savedDeliveryNotes = this.normalizeNotes(dto.savedDeliveryNotes);
    }

    if (Object.keys(update).length === 0) {
      return this.getSettings();
    }

    const doc = await this.settingsModel
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!doc) {
      throw new Error('Could not update delivery settings');
    }

    return this.toResponse(doc);
  }

  async listDeliveryMessageOptions(): Promise<
    Array<{ templateLabel: string; message: string }>
  > {
    const { customOrderFields } = await this.getSettings();
    const options: Array<{ templateLabel: string; message: string }> = [];

    for (const field of customOrderFields) {
      if (!field.enabled || !field.label.trim()) continue;
      for (const message of field.messages) {
        const trimmed = message.trim();
        if (trimmed) {
          options.push({ templateLabel: field.label, message: trimmed });
        }
      }
    }

    return options;
  }

  private async getOrCreate(): Promise<DeliverySettingsDocument> {
    let doc = await this.settingsModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.settingsModel.create({ key: SETTINGS_KEY });
    }
    return doc;
  }

  private normalizeFields(
    fields: UpdateDeliverySettingsDto['customOrderFields'],
  ): CustomOrderFieldDoc[] {
    if (!fields?.length) {
      return [];
    }

    return fields
      .map((field) => ({
        label: field.label.trim(),
        enabled: field.enabled !== false,
        messages: (field.messages ?? [])
          .map((m) => m.trim())
          .filter((m) => m.length > 0),
        regions: this.normalizeRegions(field.regions),
      }))
      .filter((field) => field.label.length > 0);
  }

  private normalizeRegions(raw?: string[]): string[] {
    if (!raw?.length) return [];
    const seen = new Set<string>();
    const regions: string[] = [];
    for (const item of raw) {
      const code = item.trim().toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      regions.push(code);
    }
    return regions;
  }

  private normalizeNotes(
    notes: UpdateDeliverySettingsDto['savedDeliveryNotes'],
  ): SavedDeliveryNoteDoc[] {
    if (!notes?.length) {
      return [];
    }

    return notes
      .map((item) => ({
        label: item.label.trim(),
        enabled: item.enabled !== false,
        note: (item.note ?? '').trim(),
      }))
      .filter((item) => item.label.length > 0 && item.note.length > 0);
  }

  private toResponse(doc: DeliverySettingsDocument): DeliverySettingsResponse {
    return {
      customOrderFields: (doc.customOrderFields ?? []).map((field) => ({
        label: field.label,
        enabled: field.enabled !== false,
        messages: field.messages ?? [],
        regions: this.normalizeRegions(field.regions),
      })),
      savedDeliveryNotes: (doc.savedDeliveryNotes ?? []).map((item) => ({
        label: item.label,
        enabled: item.enabled !== false,
        note: item.note ?? '',
      })),
      updatedAt: doc.updatedAt,
    };
  }
}
