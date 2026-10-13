import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CatalogKind,
  CatalogTitle,
  CatalogTitleDocument,
} from '../../database/schemas/catalog-title.schema';

export type CatalogBulkAction =
  | 'publish'
  | 'unpublish'
  | 'delete'
  | 'feature'
  | 'trending';

function serialize(doc: CatalogTitleDocument) {
  return {
    id: String(doc._id),
    title: doc.title,
    releaseYear: doc.year,
    firstAirYear: doc.year,
    published: doc.published,
    availability: doc.availability,
    featured: doc.featured,
    trending: doc.trending,
    posterUrl: doc.posterUrl ?? null,
    videoFileName: doc.videoFileName ?? null,
    videoFileSizeBytes: doc.videoFileSizeBytes ?? null,
    seasonCount: doc.seasonCount ?? null,
  };
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(CatalogTitle.name)
    private readonly titles: Model<CatalogTitleDocument>,
  ) {}

  async list(kind: CatalogKind, q?: string) {
    const filter: Record<string, unknown> = { kind };
    const term = q?.trim();
    if (term) {
      filter.title = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    const rows = await this.titles.find(filter).sort({ updatedAt: -1 }).limit(50).lean().exec();
    return { items: rows.map((doc) => serialize(doc as CatalogTitleDocument)), total: rows.length };
  }

  async publicHome() {
    const rows = await this.titles
      .find({ published: true, availability: 'available' })
      .sort({ featured: -1, trending: -1, updatedAt: -1 })
      .limit(80)
      .exec();
    const items = rows.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      year: doc.year,
      kind: doc.kind,
      posterUrl: doc.posterUrl ?? null,
      featured: doc.featured,
      trending: doc.trending,
      seasonCount: doc.seasonCount ?? null,
    }));
    const featured = items.filter((item) => item.featured);
    const movies = items.filter((item) => item.kind === 'movie');
    const series = items.filter((item) => item.kind === 'series');
    const trending = items.filter((item) => item.trending);
    const shelves = [
      { id: 'featured', title: 'Featured', items: featured },
      { id: 'movies', title: 'Movies', items: movies },
      { id: 'series', title: 'Series', items: series },
      { id: 'trending', title: 'Trending', items: trending },
    ].filter((row) => row.items.length > 0);
    return {
      hero: (featured.length > 0 ? featured : items).slice(0, 6),
      rows: shelves,
    };
  }

  async bulk(kind: CatalogKind, ids: string[], action: CatalogBulkAction) {
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id));
    if (!objectIds.length) {
      throw new BadRequestException('Select at least one title.');
    }
    const filter = { _id: { $in: objectIds }, kind };
    if (action === 'delete') {
      const result = await this.titles.deleteMany(filter).exec();
      return { updated: result.deletedCount };
    }
    const patch =
      action === 'publish'
        ? { published: true }
        : action === 'unpublish'
          ? { published: false }
          : action === 'feature'
            ? { featured: true }
            : { trending: true };
    const result = await this.titles.updateMany(filter, { $set: patch }).exec();
    return { updated: result.modifiedCount };
  }

  async update(
    kind: CatalogKind,
    id: string,
    patch: Partial<{
      title: string;
      year: number;
      published: boolean;
      availability: 'available' | 'unavailable';
      featured: boolean;
      trending: boolean;
      posterUrl: string | null;
      videoFileName: string | null;
      seasonCount: number | null;
    }>,
  ) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Title not found.');
    const doc = await this.titles.findOne({ _id: id, kind }).exec();
    if (!doc) throw new NotFoundException('Title not found.');
    if (patch.title !== undefined) doc.title = patch.title.trim();
    if (patch.year !== undefined) doc.year = patch.year;
    if (patch.published !== undefined) doc.published = patch.published;
    if (patch.availability !== undefined) doc.availability = patch.availability;
    if (patch.featured !== undefined) doc.featured = patch.featured;
    if (patch.trending !== undefined) doc.trending = patch.trending;
    if (patch.posterUrl !== undefined) doc.posterUrl = patch.posterUrl;
    if (patch.videoFileName !== undefined) doc.videoFileName = patch.videoFileName;
    if (patch.seasonCount !== undefined) doc.seasonCount = patch.seasonCount;
    await doc.save();
    return serialize(doc);
  }
}
