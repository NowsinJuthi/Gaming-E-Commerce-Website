import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CatalogKind,
  CatalogTitle,
  CatalogTitleDocument,
} from '../../database/schemas/catalog-title.schema';
import { MediaLibrary, MediaLibraryDocument } from '../../database/schemas/media-library.schema';
import { TmdbMetadataService } from './tmdb-metadata.service';

export type CatalogBulkAction =
  | 'publish'
  | 'unpublish'
  | 'delete'
  | 'feature'
  | 'trending';

function libraryIdFromSource(sourceKey?: string | null): string | null {
  const id = sourceKey?.split(':')[0]?.trim() ?? '';
  return Types.ObjectId.isValid(id) ? id : null;
}

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
    @InjectModel(MediaLibrary.name)
    private readonly libraries: Model<MediaLibraryDocument>,
    private readonly tmdb: TmdbMetadataService,
  ) {}

  async list(kind: CatalogKind, q?: string, page?: number) {
    const pageSize = 20;
    const filter: Record<string, unknown> = { kind };
    const term = q?.trim();
    if (term) {
      filter.title = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    const total = await this.titles.countDocuments(filter).exec();
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(1, Math.floor(page || 1)), pageCount);
    const rows = await this.titles
      .find(filter)
      .sort({ title: 1 })
      .skip((current - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec();
    return {
      items: rows.map((doc) => serialize(doc as CatalogTitleDocument)),
      total,
      page: current,
      pageSize,
      pageCount,
    };
  }

  async publicTitle(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Title not found.');
    const doc = await this.titles.findById(id).exec();
    if (!doc || !doc.published || doc.availability !== 'available') {
      throw new NotFoundException('Title not found.');
    }
    if (!doc.detailsLoaded) {
      const details =
        doc.kind === 'series'
          ? await this.tmdb.detailsSeries(doc.title, doc.year)
          : await this.tmdb.detailsMovie(doc.title, doc.year);
      doc.detailsLoaded = true;
      if (details) {
        if (details.title) doc.title = details.title.slice(0, 200);
        if (details.year) doc.year = details.year;
        doc.overview = details.overview || null;
        doc.runtimeMinutes = details.runtimeMinutes;
        doc.rating = details.rating;
        doc.genres = details.genres;
        doc.backdropUrl = details.backdropUrl;
        doc.directors = details.directors;
        doc.writers = details.writers;
        doc.cast = details.cast;
      }
      await doc.save();
    }
    return {
      id: String(doc._id),
      title: doc.title,
      year: doc.year,
      kind: doc.kind,
      posterUrl: doc.posterUrl ?? null,
      backdropUrl: doc.backdropUrl ?? null,
      overview: doc.overview ?? '',
      runtimeMinutes: doc.runtimeMinutes ?? null,
      rating: doc.rating ?? null,
      genres: doc.genres ?? [],
      directors: doc.directors ?? [],
      writers: doc.writers ?? [],
      cast: (doc.cast ?? []).map((person) => ({
        name: person.name,
        profileUrl: person.profileUrl ?? null,
      })),
      seasonCount: doc.seasonCount ?? null,
    };
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
    const libraries = await this.libraries.find({ enabled: true }).sort({ name: 1 }).select('name').exec();
    const catalog = await this.titles
      .find({ published: true, availability: 'available' })
      .sort({ title: 1 })
      .limit(500)
      .exec();
    return {
      hero: (featured.length > 0 ? featured : items).slice(0, 6),
      rows: shelves,
      libraries: libraries.map((library) => ({
        id: String(library._id),
        name: library.name,
      })),
      items: catalog.map((doc) => ({
        id: String(doc._id),
        title: doc.title,
        year: doc.year,
        kind: doc.kind,
        posterUrl: doc.posterUrl ?? null,
        featured: doc.featured,
        trending: doc.trending,
        seasonCount: doc.seasonCount ?? null,
        libraryId: libraryIdFromSource(doc.sourceKey),
      })),
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
