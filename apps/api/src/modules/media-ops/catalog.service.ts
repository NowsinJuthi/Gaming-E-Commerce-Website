import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CatalogKind,
  CatalogTitle,
  CatalogTitleDocument,
} from '../../database/schemas/catalog-title.schema';
import { MediaLibrary, MediaLibraryDocument } from '../../database/schemas/media-library.schema';
import { LibraryIndexService } from './library-index.service';
import { TmdbMetadataService } from './tmdb-metadata.service';

export type CatalogBulkAction =
  | 'publish'
  | 'unpublish'
  | 'delete'
  | 'feature'
  | 'trending';

function catalogSortTimestamp(
  listedAt?: Date | string | null,
  updatedAt?: Date | string,
  createdAt?: Date | string,
): number {
  if (listedAt) {
    const listed = new Date(listedAt).getTime();
    if (Number.isFinite(listed)) return listed;
  }
  const updated = updatedAt ? new Date(updatedAt).getTime() : 0;
  const created = createdAt ? new Date(createdAt).getTime() : 0;
  return Math.max(updated, created) || 0;
}

function libraryIdFromSource(sourceKey?: string | null): string | null {
  const id = sourceKey?.split(':')[0]?.trim() ?? '';
  return Types.ObjectId.isValid(id) ? id : null;
}

const PUBLIC_CATALOG_FIELDS =
  'title year kind posterUrl featured trending seasonCount sourceKey listedAt createdAt updatedAt';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicCatalogFilter(options: {
  libraryId?: string;
  year?: number;
  q?: string;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    published: true,
    availability: 'available',
  };
  const libraryId = options.libraryId?.trim();
  if (libraryId && libraryId !== 'all' && Types.ObjectId.isValid(libraryId)) {
    filter.sourceKey = new RegExp(`^${escapeRegex(libraryId)}:`);
  }
  if (options.year && options.year > 0) {
    filter.year = options.year;
  }
  const words = options.q?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 0) {
    filter.$and = words.map((word) => ({
      title: new RegExp(escapeRegex(word), 'i'),
    }));
  }
  return filter;
}

function mapPublicCard(doc: {
  _id: Types.ObjectId | string;
  title: string;
  year: number;
  kind: CatalogKind;
  posterUrl?: string | null;
  featured?: boolean;
  trending?: boolean;
  seasonCount?: number | null;
  sourceKey?: string | null;
  listedAt?: Date | string | null;
  updatedAt?: Date | string;
  createdAt?: Date | string;
}) {
  return {
    id: String(doc._id),
    title: doc.title,
    year: doc.year,
    kind: doc.kind,
    posterUrl: doc.posterUrl ?? null,
    featured: doc.featured ?? false,
    trending: doc.trending ?? false,
    seasonCount: doc.seasonCount ?? null,
    libraryId: libraryIdFromSource(doc.sourceKey),
    listedAt: doc.listedAt ? new Date(doc.listedAt).getTime() : null,
    sortAt: catalogSortTimestamp(doc.listedAt, doc.updatedAt, doc.createdAt),
  };
}

function seriesFolderNameFromSource(sourceKey?: string | null): string | null {
  if (!sourceKey?.includes(':')) return null;
  const path = sourceKey.split(':').slice(1).join(':').replace(/\\/g, '/');
  const segment = path.split('/').filter(Boolean).pop()?.trim();
  return segment || null;
}

function resolveOriginalFileName(doc: {
  kind?: CatalogKind;
  videoFileName?: string | null;
  sourceKey?: string | null;
}): string | null {
  const stored = doc.videoFileName?.trim();
  if (stored) return stored;
  if (doc.kind === 'series') return seriesFolderNameFromSource(doc.sourceKey);
  return null;
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
    videoFileName: resolveOriginalFileName(doc),
    videoFileSizeBytes: doc.videoFileSizeBytes ?? null,
    seasonCount: doc.seasonCount ?? null,
  };
}

function serializeAdmin(doc: CatalogTitleDocument) {
  return {
    ...serialize(doc),
    kind: doc.kind,
    overview: doc.overview ?? '',
    runtimeMinutes: doc.runtimeMinutes ?? null,
    rating: doc.rating ?? null,
    genres: doc.genres ?? [],
    backdropUrl: doc.backdropUrl ?? null,
  };
}

@Injectable()
export class CatalogService {
  private readonly hydratingTitleIds = new Set<string>();

  constructor(
    @InjectModel(CatalogTitle.name)
    private readonly titles: Model<CatalogTitleDocument>,
    @InjectModel(MediaLibrary.name)
    private readonly libraries: Model<MediaLibraryDocument>,
    private readonly libraryIndex: LibraryIndexService,
    private readonly tmdb: TmdbMetadataService,
  ) {}

