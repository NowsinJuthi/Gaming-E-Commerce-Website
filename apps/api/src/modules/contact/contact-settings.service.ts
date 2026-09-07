import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ContactSettings,
  ContactSettingsDocument,
} from '../../database/schemas/contact-settings.schema';
import type { UpdateContactSettingsDto } from './dto/update-contact-settings.dto';

const SETTINGS_KEY = 'global';

@Injectable()
export class ContactSettingsService {
  constructor(
    @InjectModel(ContactSettings.name)
    private readonly model: Model<ContactSettingsDocument>,
  ) {}

  async getSettings(): Promise<ContactSettingsDocument> {
    return this.getOrCreate();
  }

  async updateSettings(
    dto: UpdateContactSettingsDto,
  ): Promise<ContactSettingsDocument> {
    const doc = await this.getOrCreate();

    if (dto.heading !== undefined) doc.heading = dto.heading.trim();
    if (dto.subheading !== undefined) doc.subheading = dto.subheading.trim();
    if (dto.extraText !== undefined) doc.extraText = dto.extraText.trim();

    if (dto.address !== undefined) {
      if (dto.address.label !== undefined)
        doc.address.label = dto.address.label.trim();
      if (dto.address.lines !== undefined)
        doc.address.lines = dto.address.lines.map((l) => l.trim()).filter(Boolean);
    }

    if (dto.support !== undefined) {
      if (dto.support.label !== undefined)
        doc.support.label = dto.support.label.trim();
      if (dto.support.phones !== undefined)
        doc.support.phones = dto.support.phones.map((p) => p.trim()).filter(Boolean);
    }

    if (dto.email !== undefined) {
      if (dto.email.label !== undefined)
        doc.email.label = dto.email.label.trim();
      if (dto.email.emails !== undefined)
        doc.email.emails = dto.email.emails.map((e) => e.trim()).filter(Boolean);
    }

    if (dto.whatsappCard !== undefined) {
      if (dto.whatsappCard.title !== undefined)
        doc.whatsappCard.title = dto.whatsappCard.title.trim();
      if (dto.whatsappCard.description !== undefined)
        doc.whatsappCard.description = dto.whatsappCard.description.trim();
    }

    if (dto.social !== undefined) {
      if (dto.social.label !== undefined)
        doc.social.label = dto.social.label.trim();
      if (dto.social.facebookUrl !== undefined)
        doc.social.facebookUrl = dto.social.facebookUrl.trim();
      if (dto.social.youtubeUrl !== undefined)
        doc.social.youtubeUrl = dto.social.youtubeUrl.trim();
      if (dto.social.whatsappUrl !== undefined)
        doc.social.whatsappUrl = dto.social.whatsappUrl.trim();
      if (dto.social.links !== undefined)
        doc.social.links = dto.social.links
          .map((l) => ({ text: l.text?.trim() ?? '', url: l.url?.trim() ?? '' }))
          .filter((l) => l.text || l.url);
    }

    await doc.save();
    return doc;
  }

  private async getOrCreate(): Promise<ContactSettingsDocument> {
    let doc = await this.model.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.model.create({ key: SETTINGS_KEY });
    }
    return doc;
  }
}
