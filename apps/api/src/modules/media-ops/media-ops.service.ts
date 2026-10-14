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
import { CryptoService } from '../../shared/crypto/crypto.service';
import { SmbClientService } from './smb-client.service';

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
    const result = await this.libraries.deleteOne({ _id: id }).exec();
    if (!result.deletedCount) throw new NotFoundException('Media library not found.');
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
