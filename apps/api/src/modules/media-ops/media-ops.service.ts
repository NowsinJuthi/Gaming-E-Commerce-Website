import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MediaLibrary,
  MediaLibraryDocument,
  MediaLibraryKind,
} from '../../database/schemas/media-library.schema';
import {
  SmbServer,
  SmbServerDocument,
} from '../../database/schemas/smb-server.schema';
import {
  CatalogKind,
  CatalogTitle,
  CatalogTitleDocument,
} from '../../database/schemas/catalog-title.schema';
import { unlink } from 'fs/promises';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { SmbClientService } from './smb-client.service';

const VIDEO_EXT = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts', '.m2ts', '.webm', '.mpg', '.mpeg']);

function sanitizeUploadRelativePath(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
}

function serializeLibrary(doc: MediaLibraryDocument) {
  return {
    id: String(doc._id),
    name: doc.name,
    kind: doc.kind,
    provider: doc.provider,
    rootPath: doc.rootPath,
    enabled: doc.enabled,
    imageUrl: doc.imageUrl ?? null,
    smbServerId: doc.smbServerId ? String(doc.smbServerId) : null,
    smbShare: doc.smbShare ?? null,
    smbRemotePath: doc.smbRemotePath ?? null,
    itemCount: doc.itemCount ?? 0,
    missingCount: doc.missingCount ?? 0,
    unmatchedCount: doc.unmatchedCount ?? 0,
    createdAt: doc.get('createdAt'),
    updatedAt: doc.get('updatedAt'),
  };
}

function serializeServer(doc: SmbServerDocument) {
  return {
    id: String(doc._id),
    name: doc.name,
    host: doc.host,
    port: doc.port,
    username: doc.username,
    domain: doc.domain,
    share: doc.share,
    enabled: doc.enabled,
    hasPassword: Boolean(doc.get('passwordEnc')),
    lastOkAt: doc.lastOkAt ?? null,
    lastError: doc.lastError ?? null,
    createdAt: doc.get('createdAt'),
    updatedAt: doc.get('updatedAt'),
  };
}

@Injectable()
export class MediaOpsService {
  constructor(
    @InjectModel(MediaLibrary.name)
    private readonly libraries: Model<MediaLibraryDocument>,
    @InjectModel(SmbServer.name)
    private readonly servers: Model<SmbServerDocument>,
    @InjectModel(CatalogTitle.name)
    private readonly catalogTitles: Model<CatalogTitleDocument>,
    private readonly crypto: CryptoService,
    private readonly smb: SmbClientService,
  ) {}

  async listLibraries() {
    const rows = await this.libraries.find().sort({ updatedAt: -1 }).exec();
    const libraries = rows.map(serializeLibrary);
    return {
      libraries,
      totals: {
        items: libraries.reduce((sum, row) => sum + row.itemCount, 0),
        missing: libraries.reduce((sum, row) => sum + row.missingCount, 0),
        unmatched: libraries.reduce((sum, row) => sum + row.unmatchedCount, 0),
      },
    };
  }

  async movieServerDashboard() {
    const rows = await this.libraries.find().sort({ kind: 1, name: 1 }).exec();
    const agg = await this.catalogTitles
      .aggregate<{ _id: { libId: string; kind: CatalogKind }; count: number }>([
        { $match: { sourceKey: { $exists: true, $nin: [null, ''] } } },
        {
          $project: {
            libId: { $arrayElemAt: [{ $split: ['$sourceKey', ':'] }, 0] },
          },
        },
        { $group: { _id: { libId: '$libId' }, count: { $sum: 1 } } },
      ])
      .exec();

    const countByLib = new Map<string, number>();
    for (const row of agg) {
      const libId = row._id.libId;
      if (!Types.ObjectId.isValid(libId)) continue;
      countByLib.set(libId, row.count);
    }

    let totalMovies = 0;
    let totalSeries = 0;
    const libraries = rows.map((doc) => {
      const base = serializeLibrary(doc);
      const catalogCount = countByLib.get(String(doc._id)) ?? 0;
      if (doc.kind === 'tv') totalSeries += catalogCount;
      else totalMovies += catalogCount;
      return {
        ...base,
        catalogCount,
      };
    });

    return {
      totals: {
        libraries: libraries.length,
        movies: totalMovies,
        series: totalSeries,
        catalog: totalMovies + totalSeries,
      },
      libraries,
    };
  }

