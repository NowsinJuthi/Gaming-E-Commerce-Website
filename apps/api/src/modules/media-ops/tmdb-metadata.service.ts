import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TMDB_API = 'https://api.themoviedb.org';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';

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
    return {
      title: name,
      year: Number.isFinite(parsedYear) ? parsedYear : null,
      posterUrl: hit.poster_path ? `${TMDB_IMAGE}${hit.poster_path}` : null,
    };
  }

  private apiKey(): string {
    return this.config.get<string>('TMDB_API_KEY')?.trim() ?? process.env.TMDB_API_KEY?.trim() ?? '';
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
