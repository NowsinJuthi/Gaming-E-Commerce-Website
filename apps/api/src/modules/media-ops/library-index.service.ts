import { readdir, stat } from 'fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CatalogKind, CatalogTitle, CatalogTitleDocument } from '../../database/schemas/catalog-title.schema';
import { MediaLibrary, MediaLibraryDocument } from '../../database/schemas/media-library.schema';
import { SmbServer, SmbServerDocument } from '../../database/schemas/smb-server.schema';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { SmbClientService, type SmbListedEntry } from './smb-client.service';
import { TmdbMetadataService } from './tmdb-metadata.service';

const VIDEO_EXT = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts', '.m2ts', '.webm', '.mpg', '.mpeg']);
const FRESH_MS = 10 * 60 * 1000;
const PRUNE_DEBOUNCE_MS = 3 * 60 * 1000;
const MAX_TITLES = 1000;
const ENRICH_LIMIT = 16;

@Injectable()
export class LibraryIndexService {
  private readonly logger = new Logger(LibraryIndexService.name);
  private lastBackgroundPruneAt = 0;
  private backgroundPruneRunning = false;

  constructor(
    @InjectModel(MediaLibrary.name)
    private readonly libraries: Model<MediaLibraryDocument>,
    @InjectModel(SmbServer.name)
    private readonly servers: Model<SmbServerDocument>,
    @InjectModel(CatalogTitle.name)
    private readonly titles: Model<CatalogTitleDocument>,
    private readonly crypto: CryptoService,
    private readonly smb: SmbClientService,
    private readonly tmdb: TmdbMetadataService,
  ) {}

