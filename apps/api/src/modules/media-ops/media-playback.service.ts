import { ChildProcess, spawn } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'fs/promises';
import { join, resolve, sep } from 'path';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CatalogTitle, CatalogTitleDocument } from '../../database/schemas/catalog-title.schema';
import { MediaLibrary, MediaLibraryDocument } from '../../database/schemas/media-library.schema';
import { SmbServer, SmbServerDocument } from '../../database/schemas/smb-server.schema';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { resolveUploadsRoot } from '../../shared/uploads/uploads-root';
import { SmbAuth, SmbClientService, SmbListedEntry } from './smb-client.service';

const VIDEO_EXT = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts', '.m2ts', '.webm', '.mpg', '.mpeg']);
const TEXT_SUBS = new Set(['subrip', 'ass', 'ssa', 'mov_text', 'webvtt', 'text', 'srt']);
const CACHE_LIMIT_BYTES = 20 * 1024 * 1024 * 1024;
const QUALITIES = ['auto', '1080', '720', '480'] as const;

export type PlaybackQuality = (typeof QUALITIES)[number];

export type PlaybackRequest = {
  startSeconds?: number;
  episodeIndex?: number;
  audioIndex?: number;
  quality?: PlaybackQuality;
};

type EpisodeFile = {
  index: number;
  name: string;
  remotePath: string;
  sizeBytes: number | null;
};

type AudioTrack = { index: number; label: string; codec: string };
type SubtitleTrack = { index: number; label: string; url: string | null };

type Session = {
  id: string;
  token: number;
  titleId: string;
  title: string;
  year: number;
  kind: 'movie' | 'series';
  provider: 'local' | 'smb';
  rootPath: string;
  auth: SmbAuth | null;
  episodes: EpisodeFile[];
  episodeIndex: number;
  audioTracks: AudioTrack[];
  audioIndex: number;
  subtitles: SubtitleTrack[];
  quality: PlaybackQuality;
  startSeconds: number;
  durationSeconds: number;
  videoCodec: string;
  width: number;
  height: number;
  fileSize: number | null;
  downloaded: number;
  status: 'preparing' | 'ready' | 'error';
  message: string;
  complete: boolean;
  dir: string;
  cacheName: string | null;
  ffmpeg: ChildProcess | null;
  touchedAt: number;
};

