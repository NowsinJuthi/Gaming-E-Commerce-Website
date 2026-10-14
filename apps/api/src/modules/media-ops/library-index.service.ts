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
const MAX_TITLES = 1000;
const ENRICH_LIMIT = 16;

@Injectable()
export class LibraryIndexService {
  private readonly logger = new Logger(LibraryIndexService.name);

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
      if (library.lastIndexedAt && Date.now() - library.lastIndexedAt.getTime() < FRESH_MS) continue;
      try {
        await this.indexLibrary(library, kind, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Library index failed.';
        this.logger.warn(`Could not index ${library.name}: ${message}`);
      }
    }
  }

  async syncLibrary(id: string): Promise<{ indexed: number; matched: number; unmatched: number; logs: string[] }> {
    const empty = { indexed: 0, matched: 0, unmatched: 0, logs: ['Library not found.'] };
    if (!Types.ObjectId.isValid(id)) return empty;
    const library = await this.libraries.findById(id).exec();
    if (!library) return empty;
    const kind: CatalogKind = library.kind === 'tv' ? 'series' : 'movie';
    const result = await this.indexLibrary(library, kind, true);
    return result;
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
  ): Promise<{ indexed: number; matched: number; unmatched: number; logs: string[] }> {
    if (!force && library.lastIndexedAt && Date.now() - library.lastIndexedAt.getTime() < FRESH_MS) {
      return {
        indexed: library.itemCount,
        matched: Math.max(0, library.itemCount - library.unmatchedCount),
        unmatched: library.unmatchedCount,
        logs: [`${library.name} was scanned recently.`],
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
    library.itemCount = indexed;
    library.missingCount = 0;
    library.unmatchedCount = unmatched;
    library.lastIndexedAt = new Date();
    await library.save();
    if (this.tmdb.enabled() && Date.now() >= lookupDeadline && unmatched > matched) {
      logs.push('TMDB time limit reached. Run Full scan again to match the remaining titles.');
    }
    logs.unshift(
      `${library.name}: ${indexed} titles, ${matched} matched on TMDB, ${unmatched} without a poster.`,
    );
    return { indexed, matched, unmatched, logs };
  }

  private async upsertFromFile(
    library: MediaLibraryDocument,
    kind: CatalogKind,
    file: SmbListedEntry,
    allowLookup: () => boolean,
  ): Promise<boolean> {
    const parsed = this.parseTitle(file.name);
    const meta = (await this.needsPoster(library, file.path)) && allowLookup()
      ? await this.lookup(kind, parsed.title, parsed.year)
      : null;
    await this.upsert(library, file.path, {
      kind,
      title: meta?.title || parsed.title,
      year: meta?.year || parsed.year || new Date().getFullYear(),
      videoFileName: file.name,
      videoFileSizeBytes: file.sizeBytes,
      posterUrl: meta?.posterUrl ?? null,
      seasonCount: null,
    });
    return Boolean(meta?.posterUrl);
  }

  private async upsertFromFolder(
    library: MediaLibraryDocument,
    kind: CatalogKind,
    folder: SmbListedEntry,
    allowLookup: () => boolean,
  ): Promise<boolean> {
    const parsed = this.parseTitle(folder.name);
    const meta = (await this.needsPoster(library, folder.path)) && allowLookup()
      ? await this.lookup(kind, parsed.title, parsed.year)
      : null;
    await this.upsert(library, folder.path, {
      kind,
      title: meta?.title || parsed.title,
      year: meta?.year || parsed.year || new Date().getFullYear(),
      videoFileName: folder.name,
      videoFileSizeBytes: null,
      posterUrl: meta?.posterUrl ?? null,
      seasonCount: null,
    });
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
  ) {
    const set: Record<string, unknown> = {
      kind: fields.kind,
      videoFileName: fields.videoFileName,
      videoFileSizeBytes: fields.videoFileSizeBytes,
    };
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