  async sync(kind: CatalogKind): Promise<void> {
    const libKind = kind === 'series' ? 'tv' : 'movies';
    const rows = await this.libraries.find({ kind: libKind, enabled: true }).exec();
    const deadline = Date.now() + 22_000;
    for (const library of rows) {
      if (Date.now() > deadline) break;
      if (library.lastIndexedAt && Date.now() - library.lastIndexedAt.getTime() < FRESH_MS) {
        try {
          await this.pruneLibraryFromDisk(library, kind);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Library prune failed.';
          this.logger.warn(`Could not prune ${library.name}: ${message}`);
        }
        continue;
      }
      try {
        await this.indexLibrary(library, kind, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Library index failed.';
        this.logger.warn(`Could not index ${library.name}: ${message}`);
      }
    }
  }

  async syncLibrary(id: string): Promise<{
    indexed: number;
    matched: number;
    unmatched: number;
    removed: number;
    logs: string[];
  }> {
    const empty = { indexed: 0, matched: 0, unmatched: 0, removed: 0, logs: ['Library not found.'] };
    if (!Types.ObjectId.isValid(id)) return empty;
    const library = await this.libraries.findById(id).exec();
    if (!library) return empty;
    const kind: CatalogKind = library.kind === 'tv' ? 'series' : 'movie';
    const result = await this.indexLibrary(library, kind, true);
    return result;
  }

  /** Index only paths just uploaded to Samba (no full library folder scan). */
  async syncUploadedPaths(
    id: string,
    uploaded: { remote: string; sizeBytes: number }[],
  ): Promise<{
    indexed: number;
    matched: number;
    unmatched: number;
    removed: number;
    logs: string[];
  }> {
    const empty = { indexed: 0, matched: 0, unmatched: 0, removed: 0, logs: ['Library not found.'] };
    if (!Types.ObjectId.isValid(id) || uploaded.length === 0) {
      if (!Types.ObjectId.isValid(id)) return empty;
      return { ...empty, logs: ['No uploaded paths to index.'] };
    }
    const library = await this.libraries.findById(id).exec();
    if (!library) return empty;

    const kind: CatalogKind = library.kind === 'tv' ? 'series' : 'movie';
    const libRoot = (library.smbRemotePath ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    let indexed = 0;
    let matched = 0;
    let recentMarks = 0;

    if (kind === 'movie') {
      for (const item of uploaded) {
        const rel = this.pathRelativeToLibrary(libRoot, item.remote);
        const name = rel.split('/').filter(Boolean).pop() ?? rel;
        if (!name || !this.isVideo(name)) continue;
        recentMarks += await this.markRecentlyUploaded(library, kind, rel, name);
        const entry: SmbListedEntry = {
          name,
          path: rel,
          isDirectory: false,
          sizeBytes: item.sizeBytes > 0 ? item.sizeBytes : null,
        };
        try {
          if (await this.upsertFromFile(library, kind, entry, () => true, true)) matched += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Catalog upsert failed.';
          this.logger.warn(`Upload index ${name}: ${message}`);
        }
        indexed += 1;
      }
    } else {
      const folderPaths = new Set<string>();
      for (const item of uploaded) {
        const rel = this.pathRelativeToLibrary(libRoot, item.remote);
        const parts = rel.split('/').filter(Boolean);
        if (parts.length >= 2) {
          folderPaths.add(parts.slice(0, -1).join('/'));
          continue;
        }
        const name = parts[0] ?? rel;
        if (!name || !this.isVideo(name)) continue;
        const entry: SmbListedEntry = {
          name,
          path: rel,
          isDirectory: false,
          sizeBytes: item.sizeBytes > 0 ? item.sizeBytes : null,
        };
        recentMarks += await this.markRecentlyUploaded(library, kind, rel, name);
        try {
          if (await this.upsertFromFile(library, kind, entry, () => true, true)) matched += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Catalog upsert failed.';
          this.logger.warn(`Upload index ${name}: ${message}`);
        }
        indexed += 1;
      }
      for (const folderPath of folderPaths) {
        const name = folderPath.split('/').filter(Boolean).pop() ?? folderPath;
        recentMarks += await this.markRecentlyUploaded(library, kind, folderPath, name);
        const entry: SmbListedEntry = {
          name,
          path: folderPath,
          isDirectory: true,
          sizeBytes: null,
        };
        try {
          if (await this.upsertFromFolder(library, kind, entry, () => true, true)) matched += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Catalog upsert failed.';
          this.logger.warn(`Upload index ${name}: ${message}`);
        }
        indexed += 1;
      }
    }

    await this.refreshLibraryCounts(library);
    const unmatched = Math.max(0, indexed - matched);
    const logs = [
      `${library.name}: indexed ${indexed} uploaded item${indexed === 1 ? '' : 's'}, ${matched} matched on TMDB.`,
      `Recently added: ${recentMarks} catalog row${recentMarks === 1 ? '' : 's'} stamped.`,
    ];
    if (!this.tmdb.enabled()) {
      logs.push('TMDB_API_KEY is missing, so posters cannot be matched.');
    }
    return { indexed, matched, unmatched, removed: 0, logs };
  }

  /** Drop catalog rows whose files were removed from storage (debounced, for /media home). */
  maybePruneAllLibraries(): void {
    const now = Date.now();
    if (this.backgroundPruneRunning || now - this.lastBackgroundPruneAt < PRUNE_DEBOUNCE_MS) {
      return;
    }
    this.backgroundPruneRunning = true;
    this.lastBackgroundPruneAt = now;
    void this.pruneAllEnabledLibraries()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Background media prune failed.';
        this.logger.warn(message);
      })
      .finally(() => {
        this.backgroundPruneRunning = false;
      });
  }

  async pruneAllEnabledLibraries(): Promise<number> {
    const rows = await this.libraries.find({ enabled: true }).exec();
    const deadline = Date.now() + 28_000;
    let removed = 0;
    for (const library of rows) {
      if (Date.now() > deadline) break;
      const kind: CatalogKind = library.kind === 'tv' ? 'series' : 'movie';
      removed += await this.pruneLibraryFromDisk(library, kind);
    }
    return removed;
  }

