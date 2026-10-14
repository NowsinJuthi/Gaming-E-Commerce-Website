import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { resolveUploadsRoot } from '../../shared/uploads/uploads-root';

const TMDB_API = 'https://api.themoviedb.org';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w1280';
const TMDB_PROFILE = 'https://image.tmdb.org/t/p/w185';
const POSTER_WIDTH = 480;
const POSTER_HEIGHT = 720;
const POSTER_QUALITY = 68;

export type TmdbCast = { name: string; profileUrl: string | null };

export type TmdbMatch = {
  title: string;
  year: number | null;
  posterUrl: string | null;
};

export type TmdbDetails = {
  title: string;
  year: number | null;
  overview: string;
  runtimeMinutes: number | null;
  rating: number | null;
  genres: string[];
  backdropUrl: string | null;
  directors: string[];
  writers: string[];
  cast: TmdbCast[];
};

type SearchHit = {
  id?: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

type DetailPayload = {
  title?: string;
  name?: string;
  poster_path?: string | null;
  overview?: string;
  runtime?: number;
  episode_run_time?: number[];
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  backdrop_path?: string | null;
  genres?: { name?: string }[];
  created_by?: { name?: string }[];
  credits?: {
    cast?: { name?: string; profile_path?: string | null }[];
    crew?: { name?: string; job?: string }[];
  };
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

  async detailsMovie(title: string, year?: number | null): Promise<TmdbDetails | null> {
    return this.details('movie', title, year);
  }

  async detailsSeries(title: string, year?: number | null): Promise<TmdbDetails | null> {
    return this.details('tv', title, year);
  }

  async detailsMovieById(
    tmdbId: number,
    downloadPoster = true,
  ): Promise<(TmdbDetails & { posterUrl: string | null }) | null> {
    return this.detailsById('movie', tmdbId, downloadPoster);
  }

  async detailsSeriesById(
    tmdbId: number,
    downloadPoster = true,
  ): Promise<(TmdbDetails & { posterUrl: string | null }) | null> {
    return this.detailsById('tv', tmdbId, downloadPoster);
  }

  async savePosterBuffer(buffer: Buffer): Promise<string | null> {
    if (buffer.length < 32 || buffer.length > 8_000_000) return null;
    const filename = `${createHash('sha1').update(buffer).digest('hex').slice(0, 20)}.webp`;
    const dir = join(resolveUploadsRoot(), 'posters');
    const output = join(dir, filename);
    const prefix = (this.config.get<string>('app.globalPrefix') ?? 'api').replace(/^\/+|\/+$/g, '');
    const publicUrl = `/${prefix}/uploads/posters/${filename}`;
    if (existsSync(output)) return publicUrl;
    try {
      mkdirSync(dir, { recursive: true });
      await sharp(buffer)
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
      this.logger.warn(
        `Could not save uploaded poster: ${error instanceof Error ? error.message : 'error'}`,
      );
      return null;
    }
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

  private async details(kind: 'movie' | 'tv', title: string, year?: number | null): Promise<TmdbDetails | null> {
    const hit = await this.searchHit(kind, title, year);
    if (!hit?.id) return null;
    const path = kind === 'movie' ? `/3/movie/${hit.id}` : `/3/tv/${hit.id}`;
    const params = new URLSearchParams({
      api_key: this.apiKey(),
      append_to_response: 'credits',
    });
    const data = await this.getJson<DetailPayload>(`${path}?${params.toString()}`);
    if (!data) return null;
    const name = (kind === 'movie' ? data.title : data.name)?.trim() || title;
    const date = kind === 'movie' ? data.release_date : data.first_air_date;
    const parsedYear = date ? Number(date.slice(0, 4)) : null;
    const crew = data.credits?.crew ?? [];
    const runtime = kind === 'movie' ? data.runtime : data.episode_run_time?.[0];
    return {
      title: name,
      year: Number.isFinite(parsedYear) ? parsedYear : null,
      overview: data.overview?.trim() || '',
      runtimeMinutes: runtime && runtime > 0 ? Math.round(runtime) : null,
      rating: typeof data.vote_average === 'number' && data.vote_average > 0 ? Math.round(data.vote_average * 10) / 10 : null,
      genres: (data.genres ?? []).map((genre) => genre.name?.trim() || '').filter(Boolean).slice(0, 6),
      backdropUrl: data.backdrop_path ? `${TMDB_BACKDROP}${data.backdrop_path}` : null,
      directors:
        kind === 'tv'
          ? (data.created_by ?? []).map((person) => person.name?.trim() || '').filter(Boolean).slice(0, 4)
          : crew.filter((person) => person.job === 'Director').map((person) => person.name?.trim() || '').filter(Boolean).slice(0, 4),
      writers: crew
        .filter((person) => person.job === 'Writer' || person.job === 'Screenplay')
        .map((person) => person.name?.trim() || '')
        .filter(Boolean)
        .slice(0, 6),
      cast: (data.credits?.cast ?? [])
        .map((person) => ({
          name: person.name?.trim() || '',
          profileUrl: person.profile_path ? `${TMDB_PROFILE}${person.profile_path}` : null,
        }))
        .filter((person) => person.name)
        .slice(0, 12),
    };
  }

  private async detailsById(
    kind: 'movie' | 'tv',
    tmdbId: number,
    downloadPoster: boolean,
  ): Promise<(TmdbDetails & { posterUrl: string | null }) | null> {
    if (!this.enabled() || !Number.isFinite(tmdbId) || tmdbId < 1) return null;
    const path = kind === 'movie' ? `/3/movie/${tmdbId}` : `/3/tv/${tmdbId}`;
    const params = new URLSearchParams({
      api_key: this.apiKey(),
      append_to_response: 'credits',
    });
    const data = await this.getJson<DetailPayload>(`${path}?${params.toString()}`);
    if (!data) return null;
    const name = (kind === 'movie' ? data.title : data.name)?.trim();
    if (!name) return null;
    const date = kind === 'movie' ? data.release_date : data.first_air_date;
    const parsedYear = date ? Number(date.slice(0, 4)) : null;
    const crew = data.credits?.crew ?? [];
    const runtime = kind === 'movie' ? data.runtime : data.episode_run_time?.[0];
    const posterUrl =
      downloadPoster && data.poster_path ? await this.savePoster(data.poster_path) : null;
    return {
      title: name,
      year: Number.isFinite(parsedYear) ? parsedYear : null,
      overview: data.overview?.trim() || '',
      runtimeMinutes: runtime && runtime > 0 ? Math.round(runtime) : null,
      rating:
        typeof data.vote_average === 'number' && data.vote_average > 0
          ? Math.round(data.vote_average * 10) / 10
          : null,
      genres: (data.genres ?? []).map((genre) => genre.name?.trim() || '').filter(Boolean).slice(0, 12),
      backdropUrl: data.backdrop_path ? `${TMDB_BACKDROP}${data.backdrop_path}` : null,
      directors:
        kind === 'tv'
          ? (data.created_by ?? []).map((person) => person.name?.trim() || '').filter(Boolean).slice(0, 4)
          : crew
              .filter((person) => person.job === 'Director')
              .map((person) => person.name?.trim() || '')
              .filter(Boolean)
              .slice(0, 4),
      writers: crew
        .filter((person) => person.job === 'Writer' || person.job === 'Screenplay')
        .map((person) => person.name?.trim() || '')
        .filter(Boolean)
        .slice(0, 6),
      cast: (data.credits?.cast ?? [])
        .map((person) => ({
          name: person.name?.trim() || '',
          profileUrl: person.profile_path ? `${TMDB_PROFILE}${person.profile_path}` : null,
        }))
        .filter((person) => person.name)
        .slice(0, 12),
      posterUrl,
    };
  }

  private async searchHit(kind: 'movie' | 'tv', title: string, year?: number | null): Promise<SearchHit | null> {
    const cleaned = title.trim();
    if (!this.enabled() || !cleaned) return null;
    const params = new URLSearchParams({
      api_key: this.apiKey(),
      query: cleaned,
      include_adult: 'false',
    });
    if (year) params.set(kind === 'movie' ? 'year' : 'first_air_date_year', String(year));
    const path = kind === 'movie' ? '/3/search/movie' : '/3/search/tv';
    const data = await this.getJson<{ results?: SearchHit[] }>(`${path}?${params.toString()}`);
    const hit = data?.results?.[0];
    if (!hit && year) return this.searchHit(kind, cleaned, null);
    return hit ?? null;
  }

  private async savePoster(posterPath: string): Promise<string | null> {
    const safe = posterPath.trim();
    if (!safe.startsWith('/') || safe.includes('..') || safe.includes('\\')) return null;
    const remoteUrl = `${TMDB_IMAGE}${safe}`;
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
        return remoteUrl;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 32 || bytes.length > 8_000_000) return remoteUrl;
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
      return remoteUrl;
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