  async createLibrary(input: {
    name: string;
    kind: MediaLibraryKind;
    rootPath: string;
  }) {
    const name = input.name.trim();
    const rootPath = input.rootPath.trim();
    if (!name || !rootPath) {
      throw new BadRequestException('Name and media directory are required.');
    }
    try {
      const created = await this.libraries.create({
        name,
        kind: input.kind,
        provider: 'local',
        rootPath,
        enabled: true,
      });
      return serializeLibrary(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('A library with this name and kind already exists.');
      }
      throw error;
    }
  }

  async updateLibrary(
    id: string,
    patch: Partial<{
      name: string;
      kind: MediaLibraryKind;
      rootPath: string;
      enabled: boolean;
    }>,
  ) {
    const library = await this.requireLibrary(id);
    if (library.provider === 'smb' && patch.rootPath) {
      throw new BadRequestException(
        'Samba library paths are managed from Samba file manager.',
      );
    }
    if (patch.name !== undefined) library.name = patch.name.trim();
    if (patch.kind !== undefined) library.kind = patch.kind;
    if (patch.rootPath !== undefined) library.rootPath = patch.rootPath.trim();
    if (patch.enabled !== undefined) library.enabled = patch.enabled;
    await library.save();
    return serializeLibrary(library);
  }

  async removeLibrary(id: string) {
    const library = await this.libraries.findById(id).exec();
    if (!library) throw new NotFoundException('Media library not found.');
    const kind: CatalogKind = library.kind === 'tv' ? 'series' : 'movie';
    await this.catalogTitles
      .deleteMany({ kind, sourceKey: new RegExp(`^${String(library._id)}:`) })
      .exec();
    await this.libraries.deleteOne({ _id: library._id }).exec();
    return { deleted: true };
  }

  async listServers() {
    const rows = await this.servers.find().select('+passwordEnc').sort({ name: 1 }).exec();
    return { servers: rows.map(serializeServer) };
  }