  async libraryItems(id: string) {
    if (!Types.ObjectId.isValid(id)) return { items: [] };
    const rows = await this.titles
      .find({ sourceKey: new RegExp(`^${id}:`) })
      .sort({ title: 1 })
      .limit(MAX_TITLES)
      .exec();
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        fileName: row.videoFileName || row.title,
        status: row.posterUrl ? 'matched' : 'unmatched',
        match: row.title,
        resolution: '—',
        codec: '—',
      })),
    };
  }

  private async indexLibrary(
    library: MediaLibraryDocument,
    kind: CatalogKind,
    force: boolean,
  ): Promise<{ indexed: number; matched: number; unmatched: number; removed: number; logs: string[] }> {
    if (!force && library.lastIndexedAt && Date.now() - library.lastIndexedAt.getTime() < FRESH_MS) {
      const removed = await this.pruneLibraryFromDisk(library, kind);
      const logs = [`${library.name} was scanned recently.`];
      if (removed > 0) {
        logs.push(`Removed ${removed} title${removed === 1 ? '' : 's'} that are no longer on disk.`);
      }
      return {
        indexed: library.itemCount,
        matched: Math.max(0, library.itemCount - library.unmatchedCount),
        unmatched: library.unmatchedCount,
        removed,
        logs,
      };
    }
    const logs: string[] = [];
    const lookupDeadline = Date.now() + (force ? 45_000 : 12_000);
    if (!this.tmdb.enabled()) {
      logs.push('TMDB_API_KEY is missing, so posters cannot be matched.');
    }
    const entries = await this.list(library, library.smbRemotePath ?? '');
    const videos = entries.filter((entry) => !entry.isDirectory && this.isVideo(entry.name));
    const folders = entries.filter((entry) => entry.isDirectory);
    const onDiskKeys = await this.buildOnDiskKeys(library, kind, videos, folders);
    let indexed = 0;
    let matched = 0;
    let lookups = 0;

    const remember = (didMatch: boolean) => {
      indexed += 1;
      if (didMatch) matched += 1;
    };

    if (kind === 'movie' && videos.length > 0 && videos.length >= folders.length) {
      for (const file of videos.slice(0, MAX_TITLES)) {
        remember(await this.upsertFromFile(library, kind, file, () => this.allowLookup(force, lookups++, lookupDeadline)));
      }
    } else {
      const source = kind === 'series' ? folders : folders.length > 0 ? folders : videos;
      for (const entry of source.slice(0, MAX_TITLES)) {
        if (entry.isDirectory) {
          remember(await this.upsertFromFolder(library, kind, entry, () => this.allowLookup(force, lookups++, lookupDeadline)));
        } else {
          remember(await this.upsertFromFile(library, kind, entry, () => this.allowLookup(force, lookups++, lookupDeadline)));
        }
      }
      if (kind === 'movie') {
        for (const folder of folders.slice(0, ENRICH_LIMIT)) {
          const inner = await this.list(library, folder.path).catch(() => [] as SmbListedEntry[]);
          const file = inner
            .filter((entry) => !entry.isDirectory && this.isVideo(entry.name))
            .sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))[0];
          if (!file) continue;
          await this.titles.updateOne(
            { sourceKey: this.sourceKey(library, folder.path) },
            { $set: { videoFileName: file.name, videoFileSizeBytes: file.sizeBytes } },
          );
        }
      }
    }

    const unmatched = Math.max(0, indexed - matched);
    const removed = await this.removeStaleTitles(library, kind, onDiskKeys);
    library.itemCount = indexed;
    library.missingCount = 0;
    library.unmatchedCount = unmatched;
    library.lastIndexedAt = new Date();
    await library.save();
    if (this.tmdb.enabled() && Date.now() >= lookupDeadline && unmatched > matched) {
      logs.push('TMDB time limit reached. Run Full scan again to match the remaining titles.');
    }
    if (removed > 0) {
      logs.push(`Removed ${removed} title${removed === 1 ? '' : 's'} that are no longer on disk.`);
    }
    logs.unshift(
      `${library.name}: ${indexed} titles, ${matched} matched on TMDB, ${unmatched} without a poster.`,
    );
    return { indexed, matched, unmatched, removed, logs };
  }

  async pruneLibraryFromDisk(library: MediaLibraryDocument, kind: CatalogKind): Promise<number> {
    let entries: SmbListedEntry[];
    try {
      entries = await this.list(library, library.smbRemotePath ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read library folder.';
      this.logger.warn(`Skip prune for ${library.name}: ${message}`);
      return 0;
    }
    const videos = entries.filter((entry) => !entry.isDirectory && this.isVideo(entry.name));
    const folders = entries.filter((entry) => entry.isDirectory);
    const onDiskKeys = await this.buildOnDiskKeys(library, kind, videos, folders);
    const removed = await this.removeStaleTitles(library, kind, onDiskKeys);
    if (removed > 0) {
      const remaining = await this.titles
        .countDocuments({ kind, sourceKey: new RegExp(`^${String(library._id)}:`) })
        .exec();
      library.itemCount = remaining;
      library.missingCount = 0;
      await library.save();
    }
    return removed;
  }

  /** Paths with playable video on disk (folders without video are treated as deleted). */
  private async buildOnDiskKeys(
    library: MediaLibraryDocument,
    kind: CatalogKind,
    videos: SmbListedEntry[],
    folders: SmbListedEntry[],
  ): Promise<Set<string>> {
    const keys = new Set<string>();
    if (kind === 'movie' && videos.length > 0 && videos.length >= folders.length) {
      for (const file of videos) {
        keys.add(this.sourceKey(library, file.path));
      }
      return keys;
    }
    const source = kind === 'series' ? folders : folders.length > 0 ? folders : videos;
    const capped = source.slice(0, MAX_TITLES);
    for (const entry of capped) {
      if (entry.isDirectory) {
        if (await this.entryHasPlayableVideo(library, entry)) {
          keys.add(this.sourceKey(library, entry.path));
        }
      } else if (this.isVideo(entry.name)) {
        keys.add(this.sourceKey(library, entry.path));
      }
    }
    return keys;
  }

  private async entryHasPlayableVideo(
    library: MediaLibraryDocument,
    entry: SmbListedEntry,
  ): Promise<boolean> {
    if (!entry.isDirectory) return this.isVideo(entry.name);
    try {
      const inner = await this.list(library, entry.path);
      if (inner.some((row) => !row.isDirectory && this.isVideo(row.name))) return true;
      for (const sub of inner.filter((row) => row.isDirectory).slice(0, 16)) {
        const deep = await this.list(library, sub.path);
        if (deep.some((row) => !row.isDirectory && this.isVideo(row.name))) return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  /** Drop catalog rows tied to this library whose file/folder was deleted from storage. */
  private async removeStaleTitles(
    library: MediaLibraryDocument,
    kind: CatalogKind,
    onDiskKeys: Set<string>,
  ): Promise<number> {
    const libId = String(library._id);
    const prefix = `${libId}:`;
    const rows = await this.titles
      .find({ kind, sourceKey: new RegExp(`^${libId}:`) })
      .select('_id sourceKey')
      .lean()
      .exec();
    const staleIds = rows
      .filter((row) => {
        const key = row.sourceKey;
        return typeof key === 'string' && key.startsWith(prefix) && !onDiskKeys.has(key);
      })
      .map((row) => row._id);
    if (!staleIds.length) return 0;
    const result = await this.titles.deleteMany({ _id: { $in: staleIds } }).exec();
    return result.deletedCount ?? 0;
  }

  private async upsertFromFile(
    library: MediaLibraryDocument,
    kind: CatalogKind,
    file: SmbListedEntry,
    allowLookup: () => boolean,
    bumpListedAt = false,
  ): Promise<boolean> {
    const parsed = this.parseTitle(file.name);
    const meta = (await this.needsPoster(library, file.path)) && allowLookup()
      ? await this.lookup(kind, parsed.title, parsed.year)
      : null;
    await this.upsert(
      library,
      file.path,
      {
        kind,
        title: meta?.title || parsed.title,
        year: meta?.year || parsed.year || new Date().getFullYear(),
        videoFileName: file.name,
        videoFileSizeBytes: file.sizeBytes,
        posterUrl: meta?.posterUrl ?? null,
        seasonCount: null,
      },
      bumpListedAt,
    );
    return Boolean(meta?.posterUrl);
  }

  private async upsertFromFolder(
    library: MediaLibraryDocument,
    kind: CatalogKind,
    folder: SmbListedEntry,
    allowLookup: () => boolean,
    bumpListedAt = false,
  ): Promise<boolean> {
    const parsed = this.parseTitle(folder.name);
    const meta = (await this.needsPoster(library, folder.path)) && allowLookup()
      ? await this.lookup(kind, parsed.title, parsed.year)
      : null;
    await this.upsert(
      library,
      folder.path,
      {
        kind,
        title: meta?.title || parsed.title,
        year: meta?.year || parsed.year || new Date().getFullYear(),
        videoFileName: folder.name,
        videoFileSizeBytes: null,
        posterUrl: meta?.posterUrl ?? null,
        seasonCount: null,
      },
      bumpListedAt,
    );
    return Boolean(meta?.posterUrl);
  }

  private async needsPoster(library: MediaLibraryDocument, relativePath: string): Promise<boolean> {
    const row = await this.titles
      .findOne({ sourceKey: this.sourceKey(library, relativePath) })
      .select('posterUrl')
      .lean()
      .exec();
    return !row?.posterUrl;
  }

  private allowLookup(force: boolean, used: number, deadline: number): boolean {
    if (Date.now() >= deadline) return false;
    return used < (force ? MAX_TITLES : 8);
  }

  private lookup(kind: CatalogKind, title: string, year: number | null) {
    return kind === 'series' ? this.tmdb.searchSeries(title, year) : this.tmdb.searchMovie(title, year);
  }

  private async upsert(
    library: MediaLibraryDocument,
    relativePath: string,
    fields: {
      kind: CatalogKind;
      title: string;
      year: number;
      videoFileName: string | null;
      videoFileSizeBytes: number | null;
      posterUrl: string | null;
      seasonCount: number | null;
    },
    bumpListedAt = false,
  ) {
    const set: Record<string, unknown> = {
      kind: fields.kind,
      videoFileName: fields.videoFileName,
      videoFileSizeBytes: fields.videoFileSizeBytes,
    };
    if (bumpListedAt) {
      set.listedAt = new Date();
    }
    const onInsert: Record<string, unknown> = {
      published: true,
      availability: 'available',
      featured: false,
      trending: false,
      seasonCount: fields.seasonCount,
    };
    if (fields.posterUrl) {
      set.title = fields.title;
      set.year = fields.year;
      set.posterUrl = fields.posterUrl;
    } else {
      onInsert.title = fields.title;
      onInsert.year = fields.year;
      onInsert.posterUrl = null;
    }
    await this.titles.updateOne(
      { sourceKey: this.sourceKey(library, relativePath) },
      { $setOnInsert: onInsert, $set: set },
      { upsert: true },
    );
  }

  private sourceKey(library: MediaLibraryDocument, relativePath: string): string {
    return `${String(library._id)}:${relativePath.replace(/\\/g, '/')}`;
  }

  /** Ensure /media “Recently added” sees uploads even when an older scan used a different sourceKey path. */
  private async markRecentlyUploaded(
    library: MediaLibraryDocument,
    kind: CatalogKind,
    relativePath: string,
    fileName: string,
  ): Promise<number> {
    const now = new Date();
    const libId = String(library._id);
    const exactKey = this.sourceKey(library, relativePath);
    const safeName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parsed = this.parseTitle(fileName);
    const titleEscaped = parsed.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const orClauses: Record<string, unknown>[] = [
      { sourceKey: exactKey },
      {
        sourceKey: new RegExp(`^${libId}:`),
        videoFileName: { $regex: new RegExp(`^${safeName}$`, 'i') },
      },
    ];
    if (parsed.title) {
      orClauses.push({
        sourceKey: new RegExp(`^${libId}:`),
        title: new RegExp(`^${titleEscaped}$`, 'i'),
        ...(parsed.year ? { year: parsed.year } : {}),
      });
    }
    let result = await this.titles
      .updateMany({ kind, $or: orClauses }, { $set: { listedAt: now } })
      .exec();
    let modified = result.modifiedCount ?? 0;
    if (modified === 0 && parsed.title) {
      result = await this.titles
        .updateMany(
          {
            kind,
            published: true,
            title: new RegExp(`^${titleEscaped}$`, 'i'),
            ...(parsed.year ? { year: parsed.year } : {}),
          },
          { $set: { listedAt: now } },
        )
        .exec();
      modified = result.modifiedCount ?? 0;
    }
    return modified;
  }

  private pathRelativeToLibrary(libRoot: string, fullOnShare: string): string {
    const full = fullOnShare.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!libRoot) return full;
    if (full === libRoot) return '';
    if (full.startsWith(`${libRoot}/`)) return full.slice(libRoot.length + 1);
    return full;
  }

  private async refreshLibraryCounts(library: MediaLibraryDocument): Promise<void> {
    const libId = String(library._id);
    const prefix = `^${libId}:`;
    const [total, withoutPoster] = await Promise.all([
      this.titles.countDocuments({ sourceKey: new RegExp(prefix) }).exec(),
      this.titles
        .countDocuments({
          sourceKey: new RegExp(prefix),
          $or: [{ posterUrl: null }, { posterUrl: '' }],
        })
        .exec(),
    ]);
    library.itemCount = total;
    library.unmatchedCount = withoutPoster;
    library.missingCount = 0;
    library.lastIndexedAt = new Date();
    await library.save();
  }

  private parseTitle(name: string): { title: string; year: number | null } {
    const base = name.replace(/\.[a-z0-9]{2,5}$/i, '');
    const yearMatch = base.match(/\b((?:19|20)\d{2})\b/);
    const year = yearMatch?.[1] ? Number(yearMatch[1]) : null;
    const title = base
      .replace(/\((?:19|20)\d{2}\)/g, '')
      .replace(/[._]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { title: title || base, year };
  }

  private isVideo(name: string): boolean {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return false;
    return VIDEO_EXT.has(name.slice(dot).toLowerCase());
  }

  private async list(library: MediaLibraryDocument, remotePath: string): Promise<SmbListedEntry[]> {
    if (library.provider === 'smb') {
      if (!library.smbServerId) return [];
      const server = await this.servers.findById(library.smbServerId).select('+passwordEnc').exec();
      if (!server) return [];
      const password = this.crypto.openInventoryValue(server.passwordEnc);
      return this.smb.list(
        {
          host: server.host,
          port: server.port,
          username: server.username,
          password,
          domain: server.domain,
          share: server.share,
        },
        remotePath,
      );
    }
    return this.listLocal(library.rootPath, remotePath);
  }

  private async listLocal(rootPath: string, remotePath: string): Promise<SmbListedEntry[]> {
    const full = remotePath ? `${rootPath.replace(/[\\/]+$/, '')}/${remotePath}` : rootPath;
    let dirents;
    try {
      dirents = await readdir(full, { withFileTypes: true });
    } catch {
      return [];
    }
    const entries: SmbListedEntry[] = [];
    for (const dirent of dirents) {
      if (!dirent.name || dirent.name.startsWith('.')) continue;
      const rel = remotePath ? `${remotePath}/${dirent.name}` : dirent.name;
      let sizeBytes: number | null = null;
      if (dirent.isFile()) {
        const info = await stat(`${full.replace(/[\\/]+$/, '')}/${dirent.name}`).catch(() => null);
        sizeBytes = info?.size ?? null;
      }
      entries.push({
        name: dirent.name,
        path: rel.replace(/\\/g, '/'),
        isDirectory: dirent.isDirectory(),
        sizeBytes,
      });
    }
    return entries;
  }
}
