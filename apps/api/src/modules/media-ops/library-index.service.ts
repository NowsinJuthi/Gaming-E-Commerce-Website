import { readdir, stat } from 'fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CatalogKind, CatalogTitle, CatalogTitleDocument } from '../../database/schemas/catalog-title.schema';
import { MediaLibrary, MediaLibraryDocument } from '../../database/schemas/media-library.schema';
import { SmbServer, SmbServerDocument } from '../../database/schemas/smb-server.schema';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { SmbClientService, type SmbListedEntry } from './smb-client.service';

const VIDEO_EXT = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts', '.m2ts', '.webm', '.mpg', '.mpeg']);
const FRESH_MS = 10 * 60 * 1000;
const MAX_TITLES = 80;
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
  ) {}

  async sync(kind: CatalogKind): Promise<void> {
    const libKind = kind === 'series' ? 'tv' : 'movies';
    const rows = await this.libraries.find({ kind: libKind, enabled: true }).exec();
    const deadline = Date.now() + 22_000;
    for (const library of rows) {
      if (Date.now() > deadline) break;
      if (library.lastIndexedAt && Date.now() - library.lastIndexedAt.getTime() < FRESH_MS) continue;
      try {
        await this.indexLibrary(library, kind);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Library index failed.';
        this.logger.warn(`Could not index ${library.name}: ${message}`);
      }
    }
  }

  async syncLibrary(id: string): Promise<{ indexed: number }> {
    if (!Types.ObjectId.isValid(id)) return { indexed: 0 };
    const library = await this.libraries.findById(id).exec();
    if (!library) return { indexed: 0 };
    const kind: CatalogKind = library.kind === 'tv' ? 'series' : 'movie';
    const indexed = await this.indexLibrary(library, kind);
    return { indexed };
  }

  private async indexLibrary(library: MediaLibraryDocument, kind: CatalogKind): Promise<number> {
    const entries = await this.list(library, library.smbRemotePath ?? '');
    const videos = entries.filter((entry) => !entry.isDirectory && this.isVideo(entry.name));
    const folders = entries.filter((entry) => entry.isDirectory);
    let indexed = 0;

    if (kind === 'movie' && videos.length > 0 && videos.length >= folders.length) {
      for (const file of videos.slice(0, MAX_TITLES)) {
        await this.upsertFromFile(library, kind, file);
        indexed += 1;
      }
    } else {
      const source = kind === 'series' ? folders : folders.length > 0 ? folders : videos;
      for (const entry of source.slice(0, MAX_TITLES)) {
        if (entry.isDirectory) await this.upsertFromFolder(library, kind, entry);
        else await this.upsertFromFile(library, kind, entry);
        indexed += 1;
      }
      if (kind === 'movie') {
        for (const folder of folders.slice(0, ENRICH_LIMIT)) {
          const inner = await this.list(library, folder.path).catch(() => [] as SmbListedEntry[]);
          const file = inner
            .filter((entry) => !entry.isDirectory && this.isVideo(entry.name))
            .sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))[0];
          if (!file) continue;
          const parsed = this.parseTitle(folder.name);
          await this.titles.updateOne(
            { sourceKey: this.sourceKey(library, folder.path) },
            {
              $set: {
                videoFileName: file.name,
                videoFileSizeBytes: file.sizeBytes,
                ...(parsed.year ? { year: parsed.year } : {}),
              },
            },
          );
        }
      }
    }

    library.itemCount = indexed;
    library.lastIndexedAt = new Date();
    await library.save();
    return indexed;
  }

  private async upsertFromFile(library: MediaLibraryDocument, kind: CatalogKind, file: SmbListedEntry) {
    const parsed = this.parseTitle(file.name);
    await this.upsert(library, file.path, {
      kind,
      title: parsed.title,
      year: parsed.year ?? new Date().getFullYear(),
      videoFileName: file.name,
      videoFileSizeBytes: file.sizeBytes,
      seasonCount: null,
    });
  }

  private async upsertFromFolder(library: MediaLibraryDocument, kind: CatalogKind, folder: SmbListedEntry) {
    const parsed = this.parseTitle(folder.name);
    await this.upsert(library, folder.path, {
      kind,
      title: parsed.title,
      year: parsed.year ?? new Date().getFullYear(),
      videoFileName: null,
      videoFileSizeBytes: null,
      seasonCount: kind === 'series' ? null : null,
    });
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
      seasonCount: number | null;
    },
  ) {
    await this.titles.updateOne(
      { sourceKey: this.sourceKey(library, relativePath) },
      {
        $setOnInsert: {
          title: fields.title,
          year: fields.year,
          published: true,
          availability: 'available',
          featured: false,
          trending: false,
          posterUrl: null,
          seasonCount: fields.seasonCount,
        },
        $set: {
          kind: fields.kind,
          videoFileName: fields.videoFileName,
          videoFileSizeBytes: fields.videoFileSizeBytes,
        },
      },
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
