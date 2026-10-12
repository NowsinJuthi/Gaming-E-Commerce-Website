import { execFile } from 'child_process';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { Injectable, Logger } from '@nestjs/common';

const execFileAsync = promisify(execFile);

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
    const cleaned = input.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!cleaned) return '';
    if (cleaned.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('That folder path is not allowed.');
    }
    return cleaned;
  }

  async test(auth: SmbAuth): Promise<void> {
    if (process.platform === 'linux') {
      await this.runSmbclient(auth, 'exit');
      return;
    }
    const client = await this.createClient(auth);
    try {
      await client.readdir('');
    } finally {
      client.close?.();
    }
  }

  async list(auth: SmbAuth, remotePath = ''): Promise<SmbListedEntry[]> {
    const base = this.normalizeRemotePath(remotePath);
    if (process.platform === 'linux') {
      return this.listWithSmbclient(auth, base);
    }
    return this.listWithSmb2(auth, base);
  }

  private async listWithSmbclient(auth: SmbAuth, base: string): Promise<SmbListedEntry[]> {
    const output = await this.runSmbclient(auth, 'ls', base);
    const entries: SmbListedEntry[] = [];
    for (const line of output.split(/\r?\n/)) {
      const parsed = this.parseSmbclientLsLine(line);
      if (!parsed) continue;
      const { name, isDirectory } = parsed;
      if (!name || name === '.' || name === '..') continue;
      const lower = name.toLowerCase();
      if (lower.startsWith('.') || lower === 'thumbs.db' || lower === 'desktop.ini') {
        continue;
      }
      const rel = base ? `${base}/${name}` : name;
      entries.push({
        name,
        path: rel.replace(/\\/g, '/'),
        isDirectory,
      });
    }
    if (entries.length === 0 && /NT_STATUS_/.test(output)) {
      throw new Error(this.formatLinuxSmbError(output));
    }
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return entries;
  }

  private async runSmbclient(auth: SmbAuth, command: string, remotePath = ''): Promise<string> {
    const credFile = join(tmpdir(), `uniqbd-smb-${randomBytes(12).toString('hex')}.cred`);
    const domain = (auth.domain ?? '').trim();
    const credDomain = !domain || domain === '.' ? 'WORKGROUP' : domain;
    await fs.writeFile(
      credFile,
      `username=${auth.username}\npassword=${auth.password}\ndomain=${credDomain}\n`,
      { mode: 0o600 },
    );
    try {
      const args = [
        `//${auth.host}/${auth.share}`,
        '-A',
        credFile,
        '-p',
        String(auth.port ?? 445),
        '-m',
        'SMB3',
      ];
      if (credDomain.toUpperCase() !== 'WORKGROUP') {
        args.push('-W', credDomain);
      }
      const cleaned = remotePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (cleaned) args.push('-D', cleaned);
      args.push('-c', command);
      const { stdout } = await execFileAsync('smbclient', args, {
        timeout: 25_000,
        maxBuffer: 4_000_000,
      });
      return stdout;
    } catch (error) {
      const message = this.formatLinuxSmbError(error);
      this.logger.warn(`Samba list failed for //${auth.host}/${auth.share}: ${message}`);
      throw new Error(message);
    } finally {
      await fs.unlink(credFile).catch(() => undefined);
    }
  }

  /** smbclient `ls` lines are not grepable; `-g` does not apply to directory listings. */
  private parseSmbclientLsLine(
    line: string,
  ): { name: string; isDirectory: boolean } | null {
    if (/blocks of size|blocks available|^Domain=\[/i.test(line)) return null;
    const human = line.match(
      /^\s{2}(.+?)\s+([ADHSRN]+)\s+(\d+)\s+\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}\s*$/,
    );
    const name = human?.[1]?.trim();
    const modes = human?.[2];
    if (!name || !modes) return null;
    return {
      name,
      isDirectory: modes.includes('D'),
    };
  }

  private formatLinuxSmbError(error: unknown): string {
    if (this.isExecError(error) && error.code === 'ENOENT') {
      return 'smbclient is not installed on the website server. Install the samba-client package, then open this folder again.';
    }
    const raw = this.redactSecrets(this.execText(error));
    const nt = raw.match(/NT_STATUS_[A-Z0-9_]+/)?.[0];
    if (nt === 'NT_STATUS_LOGON_FAILURE') {
      return 'Login failure — the Samba username or password is wrong.';
    }
    if (nt === 'NT_STATUS_ACCESS_DENIED') {
      return 'Access denied for this Samba share.';
    }
    if (nt === 'NT_STATUS_BAD_NETWORK_NAME') {
      return 'Share name was not found on that server.';
    }
    if (nt === 'NT_STATUS_HOST_UNREACHABLE' || nt === 'NT_STATUS_IO_TIMEOUT' || nt === 'NT_STATUS_CONNECTION_REFUSED') {
      return 'The website server cannot reach this storage server on port 445.';
    }
    if (nt) {
      return nt.replace(/^NT_STATUS_/, '').replace(/_/g, ' ').toLowerCase();
    }
    if (/ETIMEDOUT|timed out|timeout/i.test(raw)) {
      return 'Timed out reaching the storage server on port 445. Allow this website server to connect to that IP on port 445.';
    }
    if (/ECONNREFUSED|Connection refused/i.test(raw)) {
      return 'Connection refused on port 445. Samba is not accepting connections from this website server.';
    }
    if (/ENETUNREACH|EHOSTUNREACH|Network is unreachable/i.test(raw)) {
      return 'The website server cannot reach this storage server on port 445.';
    }
    const line = raw
      .split('\n')
      .map((part) => part.trim())
      .find((part) => part && !/^Command failed:/i.test(part));
    return (line || 'Samba request failed.').slice(0, 400);
  }

  private execText(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return 'Samba request failed.';
    const err = error as { message?: string; stderr?: Buffer | string; stdout?: Buffer | string };
    const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8') ?? '';
    const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf8') ?? '';
    return [stderr, stdout, err.message ?? ''].filter(Boolean).join('\n');
  }

  private isExecError(error: unknown): error is { code?: string } {
    return Boolean(error && typeof error === 'object' && 'code' in error);
  }

  private redactSecrets(value: string): string {
    return value.replace(/password=[^\s]+/gi, 'password=***');
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

  private async listWithSmb2(auth: SmbAuth, base: string): Promise<SmbListedEntry[]> {
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