  async createServer(input: {
    name: string;
    host: string;
    port?: number;
    username: string;
    password: string;
    domain?: string;
    share: string;
  }) {
    const sealed = this.crypto.sealInventoryValue(input.password);
    try {
      const created = await this.servers.create({
        name: input.name.trim(),
        host: input.host.trim(),
        port: input.port ?? 445,
        username: input.username.trim(),
        passwordEnc: sealed.value,
        domain: input.domain?.trim() || 'WORKGROUP',
        share: input.share.trim(),
        enabled: true,
      });
      const withSecret = await this.servers
        .findById(created._id)
        .select('+passwordEnc')
        .exec();
      if (!withSecret) throw new NotFoundException('Samba server not found.');
      await this.touchConnection(withSecret);
      return serializeServer(withSecret);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('This Samba server is already saved.');
      }
      throw error;
    }
  }

  async savePassword(id: string, password: string) {
    const server = await this.requireServer(id);
    server.passwordEnc = this.crypto.sealInventoryValue(password).value;
    await this.touchConnection(server);
    return serializeServer(server);
  }

  async removeServer(id: string) {
    const inUse = await this.libraries.countDocuments({ smbServerId: id }).exec();
    if (inUse > 0) {
      throw new BadRequestException(
        'Disconnect or remove media libraries that use this Samba server first.',
      );
    }
    const result = await this.servers.deleteOne({ _id: id }).exec();
    if (!result.deletedCount) throw new NotFoundException('Samba server not found.');
    return { deleted: true };
  }

  async testServer(id: string) {
    const server = await this.requireServer(id);
    await this.touchConnection(server);
    return { ok: !server.lastError, error: server.lastError };
  }

  async browse(id: string, remotePath = '') {
    const server = await this.requireServer(id);
    const password = this.openPassword(server);
    try {
      const entries = await this.smb.list(this.auth(server, password), remotePath);
      server.lastOkAt = new Date();
      server.lastError = null;
      await server.save();
      return { path: remotePath, entries };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Samba browse failed.';
      server.lastError = message;
      await server.save();
      throw new BadRequestException(message);
    }
  }

  async uploadToShare(
    serverId: string,
    browsePath: string,
    files: Express.Multer.File[],
    kind: MediaLibraryKind,
  ) {
    if (!files.length) {
      throw new BadRequestException('Choose at least one video file or folder.');
    }
    const server = await this.requireServer(serverId);
    const password = this.openPassword(server);
    const auth = this.auth(server, password);
    const base = browsePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    let uploaded = 0;
    try {
      for (const file of files) {
        const rel = sanitizeUploadRelativePath(file.originalname || file.filename);
        if (!rel || !this.isVideoFileName(rel)) {
          throw new BadRequestException(`Unsupported video file: ${file.originalname || file.filename}`);
        }
        const remote = base ? `${base}/${rel}` : rel;
        await this.smb.uploadLocalFile(auth, remote, file.path);
        uploaded += 1;
      }
      server.lastOkAt = new Date();
      server.lastError = null;
      await server.save();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload to Samba failed.';
      server.lastError = message;
      await server.save();
      throw new BadRequestException(message);
    } finally {
      await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
    }
    const library = await this.resolveLibraryForShare(server, base, kind);
    return { uploaded, library };
  }

  async addLibraryFromShare(input: {
    serverId: string;
    path: string;
    name: string;
    kind: MediaLibraryKind;
  }) {
    const server = await this.requireServer(input.serverId);
    const remotePath = input.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const rootPath = `\\\\${server.host}\\${server.share}${remotePath ? `\\${remotePath.replace(/\//g, '\\')}` : ''}`;
    try {
      const created = await this.libraries.create({
        name: input.name.trim(),
        kind: input.kind,
        provider: 'smb',
        rootPath,
        enabled: true,
        smbServerId: server._id,
        smbShare: server.share,
        smbRemotePath: remotePath,
      });
      return serializeLibrary(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('A library with this name and kind already exists.');
      }
      throw error;
    }
  }

  private isVideoFileName(name: string): boolean {
    const base = name.split('/').pop() ?? name;
    const dot = base.lastIndexOf('.');
    if (dot < 0) return false;
    return VIDEO_EXT.has(base.slice(dot).toLowerCase());
  }

  private async resolveLibraryForShare(
    server: SmbServerDocument,
    remotePath: string,
    kind: MediaLibraryKind,
  ) {
    const normalized = remotePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const candidates = await this.libraries.find({ smbServerId: server._id, enabled: true }).exec();
    let best: MediaLibraryDocument | null = null;
    let bestLen = -1;
    for (const lib of candidates) {
      const root = (lib.smbRemotePath ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const underRoot =
        root === normalized ||
        (root.length === 0 && normalized.length >= 0) ||
        (root.length > 0 && (normalized === root || normalized.startsWith(`${root}/`)));
      if (underRoot && root.length > bestLen) {
        best = lib;
        bestLen = root.length;
      }
    }
    if (best) return serializeLibrary(best);

    const folderName = normalized ? normalized.split('/').filter(Boolean).pop() || normalized : server.share;
    let name = folderName.trim().slice(0, 80) || server.share.slice(0, 80);
    try {
      return await this.addLibraryFromShare({
        serverId: String(server._id),
        path: normalized,
        name,
        kind,
      });
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      name = `${folderName} (${kind})`.slice(0, 80);
      return this.addLibraryFromShare({
        serverId: String(server._id),
        path: normalized,
        name,
        kind,
      });
    }
  }

  private async requireLibrary(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Media library not found.');
    }
    const library = await this.libraries.findById(id).exec();
    if (!library) throw new NotFoundException('Media library not found.');
    return library;
  }

  private async requireServer(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Samba server not found.');
    }
    const server = await this.servers.findById(id).select('+passwordEnc').exec();
    if (!server) throw new NotFoundException('Samba server not found.');
    return server;
  }

  private openPassword(server: SmbServerDocument): string {
    try {
      return this.crypto.openInventoryValue(server.passwordEnc);
    } catch {
      throw new BadRequestException(
        'Saved Samba password could not be read. Enter the password again and save.',
      );
    }
  }

  private auth(server: SmbServerDocument, password: string) {
    return {
      host: server.host,
      port: server.port,
      username: server.username,
      password,
      domain: server.domain,
      share: server.share,
    };
  }

  private async touchConnection(server: SmbServerDocument) {
    try {
      await this.smb.test(this.auth(server, this.openPassword(server)));
      server.lastOkAt = new Date();
      server.lastError = null;
    } catch (error) {
      server.lastError = error instanceof Error ? error.message : 'Samba connection failed.';
    }
    await server.save();
  }
}
