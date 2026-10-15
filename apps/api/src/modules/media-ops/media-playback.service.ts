import { ChildProcess, spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, rm, stat, unlink, writeFile } from 'fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { tmpdir } from 'os';
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
import { SmbAuth, SmbClientService, SmbListedEntry, type SmbIncoming, type SmbPlayback } from './smb-client.service';
import { SmbMountService } from './smb-mount.service';

const VIDEO_EXT = new Set(['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts', '.m2ts', '.webm', '.mpg', '.mpeg']);
const TEXT_SUBS = new Set(['subrip', 'ass', 'ssa', 'mov_text', 'webvtt', 'text', 'srt']);
const CACHE_LIMIT_BYTES = 20 * 1024 * 1024 * 1024;
/** MPEG-TS HLS parts use .m2ts so nginx ".ts source file" deny rules cannot block playback. */
const HLS_SEGMENT_SUFFIX = '.m2ts';
const HLS_SEGMENT_NAME = /^seg\d{5}\.(?:m2ts|ts|m4s)$/i;
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
  smbServerId: string | null;
  auth: SmbAuth | null;
  episodes: EpisodeFile[];
  episodeIndex: number;
  audioTracks: AudioTrack[];
  audioIndex: number;
  subtitles: SubtitleTrack[];
  quality: PlaybackQuality;
  startSeconds: number;
  durationSeconds: number;
  runtimeSeconds: number;
  videoCodec: string;
  width: number;
  height: number;
  fileSize: number | null;
  downloaded: number;
  status: 'preparing' | 'ready' | 'error';
  message: string;
  complete: boolean;
  dir: string;
  sourceFile: string | null;
  captions: Map<string, string>;
  cacheName: string | null;
  remote: SmbPlayback | null;
  incoming: SmbIncoming | null;
  ffmpeg: ChildProcess | null;
  touchedAt: number;
};