@Injectable()
export class MediaPlaybackService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaPlaybackService.name);
  private readonly sessions = new Map<string, Session>();
  private readonly downloads = new Map<string, Promise<string>>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(CatalogTitle.name)
    private readonly titles: Model<CatalogTitleDocument>,
    @InjectModel(MediaLibrary.name)
    private readonly libraries: Model<MediaLibraryDocument>,
    @InjectModel(SmbServer.name)
    private readonly servers: Model<SmbServerDocument>,
    private readonly crypto: CryptoService,
    private readonly smb: SmbClientService,
  ) {}

  onModuleInit() {
    this.sweepTimer = setInterval(() => void this.sweep(), 10 * 60 * 1000);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const session of this.sessions.values()) this.stopFfmpeg(session);
  }

  async start(titleId: string, request: PlaybackRequest) {
    const session = await this.createSession(titleId, request);
    this.sessions.set(session.id, session);
    void this.materialize(session);
    return this.present(session);
  }

  async retarget(sessionId: string, request: PlaybackRequest) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('That playback session expired. Play the video again.');
    }
    const episodeChanged =
      request.episodeIndex != null && request.episodeIndex !== session.episodeIndex;
    session.startSeconds = this.clampStart(request.startSeconds ?? session.startSeconds, session.durationSeconds);
    if (request.quality) session.quality = request.quality;
    if (request.audioIndex != null) session.audioIndex = Math.max(0, Math.floor(request.audioIndex));
    if (episodeChanged && request.episodeIndex != null) {
      session.episodeIndex = Math.min(
        session.episodes.length - 1,
        Math.max(0, Math.floor(request.episodeIndex)),
      );
      session.audioTracks = [];
      session.audioIndex = 0;
      session.subtitles = [];
      session.durationSeconds = 0;
      session.videoCodec = '';
    }
    session.status = 'preparing';
    session.message = 'Starting playback…';
    session.complete = false;
    session.touchedAt = Date.now();
    session.token += 1;
    this.stopFfmpeg(session);
    await this.clearSegments(session);
    if (episodeChanged) await this.clearCaptions(session);
    void this.materialize(session);
    return this.present(session);
  }

  status(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException('That playback session expired. Play the video again.');
    session.touchedAt = Date.now();
    return this.present(session);
  }

  openFile(sessionId: string, name: string): { path: string; type: string } {
    if (!/^[a-f0-9]{32}$/.test(sessionId)) throw new NotFoundException();
    if (!/^(index\.m3u8|seg\d{5}\.ts|captions-\d+\.vtt)$/.test(name)) throw new NotFoundException();
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException();
    const full = join(session.dir, name);
    const root = resolve(session.dir);
    if (!full.startsWith(root + sep) && full !== root) throw new NotFoundException();
    if (!existsSync(full)) throw new NotFoundException();
    session.touchedAt = Date.now();
    const type = name.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : name.endsWith('.vtt')
        ? 'text/vtt; charset=utf-8'
        : 'video/MP2T';
    return { path: full, type };
  }

  private async createSession(titleId: string, request: PlaybackRequest): Promise<Session> {
    if (!Types.ObjectId.isValid(titleId)) throw new NotFoundException('That title was not found.');
    const title = await this.titles.findById(titleId).exec();
    if (!title || !title.published || title.availability !== 'available') {
      throw new NotFoundException('That title was not found.');
    }
    const source = title.sourceKey ?? '';
    const splitAt = source.indexOf(':');
    if (splitAt < 1) throw new NotFoundException('This title does not have a video file yet.');
    const libraryId = source.slice(0, splitAt);
    const relative = source.slice(splitAt + 1).replace(/\\/g, '/');
    if (!Types.ObjectId.isValid(libraryId) || !relative || relative.split('/').includes('..')) {
      throw new NotFoundException('This title does not have a video file yet.');
    }
    const library = await this.libraries.findById(libraryId).exec();
    if (!library || !library.enabled) throw new NotFoundException('This library is not available.');

    let auth: SmbAuth | null = null;
    if (library.provider === 'smb') {
      if (!library.smbServerId) throw new NotFoundException('This library is not connected to storage.');
      const server = await this.servers.findById(library.smbServerId).select('+passwordEnc').exec();
      if (!server) throw new NotFoundException('This library is not connected to storage.');
      let password = '';
      try {
        password = this.crypto.openInventoryValue(server.passwordEnc);
      } catch {
        throw new NotFoundException('Saved storage password could not be read.');
      }
      auth = {
        host: server.host,
        port: server.port,
        username: server.username,
        password,
        domain: server.domain,
        share: library.smbShare || server.share,
      };
    }

    const episodes = await this.listEpisodes(library, auth, relative, title.videoFileName ?? null);
    if (episodes.length === 0) throw new NotFoundException('No video file was found for this title.');
    const episodeIndex = Math.min(Math.max(Math.floor(request.episodeIndex ?? 0), 0), episodes.length - 1);
    const id = randomBytes(16).toString('hex');
    const dir = join(resolveUploadsRoot(), 'hls-pack', id);
    await mkdir(dir, { recursive: true });
    return {
      id,
      token: 1,
      titleId,
      title: title.title,
      year: title.year,
      kind: title.kind,
      provider: library.provider,
      rootPath: library.rootPath,
      auth,
      episodes,
      episodeIndex,
      audioTracks: [],
      audioIndex: Math.max(0, Math.floor(request.audioIndex ?? 0)),
      subtitles: [],
      quality: request.quality ?? 'auto',
      startSeconds: Math.max(0, request.startSeconds ?? 0),
      durationSeconds: 0,
      videoCodec: '',
      width: 0,
      height: 0,
      fileSize: episodes[episodeIndex]?.sizeBytes ?? title.videoFileSizeBytes ?? null,
      downloaded: 0,
      status: 'preparing',
      message: 'Opening the video…',
      complete: false,
      dir,
      cacheName: null,
      ffmpeg: null,
      touchedAt: Date.now(),
    };
  }

  private async materialize(session: Session) {
    const token = session.token;
    try {
      const file = await this.ensureLocalFile(session, token);
      if (session.token !== token) return;
      await this.probe(session, file);
      if (session.token !== token) return;
      session.startSeconds = this.clampStart(session.startSeconds, session.durationSeconds);
      await this.pack(session, file, token);
      if (session.token !== token) return;
      void this.extractCaptions(session, file, token);
    } catch (error) {
      if (session.token !== token) return;
      session.status = 'error';
      session.message = this.publicError(error);
      this.logger.warn(`Playback failed for ${session.titleId}: ${session.message}`);
    }
  }

  private async ensureLocalFile(session: Session, token: number): Promise<string> {
    const episode = session.episodes[session.episodeIndex];
    if (!episode) throw new Error('No video file was found for this title.');
    session.fileSize = episode.sizeBytes ?? session.fileSize;
    if (session.provider === 'local') {
      const full = this.localPath(session.rootPath, episode.remotePath);
      if (!existsSync(full)) throw new Error('The video file is not on this server.');
      return full;
    }
    if (!session.auth) throw new Error('This library is not connected to storage.');
    const cacheDir = join(resolveUploadsRoot(), 'playback-cache');
    await mkdir(cacheDir, { recursive: true });
    const cacheName = `${createHash('sha1').update(`${session.auth.host}|${session.auth.share}|${episode.remotePath}`).digest('hex')}.bin`;
    const finalPath = join(cacheDir, cacheName);
    const partPath = `${finalPath}.part`;
    session.cacheName = cacheName;
    const ready = await this.cachedSize(finalPath, episode.sizeBytes);
    if (ready) {
      session.downloaded = ready;
      return finalPath;
    }
    session.message = 'Copying the video from storage…';
    const job = this.downloads.get(finalPath) ?? this.startDownload(session.auth, episode.remotePath, partPath, finalPath);
    this.downloads.set(finalPath, job);
    const timer = setInterval(() => {
      if (session.token !== token) return;
      void stat(partPath)
        .then((info) => {
          session.downloaded = info.size;
          const total = session.fileSize ?? 0;
          const percent = total > 0 ? Math.min(99, Math.round((info.size / total) * 100)) : null;
          session.message = percent == null
            ? 'Copying the video from storage…'
            : `Copying the video from storage… ${percent}%`;
        })
        .catch(() => undefined);
    }, 700);
    try {
      await job;
    } finally {
      clearInterval(timer);
      if (this.downloads.get(finalPath) === job) this.downloads.delete(finalPath);
    }
    if (session.token !== token) return finalPath;
    const size = await this.cachedSize(finalPath, null);
    session.downloaded = size ?? session.fileSize ?? 0;
    void this.pruneCache(cacheDir);
    return finalPath;
  }

  private startDownload(auth: SmbAuth, remotePath: string, partPath: string, finalPath: string): Promise<string> {
    const job = (async () => {
      await rm(partPath, { force: true }).catch(() => undefined);
      await this.smb.downloadFile(auth, remotePath, partPath);
      await rename(partPath, finalPath);
      return finalPath;
    })().catch(async (error) => {
      await rm(partPath, { force: true }).catch(() => undefined);
      throw error;
    });
    return job;
  }

  private async cachedSize(file: string, expected: number | null): Promise<number | null> {
    try {
      const info = await stat(file);
      if (info.size < 1024) return null;
      if (expected && expected > 0 && info.size + 4096 < expected) return null;
      return info.size;
    } catch {
      return null;
    }
  }

  private async probe(session: Session, file: string) {
    const raw = await this.runCapture(this.bin('ffprobe'), [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,codec_name,width,height:stream_tags=language,title',
      '-show_entries', 'format=duration',
      '-of', 'json',
      file,
    ]);
    const parsed = JSON.parse(raw) as {
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        tags?: { language?: string; title?: string };
      }>;
      format?: { duration?: string };
    };
    const streams = parsed.streams ?? [];
    const video = streams.find((stream) => stream.codec_type === 'video');
    session.videoCodec = video?.codec_name ?? '';
    session.width = video?.width ?? 0;
    session.height = video?.height ?? 0;
    const duration = Number(parsed.format?.duration);
    session.durationSeconds = Number.isFinite(duration) ? duration : 0;
    let audioOrdinal = 0;
    session.audioTracks = streams
      .filter((stream) => stream.codec_type === 'audio')
      .map((stream) => {
        const label = stream.tags?.title || stream.tags?.language || `Audio ${audioOrdinal + 1}`;
        const track = { index: audioOrdinal, label, codec: stream.codec_name ?? '' };
        audioOrdinal += 1;
        return track;
      });
    if (session.audioIndex >= session.audioTracks.length) session.audioIndex = 0;
    let subtitleOrdinal = 0;
    session.subtitles = streams
      .filter((stream) => stream.codec_type === 'subtitle' && TEXT_SUBS.has(stream.codec_name ?? ''))
      .slice(0, 4)
      .map((stream) => {
        const label = stream.tags?.title || stream.tags?.language || `Subtitles ${subtitleOrdinal + 1}`;
        const track = { index: subtitleOrdinal, label, url: null as string | null };
        subtitleOrdinal += 1;
        return track;
      });
  }

  private async pack(session: Session, file: string, token: number) {
    session.message = 'Starting playback…';
    session.complete = false;
    const playlist = join(session.dir, 'index.m3u8');
    const segment = join(session.dir, 'seg%05d.ts');
    const audio = session.audioTracks[session.audioIndex];
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      ...(session.startSeconds > 0.5 ? ['-ss', session.startSeconds.toFixed(3)] : []),
      '-i', file,
      '-map', '0:v:0',
      '-map', `0:a:${session.audioIndex}?`,
      '-sn', '-dn',
      ...this.codecArgs(session, audio?.codec ?? ''),
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '0',
      '-hls_playlist_type', 'event',
      '-hls_flags', 'independent_segments+temp_file',
      '-hls_segment_filename', segment,
      playlist,
    ];
    const child = spawn(this.bin('ffmpeg'), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    session.ffmpeg = child;
    if (child.pid && process.platform === 'linux') {
      spawn('renice', ['-n', '10', '-p', String(child.pid)], { stdio: 'ignore' }).on('error', () => undefined);
    }
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-2000);
    });
    child.on('close', () => {
      if (session.ffmpeg === child) session.ffmpeg = null;
      if (session.token !== token) return;
      void this.finishPlaylist(session);
    });
    child.on('error', (error) => {
      if (session.token !== token) return;
      session.status = 'error';
      session.message = this.publicError(error);
    });
    const ready = await this.waitForSegment(join(session.dir, 'seg00000.ts'), child, 90_000);
    if (session.token !== token) return;
    if (!ready || !existsSync(playlist)) {
      this.stopFfmpeg(session);
      this.logger.warn(`ffmpeg produced no segment: ${stderr.slice(0, 400)}`);
      throw new Error(this.shortMediaError(stderr));
    }
    session.status = 'ready';
    session.message = '';
  }

  private codecArgs(session: Session, audioCodec: string): string[] {
    const height = session.quality === '1080' ? 1080 : session.quality === '480' ? 480 : session.quality === '720' ? 720 : 0;
    const copyVideo = session.videoCodec === 'h264' && height === 0;
    const copyAudio = audioCodec === 'aac' || audioCodec === 'mp3';
    if (copyVideo && copyAudio) {
      return audioCodec === 'aac'
        ? ['-c:v', 'copy', '-c:a', 'copy', '-bsf:a', 'aac_adtstoasc']
        : ['-c:v', 'copy', '-c:a', 'copy'];
    }
    if (copyVideo) {
      return ['-c:v', 'copy', '-c:a', 'aac', '-ac', '2', '-b:a', '160k', '-ar', '48000'];
    }
    const target = height || 720;
    return [
      '-vf', `scale=-2:min(${target}\\,ih)`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-ac', '2',
      '-b:a', '160k',
      '-ar', '48000',
    ];
  }

  private async extractCaptions(session: Session, file: string, token: number) {
    for (const track of session.subtitles) {
      if (session.token !== token) return;
      const name = `captions-${track.index}.vtt`;
      const output = join(session.dir, name);
      try {
        await this.runCapture(this.bin('ffmpeg'), [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', file,
          '-map', `0:s:${track.index}`,
          '-c:s', 'webvtt',
          output,
        ], 90_000);
        if (session.token !== token) return;
        track.url = `/api/media/playback/sessions/${session.id}/${name}`;
      } catch {
        track.url = null;
      }
    }
  }

  private async finishPlaylist(session: Session) {
    const playlist = join(session.dir, 'index.m3u8');
    try {
      const raw = await readFile(playlist, 'utf8');
      if (!raw.includes('#EXTM3U')) return;
      let next = raw.replace('#EXT-X-PLAYLIST-TYPE:EVENT', '#EXT-X-PLAYLIST-TYPE:VOD');
      if (!next.includes('#EXT-X-ENDLIST')) next = `${next.trimEnd()}\n#EXT-X-ENDLIST\n`;
      await writeFile(playlist, next);
      session.complete = true;
    } catch {
      /* playlist not written yet */
    }
  }

  private async listEpisodes(
    library: MediaLibraryDocument,
    auth: SmbAuth | null,
    relative: string,
    preferredName: string | null,
  ): Promise<EpisodeFile[]> {
    if (this.isVideo(relative)) {
      return [{ index: 0, name: this.displayName(relative), remotePath: relative, sizeBytes: null }];
    }
    const entries = await this.listPath(library, auth, relative);
    const videos: EpisodeFile[] = [];
    const folders = entries.filter((entry) => entry.isDirectory);
    for (const entry of entries) {
      if (!entry.isDirectory && this.isVideo(entry.name)) {
        videos.push({
          index: 0,
          name: this.displayName(entry.name),
          remotePath: entry.path.replace(/\\/g, '/'),
          sizeBytes: entry.sizeBytes,
        });
      }
    }
    if (videos.length === 0) {
      for (const folder of folders.slice(0, 40)) {
        const inner = await this.listPath(library, auth, folder.path).catch(() => [] as SmbListedEntry[]);
        for (const entry of inner) {
          if (entry.isDirectory || !this.isVideo(entry.name)) continue;
          videos.push({
            index: 0,
            name: `${folder.name} · ${this.displayName(entry.name)}`,
            remotePath: entry.path.replace(/\\/g, '/'),
            sizeBytes: entry.sizeBytes,
          });
        }
      }
    }
    videos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (preferredName) {
      const preferred = videos.findIndex((video) => video.remotePath.endsWith(`/${preferredName}`) || video.name === this.displayName(preferredName));
      if (preferred > 0) {
        const [match] = videos.splice(preferred, 1);
        if (match) videos.unshift(match);
      }
    }
    return videos.map((video, index) => ({ ...video, index }));
  }

  private async listPath(
    library: MediaLibraryDocument,
    auth: SmbAuth | null,
    remotePath: string,
  ): Promise<SmbListedEntry[]> {
    if (library.provider === 'smb') {
      if (!auth) return [];
      return this.smb.list(auth, remotePath);
    }
    return this.listLocal(library.rootPath, remotePath);
  }

  private async listLocal(rootPath: string, remotePath: string): Promise<SmbListedEntry[]> {
    const full = this.localPath(rootPath, remotePath);
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
        const info = await stat(join(full, dirent.name)).catch(() => null);
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

  private localPath(rootPath: string, relative: string): string {
    const root = resolve(rootPath);
    const full = resolve(root, relative);
    if (full !== root && !full.startsWith(root + sep)) {
      throw new Error('That file path is not allowed.');
    }
    return full;
  }

  private present(session: Session) {
    const episode = session.episodes[session.episodeIndex] ?? null;
    const total = session.fileSize ?? 0;
    const progress = total > 0 ? Math.max(0, Math.min(1, session.downloaded / total)) : null;
    return {
      sessionId: session.id,
      status: session.status,
      message: session.message,
      playlistUrl: `/api/media/playback/sessions/${session.id}/index.m3u8`,
      title: session.title,
      year: session.year,
      kind: session.kind,
      episodeName: episode?.name ?? null,
      durationSeconds: session.durationSeconds,
      startSeconds: session.startSeconds,
      quality: session.quality,
      audioIndex: session.audioIndex,
      episodeIndex: session.episodeIndex,
      complete: session.complete,
      progress,
      episodes: session.episodes.map((item) => ({ index: item.index, name: item.name })),
      audioTracks: session.audioTracks.map((track) => ({ index: track.index, label: track.label })),
      subtitles: session.subtitles
        .filter((track) => track.url)
        .map((track) => ({ index: track.index, label: track.label, url: track.url })),
    };
  }

  private async clearSegments(session: Session) {
    const files = await readdir(session.dir).catch(() => [] as string[]);
    await Promise.all(files.filter((name) => name.endsWith('.ts') || name === 'index.m3u8').map((name) => unlink(join(session.dir, name)).catch(() => undefined)));
  }

  private async clearCaptions(session: Session) {
    const files = await readdir(session.dir).catch(() => [] as string[]);
    await Promise.all(files.filter((name) => name.endsWith('.vtt')).map((name) => unlink(join(session.dir, name)).catch(() => undefined)));
  }

  private stopFfmpeg(session: Session) {
    const child = session.ffmpeg;
    session.ffmpeg = null;
    if (!child || child.killed) return;
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode == null) child.kill('SIGKILL');
    }, 1500).unref?.();
  }

  private async pruneCache(dir: string) {
    const names = await readdir(dir).catch(() => [] as string[]);
    const rows: { name: string; size: number; mtime: number }[] = [];
    for (const name of names) {
      if (!name.endsWith('.bin')) continue;
      const info = await stat(join(dir, name)).catch(() => null);
      if (!info) continue;
      rows.push({ name, size: info.size, mtime: info.mtimeMs });
    }
    let total = rows.reduce((sum, row) => sum + row.size, 0);
    rows.sort((a, b) => a.mtime - b.mtime);
    const inUse = new Set(
      [...this.sessions.values()].map((session) => session.cacheName).filter((name): name is string => Boolean(name)),
    );
    for (const row of rows) {
      if (total <= CACHE_LIMIT_BYTES) break;
      if (inUse.has(row.name)) continue;
      await unlink(join(dir, row.name)).catch(() => undefined);
      total -= row.size;
    }
  }

  private async sweep() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.touchedAt < 3 * 60 * 60 * 1000) continue;
      this.stopFfmpeg(session);
      this.sessions.delete(id);
      await rm(session.dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private waitForSegment(file: string, child: ChildProcess, timeoutMs: number): Promise<boolean> {
    const started = Date.now();
    return new Promise((resolvePromise) => {
      const timer = setInterval(() => {
        if (existsSync(file)) {
          clearInterval(timer);
          resolvePromise(true);
          return;
        }
        if (child.exitCode != null || Date.now() - started > timeoutMs) {
          clearInterval(timer);
          resolvePromise(false);
        }
      }, 300);
    });
  }

  private runCapture(command: string, args: string[], timeoutMs = 30_000): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const stdout: Buffer[] = [];
      let stderr = '';
      child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString('utf8')}`.slice(-2000);
      });
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('The video probe took too long.'));
      }, timeoutMs);
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolvePromise(Buffer.concat(stdout).toString('utf8'));
        else reject(new Error(stderr || `${command} exited ${code ?? 'unknown'}`));
      });
    });
  }

  private bin(name: 'ffmpeg' | 'ffprobe'): string {
    const env = name === 'ffmpeg' ? process.env.FFMPEG_PATH : process.env.FFPROBE_PATH;
    if (env?.trim()) return env.trim();
    const absolute = join('/usr/bin', name);
    return existsSync(absolute) ? absolute : name;
  }

  private publicError(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    return this.shortMediaError(message);
  }

  private shortMediaError(text: string): string {
    const cleaned = text.replace(/--password=\S+/gi, '--password=***').trim();
    if (this.isMissingBinary(cleaned)) {
      return 'ffmpeg is not installed on the website server.';
    }
    const line = cleaned
      .split('\n')
      .map((part) => part.trim())
      .find((part) => part && !/^ffmpeg version/i.test(part));
    return (line || 'The video could not be opened.').slice(0, 300);
  }

  private isMissingBinary(text: string): boolean {
    return /spawn (?:\/usr\/bin\/)?(?:ffmpeg|ffprobe) ENOENT/i.test(text);
  }

  private clampStart(value: number, duration: number): number {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    if (duration > 30 && safe > duration - 10) return 0;
    return safe;
  }

  private isVideo(name: string): boolean {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return false;
    return VIDEO_EXT.has(name.slice(dot).toLowerCase());
  }

  private displayName(name: string): string {
    const base = name.split('/').pop() ?? name;
    return base.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[._]+/g, ' ').trim() || base;
  }
}
