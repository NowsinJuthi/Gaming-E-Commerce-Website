import { execFile } from 'child_process';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { Injectable, Logger } from '@nestjs/common';
import { resolveUploadsRoot } from '../../shared/uploads/uploads-root';
import { SmbAuth, SmbClientService } from './smb-client.service';

const execFileAsync = promisify(execFile);
const HELPER = '/usr/local/bin/uniqbd-mount-smb';
const MOUNT_ID = /^[a-fA-F0-9]{24}(-[A-Za-z0-9._-]{1,64})?$/;

@Injectable()
export class SmbMountService {
  private readonly logger = new Logger(SmbMountService.name);

  constructor(private readonly smb: SmbClientService) {}

  /** Local path of a share file. The file stays on the Samba server. */
  async filePath(serverId: string, auth: SmbAuth, remoteFile: string): Promise<string> {
    const stored = auth.share.trim();
    const listed = await this.smb.listShareNames(auth).catch(() => [] as string[]);
    const names = listed.length
      ? [
          ...listed.filter((share) => share.toLowerCase() === stored.toLowerCase()),
          ...listed.filter((share) => share.toLowerCase() !== stored.toLowerCase()),
        ]
      : [stored];
    let last = 'The storage share could not be opened.';
    for (const share of names) {
      const slug = share.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40);
      const mountId = share.toLowerCase() === stored.toLowerCase() || !slug ? serverId : `${serverId}-${slug}`;
      try {
        const found = await this.mountedFile(mountId, { ...auth, share }, remoteFile);
        if (found) return found;
        last = 'The video file was not found on the storage share.';
      } catch (error) {
        last = error instanceof Error ? error.message : last;
      }
    }
    const hint = listed.length ? ` Shares on this server: ${listed.join(', ')}.` : '';
    throw new Error(`${last}${hint}`);
  }

  private async mountedFile(mountId: string, auth: SmbAuth, remoteFile: string): Promise<string | null> {
    if (!MOUNT_ID.test(mountId)) return null;
    const point = await this.ensureMounted(mountId, auth);
    const full = this.resolveFile(point, remoteFile);
    return existsSync(full) ? full : null;
  }

  private resolveFile(mountPoint: string, remoteFile: string): string {
    const parts = remoteFile.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) {
      throw new Error('That file path is not allowed.');
    }
    return join(mountPoint, ...parts);
  }

  private async ensureMounted(mountId: string, auth: SmbAuth): Promise<string> {
    const root = join(resolveUploadsRoot(), 'smb-mounts');
    const point = join(root, mountId);
    await mkdir(point, { recursive: true });
    if (await this.isMounted(point)) return point;
    const credDir = join(root, '.credentials');
    await mkdir(credDir, { recursive: true });
    const credFile = join(credDir, `${randomBytes(12).toString('hex')}.cred`);
    const domain = (auth.domain ?? '').trim() || 'WORKGROUP';
    await writeFile(
      credFile,
      `username=${auth.username}\npassword=${auth.password}\ndomain=${domain}\n`,
      { mode: 0o600 },
    );
    try {
      await execFileAsync(
        'sudo',
        ['-n', HELPER, mountId, auth.host, auth.share.trim(), credFile, root, String(auth.port ?? 445)],
        { timeout: 50_000 },
      );
      return point;
    } catch (error) {
      const message = this.mountError(error);
      this.logger.warn(`Samba mount failed for //${auth.host}/${auth.share}: ${message}`);
      throw new Error(message);
    } finally {
      await unlink(credFile).catch(() => undefined);
    }
  }

  private async isMounted(mountPoint: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('findmnt', ['-n', mountPoint], { timeout: 5_000 });
      return Boolean(String(stdout).trim());
    } catch {
      return false;
    }
  }

  private mountError(error: unknown): string {
    const err = error as { message?: string; stderr?: Buffer | string; stdout?: Buffer | string; code?: string };
    if (err?.code === 'ENOENT') {
      return 'Direct Samba playback is not installed yet. Run the mount helper install on the website server, then try again.';
    }
    const stderr = typeof err?.stderr === 'string' ? err.stderr : err?.stderr?.toString('utf8') ?? '';
    const stdout = typeof err?.stdout === 'string' ? err.stdout : err?.stdout?.toString('utf8') ?? '';
    const text = `${stderr}\n${stdout}\n${err?.message ?? ''}`;
    if (/a password is required|not allowed|NOPASSWD|sudo:/i.test(text)) {
      return 'Direct Samba playback is not installed yet. Run the mount helper install on the website server, then try again.';
    }
    const line = text
      .split('\n')
      .map((part) => part.trim())
      .find((part) => part && !/^Command failed:/i.test(part) && !/password=/i.test(part));
    return (line || 'The storage share could not be opened.').slice(0, 300);
  }
}
