import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BlogPageFeaturesDoc,
  BlogSettings,
  BlogSettingsDocument,
} from '../../database/schemas/blog-settings.schema';
import type { UpdateBlogSettingsDto } from './dto/update-blog-settings.dto';

const SETTINGS_KEY = 'global';

export type BlogPageFeatures = {
  reactionsEnabled: boolean;
  reviewsEnabled: boolean;
  viewsEnabled: boolean;
  authorProfileEnabled: boolean;
  shareButtonsEnabled: boolean;
  readingTimeEnabled: boolean;
  relatedPostsEnabled: boolean;
};

export const DEFAULT_BLOG_PAGE_FEATURES: BlogPageFeatures = {
  reactionsEnabled: true,
  reviewsEnabled: true,
  viewsEnabled: true,
  authorProfileEnabled: true,
  shareButtonsEnabled: true,
  readingTimeEnabled: true,
  relatedPostsEnabled: true,
};

@Injectable()
export class BlogSettingsService {
  constructor(
    @InjectModel(BlogSettings.name)
    private readonly model: Model<BlogSettingsDocument>,
  ) {}

  async getSettings(): Promise<BlogSettingsDocument> {
    return this.getOrCreate();
  }

  async getPageFeatures(): Promise<BlogPageFeatures> {
    const doc = await this.getOrCreate();
    return this.serializeFeatures(doc.features);
  }

  async updateSettings(
    dto: UpdateBlogSettingsDto,
  ): Promise<BlogSettingsDocument> {
    const doc = await this.getOrCreate();

    if (dto.features) {
      const next = doc.features ?? new BlogPageFeaturesDoc();
      const patch = dto.features;

      if (patch.reactionsEnabled !== undefined) {
        next.reactionsEnabled = patch.reactionsEnabled;
      }
      if (patch.reviewsEnabled !== undefined) {
        next.reviewsEnabled = patch.reviewsEnabled;
      }
      if (patch.viewsEnabled !== undefined) {
        next.viewsEnabled = patch.viewsEnabled;
      }
      if (patch.authorProfileEnabled !== undefined) {
        next.authorProfileEnabled = patch.authorProfileEnabled;
      }
      if (patch.shareButtonsEnabled !== undefined) {
        next.shareButtonsEnabled = patch.shareButtonsEnabled;
      }
      if (patch.readingTimeEnabled !== undefined) {
        next.readingTimeEnabled = patch.readingTimeEnabled;
      }
      if (patch.relatedPostsEnabled !== undefined) {
        next.relatedPostsEnabled = patch.relatedPostsEnabled;
      }

      doc.features = next;
      doc.markModified('features');
    }

    await doc.save();
    return doc;
  }

  serializePublic(doc: BlogSettingsDocument) {
    return {
      features: this.serializeFeatures(doc.features),
      updatedAt: doc.updatedAt,
    };
  }

  private serializeFeatures(
    features?: BlogPageFeaturesDoc | null,
  ): BlogPageFeatures {
    return {
      reactionsEnabled: features?.reactionsEnabled !== false,
      reviewsEnabled: features?.reviewsEnabled !== false,
      viewsEnabled: features?.viewsEnabled !== false,
      authorProfileEnabled: features?.authorProfileEnabled !== false,
      shareButtonsEnabled: features?.shareButtonsEnabled !== false,
      readingTimeEnabled: features?.readingTimeEnabled !== false,
      relatedPostsEnabled: features?.relatedPostsEnabled !== false,
    };
  }

  private async getOrCreate(): Promise<BlogSettingsDocument> {
    let doc = await this.model.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.model.create({ key: SETTINGS_KEY });
    }
    return doc;
  }
}