  async list(kind: CatalogKind, q?: string, page?: number) {
    const pageSize = 20;
    const filter: Record<string, unknown> = { kind };
    const term = q?.trim();
    if (term) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: regex }, { videoFileName: regex }, { sourceKey: regex }];
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

  private serializePublicTitle(doc: CatalogTitleDocument) {
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
      detailsLoaded: Boolean(doc.detailsLoaded),
    };
  }

  private async hydrateTitleDetails(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    const doc = await this.titles.findById(id).exec();
    if (!doc || doc.detailsLoaded) return;
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

  async publicTitle(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Title not found.');
    const doc = await this.titles.findById(id).exec();
    if (!doc || !doc.published || doc.availability !== 'available') {
      throw new NotFoundException('Title not found.');
    }
    if (!doc.detailsLoaded && !this.hydratingTitleIds.has(id)) {
      this.hydratingTitleIds.add(id);
      void this.hydrateTitleDetails(id).finally(() => {
        this.hydratingTitleIds.delete(id);
      });
    }
    return this.serializePublicTitle(doc);
  }

  async publicHome() {
    const libraries = await this.libraries.find({ enabled: true }).sort({ name: 1 }).select('name').exec();
    const years = await this.publicYears('all');
    return {
      hero: [],
      rows: [],
      items: [],
      recentUploads: [],
      libraries: libraries.map((library) => ({
        id: String(library._id),
        name: library.name,
      })),
      years,
    };
  }

  /** One round-trip for SSR: libraries, years, and first catalog page. */
  async publicBootstrap(limit = 12) {
    this.libraryIndex.maybePruneAllLibraries();
    const [libraries, years, browse] = await Promise.all([
      this.libraries.find({ enabled: true }).sort({ name: 1 }).select('name').lean().exec(),
      this.publicYears('all'),
      this.publicBrowse({ offset: 0, limit, libraryId: 'all' }),
    ]);
    return {
      libraries: libraries.map((library) => ({
        id: String(library._id),
        name: library.name,
      })),
      years,
      items: browse.items,
      total: browse.total,
      offset: browse.offset,
      limit: browse.limit,
      hasMore: browse.hasMore,
    };
  }

  async publicYears(libraryId?: string) {
    const filter = publicCatalogFilter({ libraryId: libraryId?.trim() || 'all' });
    const values = await this.titles.distinct('year', filter).exec();
    return values
      .filter((value): value is number => typeof value === 'number' && value > 0)
      .sort((a, b) => b - a);
  }

  async publicBrowse(options: {
    libraryId?: string;
    year?: number;
    q?: string;
    offset?: number;
    limit?: number;
  }) {
    const filter = publicCatalogFilter(options);
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const limit = Math.min(48, Math.max(1, Math.floor(options.limit ?? 24)));
    const rows = await this.titles
      .find(filter)
      .sort({ listedAt: -1, createdAt: -1, updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit + 1)
      .select(PUBLIC_CATALOG_FIELDS)
      .lean()
      .exec();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map((doc) => mapPublicCard(doc));
    const total = hasMore ? offset + limit + 1 : offset + items.length;
    return {
      items,
      total,
      offset,
      limit,
      hasMore,
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

  async adminOne(kind: CatalogKind, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Title not found.');
    const doc = await this.titles.findOne({ _id: id, kind }).exec();
    if (!doc) throw new NotFoundException('Title not found.');
    return serializeAdmin(doc);
  }

  async applyFromTmdb(kind: CatalogKind, id: string, tmdbId: number, updateArtwork = true) {
    if (!this.tmdb.enabled()) {
      throw new BadRequestException('TMDB_API_KEY is not configured on the server.');
    }
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Title not found.');
    const doc = await this.titles.findOne({ _id: id, kind }).exec();
    if (!doc) throw new NotFoundException('Title not found.');
    const meta =
      kind === 'series'
        ? await this.tmdb.detailsSeriesById(tmdbId, updateArtwork)
        : await this.tmdb.detailsMovieById(tmdbId, updateArtwork);
    if (!meta) {
      throw new NotFoundException(`No TMDB ${kind} found for id ${tmdbId}.`);
    }
    doc.title = meta.title.slice(0, 200);
    if (meta.year) doc.year = meta.year;
    doc.overview = meta.overview || null;
    doc.runtimeMinutes = meta.runtimeMinutes;
    doc.rating = meta.rating;
    doc.genres = meta.genres;
    doc.backdropUrl = meta.backdropUrl;
    doc.directors = meta.directors;
    doc.writers = meta.writers;
    doc.cast = meta.cast;
    doc.detailsLoaded = true;
    if (updateArtwork && meta.posterUrl) doc.posterUrl = meta.posterUrl;
    await doc.save();
    return serializeAdmin(doc);
  }

  async uploadPoster(kind: CatalogKind, id: string, buffer: Buffer) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Title not found.');
    const doc = await this.titles.findOne({ _id: id, kind }).exec();
    if (!doc) throw new NotFoundException('Title not found.');
    const posterUrl = await this.tmdb.savePosterBuffer(buffer);
    if (!posterUrl) throw new BadRequestException('Poster upload could not be processed.');
    doc.posterUrl = posterUrl;
    await doc.save();
    return serializeAdmin(doc);
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
      overview: string | null;
      runtimeMinutes: number | null;
      rating: number | null;
      genres: string[];
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
    if (patch.overview !== undefined) doc.overview = patch.overview?.trim() || null;
    if (patch.runtimeMinutes !== undefined) doc.runtimeMinutes = patch.runtimeMinutes;
    if (patch.rating !== undefined) doc.rating = patch.rating;
    if (patch.genres !== undefined) doc.genres = patch.genres;
    await doc.save();
    return serializeAdmin(doc);
  }
}
