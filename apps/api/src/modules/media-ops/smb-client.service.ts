import { Injectable, Logger } from '@nestjs/common';

export type SmbAuth = {
  host: string;
  port?: number;
  username: string;
  password: string;
  domain?: string;
  share: string;
};

export type SmbListedEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

type Smb2Client = {
  readdir: (
    path: string,
    options?: { stats?: boolean },
  ) => Promise<Array<string | { name: string; isDirectory?: () => boolean }>>;
  close?: () => void;
};

@Injectable()
export class SmbClientService {
  private readonly logger = new Logger(SmbClientService.name);

  private normalizeRemotePath(input?: string | null): string {
    if (!input) return '';
    return input.replace(/\//g, '\\').replace(/^\\+/, '').replace(/\\+$/, '');
  }

  private async createClient(auth: SmbAuth): Promise<Smb2Client> {
    let SMB2: new (options: {
      share: string;
      domain: string;
      username: string;
      password: string;
      port?: number;
      autoCloseTimeout?: number;
    }) => Smb2Client;
    try {
      const mod = (await import('@marsaud/smb2')) as unknown as {
        default?: new (options: {
          share: string;
          domain: string;
          username: string;
          password: string;
          port?: number;
          autoCloseTimeout?: number;
        }) => Smb2Client;
      };
      const ctor = mod.default;
      if (!ctor) {
        throw new Error('Samba client module did not export a constructor.');
      }
      SMB2 = ctor;
    } catch {
      throw new Error(
        'Samba client is not installed. Run pnpm --filter @uniqbd/api add @marsaud/smb2',
      );
    }
    const domain = auth.domain?.trim() ? auth.domain.trim() : 'WORKGROUP';
    return new SMB2({
      share: `\\\\${auth.host}\\${auth.share}`,
      domain: domain || '.',
      username: auth.username,
      password: auth.password,
      port: auth.port ?? 445,
      autoCloseTimeout: 15_000,
    });
  }

  async test(auth: SmbAuth): Promise<void> {
    const client = await this.createClient(auth);
    try {
      await client.readdir('');
    } finally {
      client.close?.();
    }
  }

  async list(auth: SmbAuth, remotePath = ''): Promise<SmbListedEntry[]> {
    const base = this.normalizeRemotePath(remotePath);
    const client = await this.createClient(auth);
    try {
      const files = await client.readdir(base, { stats: true });
      const entries: SmbListedEntry[] = [];
      for (const file of files) {
        const name = typeof file === 'string' ? file : file.name;
        if (!name || name === '.' || name === '..') continue;
        const lower = name.toLowerCase();
        if (lower.startsWith('.') || lower === 'thumbs.db' || lower === 'desktop.ini') {
          continue;
        }
        const full = base ? `${base}\\${name}` : name;
        const isDirectory =
          typeof file === 'string' ? !name.includes('.') : Boolean(file.isDirectory?.());
        entries.push({
          name,
          path: full.replace(/\\/g, '/'),
          isDirectory,
        });
      }
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return entries;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Samba list failed: ${message}`);
      throw error;
    } finally {
      client.close?.();
    }
  }
}
