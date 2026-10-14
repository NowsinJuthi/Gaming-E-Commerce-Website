import { execFile, spawn, type ChildProcess } from 'child_process';
import { constants } from 'fs';
import { open, unlink, type FileHandle } from 'fs/promises';
import type { Readable } from 'stream';
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
  sizeBytes: number | null;
};

export type SmbIncoming = {
  process: ChildProcess;
  first: Buffer;
  read: () => Promise<Buffer | null>;
  close: () => Promise<void>;
};

export type SmbPlayback = {
  size: number;
  read: (start: number, end: number) => Promise<Readable>;
  close: () => void;
};

type SmbStreamClient = {
  getSize: (path: string) => Promise<number>;
  createReadStream: (
    path: string,
    options?: { start?: number; end?: number },
  ) => Promise<Readable & { fileSize?: number }>;
  disconnect: () => void;
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

  /** Copy one share file onto the website server. The local path must already have a parent directory. */
  async downloadFile(auth: SmbAuth, remoteFile: string, localFile: string): Promise<void> {
    const remote = this.normalizeRemotePath(remoteFile);
    if (!remote || remote.includes('"') || localFile.includes('"')) {
      throw new Error('That file path is not allowed.');
    }
    const attempts = this.authAttempts(auth);
    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        await this.spawnGet(attempt, remote, localFile, 'SMB3');
        return;
      } catch (error) {
        lastError = error;
        const raw = this.execText(error);
        if (this.isUnreachable(raw)) break;
        if (/protocol|CONNECTION_DISCONNECTED|INVALID_NETWORK_RESPONSE/i.test(raw)) {
          try {
            await this.spawnGet(attempt, remote, localFile, 'SMB2');
            return;
          } catch (smb2Error) {
            lastError = smb2Error;
          }
        }
        if (!/LOGON_FAILURE|BAD_NETWORK_NAME|ACCESS_DENIED/i.test(raw)) break;
      }
    }

    const baseAuth = attempts[0] ?? auth;
    const shares = await this.listDiskShares(baseAuth).catch(() => [] as string[]);
    const tried = new Set([auth.share.trim().toLowerCase()]);
    for (const share of shares) {
      if (tried.has(share.toLowerCase())) continue;
      tried.add(share.toLowerCase());
      await unlink(localFile).catch(() => undefined);
      try {
        await this.spawnGet({ ...baseAuth, share }, remote, localFile, 'SMB3');
        return;
      } catch (error) {
        lastError = error;
      }
    }

    const message = this.formatLinuxSmbError(lastError);
    const shareHint = shares.length > 0 ? ` Shares on this server: ${shares.join(', ')}.` : '';
    throw new Error(`${message}${shareHint}`);
  }

  /**
   * Start reading a share file. Resolves when the first bytes arrive so playback
   * can begin without copying the whole movie first.
   */
  async beginFileStream(auth: SmbAuth, remoteFile: string, fifoPath: string): Promise<SmbIncoming> {
    const remote = this.normalizeRemotePath(remoteFile);
    if (!remote || remote.includes('"') || fifoPath.includes('"')) {
      throw new Error('That file path is not allowed.');
    }
    const attempts = this.authAttempts(auth);
    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        return await this.openGetStream(attempt, remote, fifoPath, 'SMB3');
      } catch (error) {
        lastError = error;
        const raw = this.execText(error);
        if (this.isUnreachable(raw)) break;
        if (/protocol|CONNECTION_DISCONNECTED|INVALID_NETWORK_RESPONSE/i.test(raw)) {
          try {
            return await this.openGetStream(attempt, remote, fifoPath, 'SMB2');
          } catch (smb2Error) {
            lastError = smb2Error;
          }
        }
        if (!/LOGON_FAILURE|BAD_NETWORK_NAME|ACCESS_DENIED|did not send/i.test(raw)) break;
      }
    }
    const baseAuth = attempts[0] ?? auth;
    const shares = await this.listDiskShares(baseAuth).catch(() => [] as string[]);
    const known = auth.share.trim().toLowerCase();
    for (const share of shares) {
      if (share.toLowerCase() === known) continue;
      try {
        return await this.openGetStream({ ...baseAuth, share }, remote, fifoPath, 'SMB3');
      } catch (error) {
        lastError = error;
      }
    }
    const message = this.formatLinuxSmbError(lastError);
    const shareHint = shares.length > 0 ? ` Shares on this server: ${shares.join(', ')}.` : '';
    throw new Error(`${message}${shareHint}`);
  }

  /** Open a file on the share for ranged reads. Does not copy the file onto this server. */
  async openPlayback(auth: SmbAuth, remoteFile: string): Promise<SmbPlayback> {
    const remote = remoteFile.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\//g, '\\');
    if (!remote || remote.split('\\').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('That file path is not allowed.');
    }
    const attempts = this.authAttempts(auth);
    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        return await this.openOnShare(attempt, remote);
      } catch (error) {
        lastError = error;
      }
    }
    const shares = await this.listDiskShares(attempts[0] ?? auth).catch(() => [] as string[]);
    const known = auth.share.trim().toLowerCase();
    for (const share of shares) {
      if (share.toLowerCase() === known) continue;
      try {
        return await this.openOnShare({ ...(attempts[0] ?? auth), share }, remote);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(this.formatLinuxSmbError(lastError));
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
        sizeBytes: parsed.sizeBytes,
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
    const attempts = this.authAttempts(auth);
    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        return await this.execSmbclient(attempt, command, remotePath, 'SMB3');
      } catch (error) {
        lastError = error;
        const raw = this.execText(error);
        if (this.isUnreachable(raw)) break;
        if (/protocol|CONNECTION_DISCONNECTED|INVALID_NETWORK_RESPONSE/i.test(raw)) {
          try {
            return await this.execSmbclient(attempt, command, remotePath, 'SMB2');
          } catch (smb2Error) {
            lastError = smb2Error;
          }
        }
        if (!/LOGON_FAILURE|BAD_NETWORK_NAME|ACCESS_DENIED/i.test(raw)) break;
      }
    }

    const shares = await this.listDiskShares(attempts[0] ?? auth).catch(() => [] as string[]);
    const wanted = auth.share.trim();
    const only = shares.length === 1 ? shares[0] : undefined;
    if (only && only.toLowerCase() !== wanted.toLowerCase()) {
      try {
        return await this.execSmbclient(
          { ...auth, share: only },
          command,
          remotePath,
          'SMB3',
        );
      } catch (error) {
        lastError = error;
      }
    }

    const message = this.formatLinuxSmbError(lastError);
    const shareHint =
      shares.length > 0
        ? ` Shares on this server: ${shares.join(', ')}.`
        : '';
    this.logger.warn(`Samba list failed for //${auth.host}/${auth.share}: ${message}`);
    throw new Error(`${message}${shareHint}`);
  }

  private authAttempts(auth: SmbAuth): SmbAuth[] {
    const parsed = this.parseUsername(auth.username, auth.domain);
    const hostLabel = auth.host.includes('.') ? auth.host.split('.')[0] || auth.host : auth.host;
    const domains = [parsed.domain, '', hostLabel, auth.host];
    const seen = new Set<string>();
    const attempts: SmbAuth[] = [];
    for (const domain of domains) {
      const key = `${domain.toUpperCase()}|${parsed.username}`;
      if (seen.has(key)) continue;
      seen.add(key);
      attempts.push({ ...auth, username: parsed.username, domain });
      if (attempts.length >= 4) break;
    }
    return attempts;
  }

  private parseUsername(username: string, domain?: string): { username: string; domain: string } {
    const trimmed = username.trim();
    const stored = (domain ?? '').trim();
    const slash = trimmed.indexOf('\\');
    if (slash > 0) {
      return { domain: trimmed.slice(0, slash).trim(), username: trimmed.slice(slash + 1).trim() };
    }
    return {
      username: trimmed,
      domain: !stored || stored === '.' || stored.toUpperCase() === 'WORKGROUP' ? '' : stored,
    };
  }

  private async execSmbclient(
    auth: SmbAuth,
    command: string,
    remotePath: string,
    protocol: 'SMB2' | 'SMB3',
  ): Promise<string> {
    const share = auth.share.trim().replace(/^[\\/]+|[\\/]+$/g, '');
    const args = [
      `//${auth.host}/${share}`,
      '-U',
      this.linuxUser(auth),
      `--password=${auth.password}`,
      '-p',
      String(auth.port ?? 445),
      '-m',
      protocol,
    ];
    const domain = (auth.domain ?? '').trim();
    if (domain && domain !== '.' && domain.toUpperCase() !== 'WORKGROUP') {
      args.push('-W', domain);
    }
    const cleaned = remotePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (cleaned) args.push('-D', cleaned);
    args.push('-c', command);
    const { stdout } = await execFileAsync('smbclient', args, {
      timeout: 20_000,
      maxBuffer: 4_000_000,
    });
    return stdout;
  }

  private async openGetStream(
    auth: SmbAuth,
    remoteFile: string,
    fifoPath: string,
    protocol: 'SMB2' | 'SMB3',
  ): Promise<SmbIncoming> {
    if (constants.O_NONBLOCK == null) {
      throw new Error('Video streaming is available on the website server.');
    }
    const handle = await open(fifoPath, constants.O_RDONLY | constants.O_NONBLOCK);
    const child = this.spawnGetProcess(auth, remoteFile, fifoPath, protocol);
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await handle.close().catch(() => undefined);
    };
    try {
      const first = await this.readFirstByte(handle, child);
      return {
        process: child,
        first,
        read: () => this.readChunk(handle, child),
        close,
      };
    } catch (error) {
      if (child.exitCode == null && !child.killed) child.kill('SIGKILL');
      await close();
      throw error;
    }
  }

  private async readFirstByte(handle: FileHandle, child: ChildProcess): Promise<Buffer> {
    let stderr = '';
    let failed: Error | null = null;
    const onStderr = (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-2000);
      if (/NT_STATUS_(?!OK\b)|LOGON_FAILURE|ACCESS_DENIED/i.test(stderr)) {
        failed = new Error(this.formatLinuxSmbError(stderr));
      }
    };
    const onClose = () => {
      if (!failed) failed = new Error(this.formatLinuxSmbError(stderr || 'The video could not be opened.'));
    };
    child.stderr?.on('data', onStderr);
    child.on('close', onClose);
    const started = Date.now();
    try {
      while (Date.now() - started < 20_000) {
        if (failed) throw failed;
        const chunk = await this.readChunk(handle, child);
        if (chunk === null) {
          throw new Error(this.formatLinuxSmbError(stderr || 'The video could not be opened.'));
        }
        if (chunk.length > 0) return chunk;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      throw new Error(this.formatLinuxSmbError(stderr || 'The storage server did not send the video.'));
    } finally {
      child.stderr?.off('data', onStderr);
      child.off('close', onClose);
    }
  }

  /** Bytes from the fifo. An empty buffer means nothing new is waiting. Null means the sender finished. */
  private async readChunk(handle: FileHandle, child: ChildProcess): Promise<Buffer | null> {
    const buf = Buffer.alloc(256 * 1024);
    try {
      const { bytesRead } = await handle.read(buf, 0, buf.length, null);
      if (bytesRead === 0) {
        if (child.exitCode == null && !child.killed) return Buffer.alloc(0);
        return null;
      }
      return Buffer.from(buf.subarray(0, bytesRead));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EAGAIN' || code === 'EWOULDBLOCK') return Buffer.alloc(0);
      throw error;
    }
  }

  private spawnGetProcess(
    auth: SmbAuth,
    remoteFile: string,
    localFile: string,
    protocol: 'SMB2' | 'SMB3',
  ): ChildProcess {
    const share = auth.share.trim().replace(/^[\\/]+|[\\/]+$/g, '');
    const args = [
      `//${auth.host}/${share}`,
      '-U',
      this.linuxUser(auth),
      `--password=${auth.password}`,
      '-p',
      String(auth.port ?? 445),
      '-m',
      protocol,
    ];
    const domain = (auth.domain ?? '').trim();
    if (domain && domain !== '.' && domain.toUpperCase() !== 'WORKGROUP') {
      args.push('-W', domain);
    }
    args.push('-c', `get "${remoteFile}" "${localFile}"`);
    return spawn('smbclient', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  }

  private spawnGet(
    auth: SmbAuth,
    remoteFile: string,
    localFile: string,
    protocol: 'SMB2' | 'SMB3',
  ): Promise<void> {
    const share = auth.share.trim().replace(/^[\\/]+|[\\/]+$/g, '');
    const args = [
      `//${auth.host}/${share}`,
      '-U',
      this.linuxUser(auth),
      `--password=${auth.password}`,
      '-p',
      String(auth.port ?? 445),
      '-m',
      protocol,
    ];
    const domain = (auth.domain ?? '').trim();
    if (domain && domain !== '.' && domain.toUpperCase() !== 'WORKGROUP') {
      args.push('-W', domain);
    }
    args.push('-c', `get "${remoteFile}" "${localFile}"`);
    return new Promise((resolve, reject) => {
      const child = spawn('smbclient', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      const collect = (chunk: Buffer) => {
        output = `${output}${chunk.toString('utf8')}`.slice(-4000);
      };
      child.stdout?.on('data', collect);
      child.stderr?.on('data', collect);
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(output || `smbclient exited ${code ?? 'unknown'}`));
      });
    });
  }

  private linuxUser(auth: SmbAuth): string {
    const domain = (auth.domain ?? '').trim();
    if (domain && domain !== '.' && domain.toUpperCase() !== 'WORKGROUP') {
      return `${domain}/${auth.username}`;
    }
    return auth.username;
  }

  listShareNames(auth: SmbAuth): Promise<string[]> {
    return this.listDiskShares(auth);
  }

  private async listDiskShares(auth: SmbAuth): Promise<string[]> {
    const args = [
      '-L',
      auth.host,
      '-U',
      this.linuxUser(auth),
      `--password=${auth.password}`,
      '-p',
      String(auth.port ?? 445),
      '-m',
      'SMB3',
    ];
    const domain = (auth.domain ?? '').trim();
    if (domain && domain !== '.' && domain.toUpperCase() !== 'WORKGROUP') {
      args.push('-W', domain);
    }
    const { stdout } = await execFileAsync('smbclient', args, {
      timeout: 15_000,
      maxBuffer: 1_000_000,
    });
    const names: string[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/^\s*(.+?)\s{2,}Disk\b/i);
      const name = match?.[1]?.trim();
      if (!name || name === 'Sharename' || name === '---------' || name.endsWith('$')) continue;
      names.push(name);
    }
    return names;
  }

  private isUnreachable(raw: string): boolean {
    return /ETIMEDOUT|timed out|EHOSTUNREACH|ENETUNREACH|ECONNREFUSED|Connection refused|HOST_UNREACHABLE|IO_TIMEOUT|CONNECTION_REFUSED/i.test(
      raw,
    );
  }

  /** smbclient `ls` lines are not grepable; `-g` does not apply to directory listings. */
  private parseSmbclientLsLine(
    line: string,
  ): { name: string; isDirectory: boolean; sizeBytes: number } | null {
    if (/blocks of size|blocks available|^Domain=\[/i.test(line)) return null;
    const human = line.match(
      /^\s{2}(.+?)\s+([ADHSRN]+)\s+(\d+)\s+\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}\s*$/,
    );
    const name = human?.[1]?.trim();
    const modes = human?.[2];
    const size = Number(human?.[3]);
    if (!name || !modes) return null;
    return {
      name,
      isDirectory: modes.includes('D'),
      sizeBytes: Number.isFinite(size) ? size : 0,
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
      return 'Share name was not found. Use the share name shown by the storage server, not the Windows drive label.';
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
    return value
      .replace(/--password=\S+/gi, '--password=***')
      .replace(/password=[^\s]+/gi, 'password=***');
  }

  private async openOnShare(auth: SmbAuth, remoteFile: string): Promise<SmbPlayback> {
    const client = await this.createStreamClient(auth);
    try {
      const opened = await this.promiseTimeout(
        client.createReadStream(remoteFile, { start: 0, end: 0 }),
        8_000,
        'Timed out opening the video on the storage server.',
      );
      const size = opened.fileSize ?? 0;
      opened.destroy();
      if (!Number.isFinite(size) || size <= 0) {
        client.disconnect();
        throw new Error('The video file is empty.');
      }
      return {
        size,
        read: (start, end) => {
          const from = Math.max(0, Math.floor(start));
          const to = Math.max(from, Math.floor(end));
          return client.createReadStream(remoteFile, { start: from, end: to });
        },
        close: () => {
          try {
            client.disconnect();
          } catch {
            /* already closed */
          }
        },
      };
    } catch (error) {
      try {
        client.disconnect();
      } catch {
        /* already closed */
      }
      throw error;
    }
  }

  private promiseTimeout<T>(work: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      work.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(message));
        },
      );
    });
  }

  private async createStreamClient(auth: SmbAuth): Promise<SmbStreamClient> {
    const SMB2 = await this.loadSmb2();
    const domain = auth.domain?.trim() ? auth.domain.trim() : 'WORKGROUP';
    const client = new SMB2({
      share: `\\\\${auth.host}\\${auth.share.trim()}`,
      domain: domain || '.',
      username: auth.username,
      password: auth.password,
      port: auth.port ?? 445,
      autoCloseTimeout: 0,
      packetConcurrency: 8,
    }) as unknown as SmbStreamClient & {
      socket?: { setTimeout: (ms: number) => void; destroy: () => void; on: (event: string, cb: () => void) => void };
    };
    client.socket?.setTimeout(8_000);
    client.socket?.on('timeout', () => client.socket?.destroy());
    return client;
  }

  private async loadSmb2(): Promise<
    new (options: {
      share: string;
      domain: string;
      username: string;
      password: string;
      port?: number;
      autoCloseTimeout?: number;
      packetConcurrency?: number;
    }) => SmbStreamClient
  > {
    try {
      const mod = (await import('@marsaud/smb2')) as unknown as {
        default?: new (options: {
          share: string;
          domain: string;
          username: string;
          password: string;
          port?: number;
          autoCloseTimeout?: number;
          packetConcurrency?: number;
        }) => SmbStreamClient;
      };
      if (!mod.default) throw new Error('Samba client module did not export a constructor.');
      return mod.default;
    } catch (error) {
      if (error instanceof Error && /did not export/.test(error.message)) throw error;
      throw new Error('Samba client is not installed. Run pnpm --filter @uniqbd/api add @marsaud/smb2');
    }
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
          sizeBytes: null,
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