@Injectable()
export class MediaPlaybackService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaPlaybackService.name);
  private readonly sessions = new Map<string, Session>();
  private sweepTimer: NodeJS.Timeout | null = null;
  private mediaServer: Server | null = null;
  private mediaPort = 0;

  constructor(
    @InjectModel(CatalogTitle.name)
    private readonly titles: Model<CatalogTitleDocument>,
    @InjectModel(MediaLibrary.name)
    private readonly libraries: Model<MediaLibraryDocument>,
    @InjectModel(SmbServer.name)
    private readonly servers: Model<SmbServerDocument>,
    private readonly crypto: CryptoService,
    private readonly smb: SmbClientService,
    private readonly mounts: SmbMountService,
  ) {}

  onModuleInit() {
    this.mediaServer = createServer((req, res) => {
      void this.serveRemote(req, res);
    });
    this.mediaServer.listen(0, '127.0.0.1');
    this.sweepTimer = setInterval(() => void this.sweep(), 10 * 60 * 1000);
    this.sweepTimer.unref?.();
    void this.removePlaybackPacks();
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const session of this.sessions.values()) {
      this.stopFfmpeg(session);
      session.remote?.close();
    }
    this.mediaServer?.close();
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

  /** Phone HLS lives in RAM, not under uploads, and is removed when playback stops. */
  async mobilePlaylist(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session?.sourceFile || session.status !== 'ready') throw new NotFoundException();
    session.touchedAt = Date.now();
    if (!session.dir) session.dir = this.mobilePackDir(session.id);
    await mkdir(session.dir, { recursive: true });
    const playlist = join(session.dir, 'index.m3u8');
    if (!session.ffmpeg && !existsSync(playlist)) {
      await this.packMobile(session, session.sourceFile, session.token);
    }
    return this.playlistForServe(sessionId);
  }

  captionText(sessionId: string, name: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.touchedAt = Date.now();
    return session.captions.get(name) ?? null;
  }

  /** Stream the original file to the browser. Nothing is written under uploads. */
  beginStream(sessionId: string): ChildProcess {
    const session = this.sessions.get(sessionId);
    if (!session?.sourceFile || session.status !== 'ready') throw new NotFoundException();
    session.touchedAt = Date.now();
    this.stopFfmpeg(session);
    const audio = session.audioTracks[session.audioIndex];
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      ...this.ffmpegInputArgs(session.sourceFile, false, session.startSeconds),
      '-map', '0:v:0',
      '-map', `0:a:${session.audioIndex}?`,
      '-sn', '-dn',
      ...this.progressiveArgs(session, audio?.codec ?? ''),
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1',
    ];
    const child = spawn(this.bin('ffmpeg'), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    session.ffmpeg = child;
    if (child.pid && process.platform === 'linux') {
      spawn('renice', ['-n', '10', '-p', String(child.pid)], { stdio: 'ignore' }).on('error', () => undefined);
    }
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-2000);
    });
    child.on('close', (code) => {
      if (session.ffmpeg === child) session.ffmpeg = null;
      if (code && code !== 0) this.logger.warn(`playback stream ended ${code}: ${stderr.slice(0, 400)}`);
    });
    child.on('error', (error) => {
      if (session.ffmpeg === child) session.ffmpeg = null;
      this.logger.warn(`playback stream failed: ${error.message}`);
    });
    return child;
  }

  /** Growing EVENT playlists may list segments before the file exists; drop missing entries and bust segment cache on pack restart. */
  async playlistForServe(sessionId: string): Promise<string> {
    const resolved = this.resolvePack(sessionId);
    if (!resolved) throw new NotFoundException();
    const { session, dir } = resolved;
    const playlist = join(dir, 'index.m3u8');
    const root = resolve(dir);
    if (!playlist.startsWith(root + sep) && playlist !== root) throw new NotFoundException();
    if (!existsSync(playlist)) throw new NotFoundException();
    if (session) session.touchedAt = Date.now();
    const raw = await readFile(playlist, 'utf8');
    const gen = session?.token ?? 1;
    const lines = raw.split(/\r?\n/);
    const out: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^#EXT-X-MAP:/i.test(trimmed)) {
        out.push(trimmed.replace(/init\.mp4/gi, `init.mp4?g=${gen}`));
        continue;
      }
      if (HLS_SEGMENT_NAME.test(trimmed)) {
        const full = join(dir, trimmed);
        if (!existsSync(full)) {
          const prev = out[out.length - 1];
          if (prev?.startsWith('#EXTINF')) out.pop();
          continue;
        }
        out.push(`${trimmed}?g=${gen}`);
        continue;
      }
      out.push(line);
    }
    return out.join('\n');
  }

  openFile(sessionId: string, name: string): { path: string; type: string } {
    const baseName = decodeURIComponent(name.split('?')[0]?.split('#')[0] ?? name);
    if (!/^(index\.m3u8|init\.mp4|seg\d{5}\.(?:m2ts|ts|m4s)|captions-\d+\.vtt)$/.test(baseName)) throw new NotFoundException();
    const resolved = this.resolvePack(sessionId);
    if (!resolved) throw new NotFoundException();
    const { session, dir } = resolved;
    const full = join(dir, baseName);
    const root = resolve(dir);
    if (!full.startsWith(root + sep) && full !== root) throw new NotFoundException();
    if (!existsSync(full)) throw new NotFoundException();
    if (session) session.touchedAt = Date.now();
    const type = baseName.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : baseName.endsWith('.vtt')
        ? 'text/vtt; charset=utf-8'
        : baseName.endsWith('.m4s') || baseName === 'init.mp4'
          ? 'video/mp4'
          : 'video/MP2T';
    return { path: full, type };
  }

  /** Phone pieces stay in RAM. They are not written into the website uploads folder. */
  private mobilePackDir(sessionId: string): string {
    const ram = '/dev/shm';
    const root = existsSync(ram) ? join(ram, 'uniqbd-mobile-hls') : join(tmpdir(), 'uniqbd-mobile-hls');
    return join(root, sessionId);
  }

  private packRoots(): string[] {
    const roots = [resolve(join(resolveUploadsRoot(), 'hls-pack'))];
    const ram = '/dev/shm';
    if (existsSync(ram)) roots.push(resolve(join(ram, 'uniqbd-mobile-hls')));
    roots.push(resolve(join(tmpdir(), 'uniqbd-mobile-hls')));
    return roots;
  }

  /** In-memory session or pack dir (same id) so segment GETs survive brief API restarts. */
  private resolvePack(sessionId: string): { session: Session | null; dir: string } | null {
    if (!/^[a-f0-9]{32}$/.test(sessionId)) return null;
    const session = this.sessions.get(sessionId) ?? null;
    const dir = session?.dir ?? join(resolveUploadsRoot(), 'hls-pack', sessionId);
    const resolved = resolve(dir);
    const allowed = this.packRoots().some((root) => resolved === root || resolved.startsWith(root + sep));
    if (!allowed) return null;
    if (!existsSync(resolved)) return null;
    return { session, dir: resolved };
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
        share: server.share || library.smbShare || '',
      };
    }

    const episodes = await this.listEpisodes(library, auth, relative, title.videoFileName ?? null);
    if (episodes.length === 0) throw new NotFoundException('No video file was found for this title.');
    const episodeIndex = Math.min(Math.max(Math.floor(request.episodeIndex ?? 0), 0), episodes.length - 1);
    const id = randomBytes(16).toString('hex');
    return {
      id,
      token: 1,
      titleId,
      title: title.title,
      year: title.year,
      kind: title.kind,
      provider: library.provider,
      rootPath: library.rootPath,
      smbServerId: library.smbServerId ? String(library.smbServerId) : null,
      auth,
      episodes,
      episodeIndex,
      audioTracks: [],
      audioIndex: Math.max(0, Math.floor(request.audioIndex ?? 0)),
      subtitles: [],
      quality: request.quality ?? 'auto',
      startSeconds: Math.max(0, request.startSeconds ?? 0),
      durationSeconds: (title.runtimeMinutes ?? 0) > 0 ? (title.runtimeMinutes ?? 0) * 60 : 0,
      runtimeSeconds: (title.runtimeMinutes ?? 0) > 0 ? (title.runtimeMinutes ?? 0) * 60 : 0,
      videoCodec: '',
      width: 0,
      height: 0,
      fileSize: episodes[episodeIndex]?.sizeBytes ?? title.videoFileSizeBytes ?? null,
      downloaded: 0,
      status: 'preparing',
      message: 'Starting playback…',
      complete: false,
      dir: '',
      sourceFile: null,
      captions: new Map(),
      cacheName: null,
      remote: null,
      incoming: null,
      ffmpeg: null,
      touchedAt: Date.now(),
    };
  }

  private async materialize(session: Session) {
    const token = session.token;
    try {
      session.message = 'Starting playback…';
      const file = await this.ensureLocalFile(session, token);
      if (session.token !== token) return;
      if (!session.incoming) await this.probe(session, file);
      if (session.token !== token) return;
      if (!session.incoming) {
        session.startSeconds = this.clampStart(session.startSeconds, session.durationSeconds);
      } else {
        session.startSeconds = 0;
        if (!session.durationSeconds) session.durationSeconds = session.runtimeSeconds;
      }
      session.sourceFile = file;
      if (!session.incoming) void this.extractCaptions(session, file, token);
      if (session.token !== token) return;
      session.status = 'ready';
      session.message = '';
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
    if (!session.auth || !session.smbServerId) throw new Error('This library is not connected to storage.');
    session.message = 'Starting playback…';
    session.remote?.close();
    session.remote = null;
    this.stopIncoming(session);
    const full = await this.mounts.filePath(session.smbServerId, session.auth, episode.remotePath);
    if (session.token !== token) return full;
    return full;
  }

  private async serveRemote(req: IncomingMessage, res: ServerResponse) {
    const id = (req.url ?? '').split('?')[0]?.replace(/^\//, '') ?? '';
    const remote = id ? this.sessions.get(id)?.remote : null;
    if (!remote) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const size = remote.size;
    const range = req.headers.range;
    let start = 0;
    let end = Math.max(0, size - 1);
    if (range?.startsWith('bytes=')) {
      const piece = range.slice('bytes='.length).split(',')[0] ?? '';
      const [rawStart, rawEnd] = piece.split('-');
      if (!rawStart) {
        const suffix = Number(rawEnd);
        if (Number.isFinite(suffix)) start = Math.max(0, size - suffix);
      } else {
        start = Number(rawStart);
        if (rawEnd) end = Number(rawEnd);
      }
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${size}`);
      res.end();
      return;
    }
    end = Math.min(end, size - 1);
    res.statusCode = range ? 206 : 200;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(end - start + 1));
    if (range) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    try {
      const stream = await remote.read(start, end);
      req.on('close', () => {
        if (!res.writableEnded) stream.destroy();
      });
      stream.on('error', () => {
        stream.destroy();
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
      stream.pipe(res);
    } catch (error) {
      this.logger.warn(`Storage read failed: ${error instanceof Error ? error.message : error}`);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  }

  private readyPort(): Promise<number> {
    if (this.mediaPort > 0) return Promise.resolve(this.mediaPort);
    const server = this.mediaServer;
    if (!server) return Promise.reject(new Error('Playback server is not running.'));
    if (server.listening) {
      const current = server.address();
      if (current && typeof current === 'object' && current.port) {
        this.mediaPort = current.port;
        return Promise.resolve(current.port);
      }
    }
    return new Promise((resolvePort, reject) => {
      const timer = setTimeout(() => reject(new Error('Playback server did not start.')), 5000);
      server.once('listening', () => {
        clearTimeout(timer);
        const address = server.address();
        const port = address && typeof address === 'object' ? address.port : 0;
        if (!port) {
          reject(new Error('Playback server did not start.'));
          return;
        }
        this.mediaPort = port;
        resolvePort(port);
      });
    });
  }

  private async cachedSize(file: string, expected: number | null): Promise<number | null> {
    try {
      const info = await stat(file);
      if (!expected || expected <= 0 || info.size + 4096 < expected) {
        if (info.size > 0) await unlink(file).catch(() => undefined);
        return null;
      }
      return info.size;
    } catch {
      return null;
    }
  }

  private isMatroskaPath(file: string): boolean {
    return /\.(mkv|webm)$/i.test((file.split('?')[0] ?? '').split(/[/\\]/).pop() ?? '');
  }

  private ffmpegInputArgs(file: string, streaming: boolean, startSeconds: number): string[] {
    const remote = file.startsWith('http://');
    const mkv = !streaming && this.isMatroskaPath(file);
    return [
      ...(!streaming && startSeconds > 0.5 ? ['-ss', startSeconds.toFixed(3)] : []),
      ...(remote ? ['-seekable', '1'] : []),
      '-probesize', mkv ? '32M' : '5M',
      '-analyzeduration', mkv ? '15M' : '2M',
      '-fflags', mkv ? '+genpts+igndts+discardcorrupt' : '+genpts+discardcorrupt',
      '-i', streaming ? 'pipe:0' : file,
    ];
  }

  private async probe(session: Session, file: string) {
    const mkv = this.isMatroskaPath(file);
    const raw = await this.runCapture(
      this.bin('ffprobe'),
      [
        '-v', 'error',
        ...(file.startsWith('http://') ? ['-seekable', '1'] : []),
        '-probesize', mkv ? '32M' : '5M',
        '-analyzeduration', mkv ? '15M' : '2M',
        '-show_entries', 'stream=codec_type,codec_name,width,height:stream_tags=language,title',
        '-show_entries', 'format=duration',
        '-of', 'json',
        file,
      ],
      mkv ? 90_000 : 30_000,
    );
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
    session.durationSeconds =
      Number.isFinite(duration) && duration > 0
        ? duration
        : session.durationSeconds > 0
          ? session.durationSeconds
          : session.runtimeSeconds;
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

  private async packMobile(session: Session, file: string, token: number) {
    const playlist = join(session.dir, 'index.m3u8');
    const segment = join(session.dir, 'seg%05d.m4s');
    const audio = session.audioTracks[session.audioIndex];
    const mkv = this.isMatroskaPath(file);
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      ...this.ffmpegInputArgs(file, false, session.startSeconds),
      '-map', '0:v:0',
      '-map', `0:a:${session.audioIndex}?`,
      '-sn', '-dn',
      '-muxdelay', '0',
      '-muxpreload', '0',
      ...(mkv ? ['-reset_timestamps', '1'] : []),
      ...this.progressiveArgs(session, audio?.codec ?? ''),
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '6',
      '-start_number', '0',
      '-hls_segment_type', 'fmp4',
      '-hls_fmp4_init_filename', 'init.mp4',
      '-hls_flags', 'delete_segments+independent_segments+omit_endlist+temp_file',
      '-avoid_negative_ts', 'make_zero',
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
    });
    child.on('error', (error) => {
      if (session.token !== token) return;
      if (session.ffmpeg === child) session.ffmpeg = null;
      this.logger.warn(`mobile playback failed: ${error.message}`);
    });
    const initReady = await this.waitForSegment(join(session.dir, 'init.mp4'), child, 90_000);
    const ready = initReady && await this.waitForSegment(join(session.dir, 'seg00000.m4s'), child, 90_000);
    if (session.token !== token) return;
    if (!ready || !existsSync(playlist)) {
      this.stopFfmpeg(session);
      this.logger.warn(`mobile ffmpeg produced no segment: ${stderr.slice(0, 400)}`);
      throw new Error(this.shortMediaError(stderr));
    }
  }

  private async pack(session: Session, file: string, token: number) {
    session.message = 'Starting playback…';
    session.complete = false;
    const playlist = join(session.dir, 'index.m3u8');
    const segment = join(session.dir, `seg%05d${HLS_SEGMENT_SUFFIX}`);
    const audio = session.audioTracks[session.audioIndex];
    const streaming = Boolean(session.incoming);
    const mkv = !streaming && this.isMatroskaPath(file);
    const codec = this.codecArgs(session, audio?.codec ?? '');
    const hlsFlags = codec.copyVideo
      ? 'omit_endlist+temp_file+split_by_time'
      : 'independent_segments+omit_endlist+temp_file';
    const args = [
      '-hide_banner', '-loglevel', 'error', ...(streaming ? [] : ['-nostdin']), '-y',
      ...this.ffmpegInputArgs(file, streaming, session.startSeconds),
      '-map', '0:v:0',
      '-map', `0:a:${session.audioIndex}?`,
      '-sn', '-dn',
      '-muxdelay', '0',
      '-muxpreload', '0',
      ...(mkv ? ['-reset_timestamps', '1'] : []),
      ...codec.args,
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_init_time', '2',
      '-hls_list_size', '0',
      '-start_number', '0',
      '-hls_playlist_type', 'event',
      '-hls_flags', hlsFlags,
      '-avoid_negative_ts', 'make_zero',
      '-hls_segment_filename', segment,
      playlist,
    ];
    const child = spawn(this.bin('ffmpeg'), args, { stdio: [streaming ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    session.ffmpeg = child;
    if (streaming) this.feedFfmpeg(session, child);
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
    const ready = await this.waitForSegment(join(session.dir, `seg00000${HLS_SEGMENT_SUFFIX}`), child, 90_000);
    if (session.token !== token) return;
    if (!ready || !existsSync(playlist)) {
      this.stopFfmpeg(session);
      this.logger.warn(`ffmpeg produced no segment: ${stderr.slice(0, 400)}`);
      throw new Error(this.shortMediaError(stderr));
    }
    session.status = 'ready';
    session.message = '';
  }

  /** In-memory remux. Video is copied. Audio is AAC only when it is not already AAC/MP3. */
  private progressiveArgs(session: Session, audioCodec: string): string[] {
    const codec = session.videoCodec.toLowerCase();
    const hevc = codec === 'hevc' || codec === 'h265' || codec === 'hev1' || codec === 'hvc1';
    const video = hevc ? ['-c:v', 'copy', '-tag:v', 'hvc1'] : ['-c:v', 'copy'];
    const audio =
      audioCodec === 'aac' || audioCodec === 'mp3'
        ? ['-c:a', 'copy']
        : ['-c:a', 'aac', '-ac', '2', '-b:a', '192k', '-ar', '48000', '-af', 'aresample=async=1:first_pts=0'];
    return [...video, ...audio, '-max_muxing_queue_size', '9999'];
  }

  /** Direct stream: never re-encode video. Audio becomes AAC only when it is not already AAC/MP3. */
  private codecArgs(
    session: Session,
    audioCodec: string,
  ): { args: string[]; copyVideo: boolean } {
    const codec = session.videoCodec.toLowerCase();
    const hevc = codec === 'hevc' || codec === 'h265' || codec === 'hev1' || codec === 'hvc1';
    const h264 = codec === 'h264' || codec === 'avc' || codec === 'avc1';
    const video = hevc || !h264
      ? ['-c:v', 'copy']
      : ['-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb'];
    const audio =
      audioCodec === 'aac'
        ? ['-c:a', 'copy', '-bsf:a', 'aac_adtstoasc']
        : audioCodec === 'mp3'
          ? ['-c:a', 'copy']
          : ['-c:a', 'aac', '-ac', '2', '-b:a', '192k', '-ar', '48000', '-af', 'aresample=async=1:first_pts=0'];
    return { copyVideo: true, args: [...video, ...audio] };
  }

  private async extractCaptions(session: Session, file: string, token: number) {
    for (const track of session.subtitles) {
      if (session.token !== token) return;
      const name = `captions-${track.index}.vtt`;
      try {
        const vtt = await this.runCapture(this.bin('ffmpeg'), [
          '-hide_banner', '-loglevel', 'error',
          '-i', file,
          '-map', `0:s:${track.index}`,
          '-f', 'webvtt',
          'pipe:1',
        ], 90_000);
        if (session.token !== token) return;
        session.captions.set(name, vtt);
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
      playlistUrl: `/api/media/playback/sessions/${session.id}/media.mp4`,
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
    if (!session.dir) return;
    const files = await readdir(session.dir).catch(() => [] as string[]);
    await Promise.all(
      files
        .filter((name) => name.endsWith('.m2ts') || name.endsWith('.ts') || name.endsWith('.m4s') || name === 'init.mp4' || name === 'index.m3u8')
        .map((name) => unlink(join(session.dir, name)).catch(() => undefined)),
    );
  }

  private async clearCaptions(session: Session) {
    session.captions.clear();
  }

  private feedFfmpeg(session: Session, child: ChildProcess) {
    const incoming = session.incoming;
    const stdin = child.stdin;
    if (!incoming || !stdin) return;
    const write = (chunk: Buffer) => new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        stdin.off('drain', onDrain);
        reject(error);
      };
      const onDrain = () => {
        stdin.off('error', onError);
        resolve();
      };
      stdin.once('error', onError);
      if (stdin.write(chunk)) {
        stdin.off('error', onError);
        resolve();
      } else stdin.once('drain', onDrain);
    });
    void (async () => {
      try {
        if (incoming.first.length > 0) await write(incoming.first);
        while (session.ffmpeg === child && session.incoming === incoming) {
          const chunk = await incoming.read();
          if (chunk === null) {
            stdin.end();
            return;
          }
          if (chunk.length === 0) {
            await new Promise((resolve) => setTimeout(resolve, 30));
            continue;
          }
          await write(chunk);
        }
      } catch {
        if (!stdin.destroyed) stdin.destroy();
      }
    })();
  }

  private stopIncoming(session: Session) {
    const incoming = session.incoming;
    session.incoming = null;
    if (!incoming) return;
    void incoming.close();
    if (incoming.process.exitCode == null && !incoming.process.killed) incoming.process.kill('SIGKILL');
  }

  private stopFfmpeg(session: Session) {
    this.stopIncoming(session);
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

  private async removePlaybackPacks() {
    const live = new Set(
      [...this.sessions.values()].map((session) => (session.dir ? resolve(session.dir) : '')).filter(Boolean),
    );
    for (const root of this.packRoots()) {
      const names = await readdir(root).catch(() => [] as string[]);
      await Promise.all(
        names.map(async (name) => {
          const full = resolve(join(root, name));
          if (live.has(full)) return;
          await rm(full, { recursive: true, force: true }).catch(() => undefined);
        }),
      );
    }
  }

  private async sweep() {
    await this.removePlaybackPacks();
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.touchedAt < 3 * 60 * 60 * 1000) continue;
      this.stopFfmpeg(session);
      session.remote?.close();
      session.remote = null;
      this.sessions.delete(id);
      if (session.dir) await rm(session.dir, { recursive: true, force: true }).catch(() => undefined);
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
    if (duration > 30 && safe > duration - 10) {
      return Math.max(0, Math.floor(duration - 10));
    }
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
