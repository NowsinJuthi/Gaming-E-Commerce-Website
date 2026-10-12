import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { resolveUploadsRoot } from '../../shared/uploads/uploads-root';

const TMDB_API = 'https://api.themoviedb.org';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';
const POSTER_WIDTH = 480;
const POSTER_HEIGHT = 720;
const POSTER_QUALITY = 68;

export type TmdbMatch = {
  title: string;
  year: number | null;
  posterUrl: string | null;
};

type SearchHit = {
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

@Injectable()
export class TmdbMetadataService {
  private readonly logger = new Logger(TmdbMetadataService.name);

  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return Boolean(this.apiKey());
  }

  async searchMovie(title: string, year?: number | null): Promise<TmdbMatch | null> {
    return this.search('movie', title, year);
  }

  async searchSeries(title: string, year?: number | null): Promise<TmdbMatch | null> {
    return this.search('tv', title, year);
  }

  private async search(kind: 'movie' | 'tv', title: string, year?: number | null): Promise<TmdbMatch | null> {
    const cleaned = title.trim();
    if (!this.enabled() || !cleaned) return null;
    const params = new URLSearchParams({
      api_key: this.apiKey(),
      query: cleaned,
      include_adult: 'false',
    });
    if (year) {
      params.set(kind === 'movie' ? 'year' : 'first_air_date_year', String(year));
    }
    const path = kind === 'movie' ? '/3/search/movie' : '/3/search/tv';
    const data = await this.getJson<{ results?: SearchHit[] }>(`${path}?${params.toString()}`);
    const hit = data?.results?.[0];
    const name = (kind === 'movie' ? hit?.title : hit?.name)?.trim();
    if (!hit || !name) {
      if (year) return this.search(kind, cleaned, null);
      return null;
    }
    const date = kind === 'movie' ? hit.release_date : hit.first_air_date;
    const parsedYear = date ? Number(date.slice(0, 4)) : null;
    const posterUrl = hit.poster_path ? await this.savePoster(hit.poster_path) : null;
    return {
      title: name,
      year: Number.isFinite(parsedYear) ? parsedYear : null,
      posterUrl,
    };
  }

  private async savePoster(posterPath: string): Promise<string | null> {
    const safe = posterPath.trim();
    if (!safe.startsWith('/') || safe.includes('..') || safe.includes('\\')) return null;
    const filename = `${createHash('sha1').update(safe).digest('hex').slice(0, 20)}.webp`;
    const dir = join(resolveUploadsRoot(), 'posters');
    const output = join(dir, filename);
    const prefix = (this.config.get<string>('app.globalPrefix') ?? 'api').replace(/^\/+|\/+$/g, '');
    const publicUrl = `/${prefix}/uploads/posters/${filename}`;
    if (existsSync(output)) return publicUrl;
    try {
      mkdirSync(dir, { recursive: true });
      const response = await fetch(`${TMDB_IMAGE}${safe}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        this.logger.warn(`TMDB poster responded ${response.status}`);
        return null;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 32 || bytes.length > 8_000_000) return null;
      await sharp(bytes)
        .rotate()
        .resize(POSTER_WIDTH, POSTER_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        })
        .webp({ quality: POSTER_QUALITY, effort: 4, smartSubsample: true })
        .toFile(output);
      return publicUrl;
    } catch (error) {
      this.logger.warn(`Could not save poster: ${error instanceof Error ? error.message : 'error'}`);
      return null;
    }
  }

  private apiKey(): string {
    const configured = this.config.get<string>('TMDB_API_KEY')?.trim();
    if (configured) return configured;
    const fromProcess = process.env.TMDB_API_KEY?.trim();
    if (fromProcess) return fromProcess;
    return readTmdbKeyFromEnvFiles();
  }

  private async getJson<T>(pathAndQuery: string): Promise<T | null> {
    try {
      const response = await fetch(`${TMDB_API}${pathAndQuery}`, {
        signal: AbortSignal.timeout(5_000),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        this.logger.warn(`TMDB responded ${response.status}`);
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(`TMDB lookup failed: ${error instanceof Error ? error.message : 'error'}`);
      return null;
    }
  }
}

function readTmdbKeyFromEnvFiles(): string {
  const paths = [
    join(process.cwd(), '.env'),
    '/opt/uniqbd.com/apps/api/.env',
    join(process.cwd(), '..', '.env'),
  ];
  let found = '';
  for (const path of paths) {
    let text = '';
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      if (trimmed.slice(0, eq).trim() !== 'TMDB_API_KEY') continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1).trim();
      }
      if (value) found = value;
    }
  }
  return found;
}
