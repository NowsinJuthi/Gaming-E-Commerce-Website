import { API_BASE } from "@/lib/api";

function resolveMediaApiBase(): string {
  if (typeof window === "undefined") {
    const internal = process.env.INTERNAL_API_URL?.trim();
    if (internal) return internal.replace(/\/$/, "");
  }
  return API_BASE.replace(/\/$/, "");
}

function mediaFetchInit(): RequestInit {
  if (typeof window === "undefined") {
    return { next: { revalidate: 30 } };
  }
  return { cache: "no-store" };
}

export type MediaCard = {
  id: string;
  title: string;
  year: number;
  kind: "movie" | "series";
  posterUrl: string | null;
  featured: boolean;
  trending: boolean;
  seasonCount: number | null;
  libraryId?: string | null;
  /** Set when added/re-uploaded via admin Samba upload (ms since epoch). */
  listedAt?: number | null;
  sortAt?: number;
};

export type MediaLibraryMenu = {
  id: string;
  name: string;
};

export type MediaRow = {
  id: string;
  title: string;
  items: MediaCard[];
};

export type MediaHome = {
  hero: MediaCard[];
  rows: MediaRow[];
  items: MediaCard[];
  /** Newest Samba uploads (listedAt), from API. */
  recentUploads?: MediaCard[];
  libraries: MediaLibraryMenu[];
  years?: number[];
};

export type MediaBrowseResult = {
  items: MediaCard[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export const MEDIA_PAGE_SIZE_MOBILE = 12;
export const MEDIA_PAGE_SIZE_DESKTOP = 24;
export const MEDIA_SEARCH_LIMIT = 80;

export const EMPTY_MEDIA_HOME: MediaHome = { hero: [], rows: [], items: [], libraries: [] };

export function parseMediaHome(data: unknown): MediaHome {
  if (!data || typeof data !== "object") return EMPTY_MEDIA_HOME;
  const payload = data as MediaHome;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const items = Array.isArray(payload.items)
    ? payload.items
    : rows.flatMap((row) => row.items ?? []);
  const years = Array.isArray((payload as MediaHome).years)
    ? (payload as MediaHome).years!.filter((y) => typeof y === "number" && y > 0)
    : [];
  return {
    hero: Array.isArray(payload.hero) ? payload.hero : [],
    rows,
    items,
    recentUploads: Array.isArray(payload.recentUploads) ? payload.recentUploads : [],
    libraries: Array.isArray(payload.libraries) ? payload.libraries : [],
    years,
  };
}

export function parseMediaBrowse(data: unknown): MediaBrowseResult {
  if (!data || typeof data !== "object") {
    return { items: [], total: 0, offset: 0, limit: MEDIA_PAGE_SIZE_DESKTOP, hasMore: false };
  }
  const payload = data as MediaBrowseResult;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const total = typeof payload.total === "number" ? payload.total : items.length;
  const offset = typeof payload.offset === "number" ? payload.offset : 0;
  const limit = typeof payload.limit === "number" ? payload.limit : items.length;
  const hasMore =
    typeof payload.hasMore === "boolean" ? payload.hasMore : offset + items.length < total;
  return { items, total, offset, limit, hasMore };
}

export type MediaBrowseParams = {
  libraryId?: string;
  year?: string;
  q?: string;
  offset?: number;
  limit?: number;
};

function browseQuery(params: MediaBrowseParams): string {
  const search = new URLSearchParams();
  if (params.libraryId && params.libraryId !== "all") {
    search.set("libraryId", params.libraryId);
  }
  if (params.year?.trim()) search.set("year", params.year.trim());
  if (params.q?.trim()) search.set("q", params.q.trim());
  search.set("offset", String(Math.max(0, params.offset ?? 0)));
  search.set("limit", String(params.limit ?? MEDIA_PAGE_SIZE_DESKTOP));
  return search.toString();
}

export async function getMediaBrowse(params: MediaBrowseParams = {}): Promise<MediaBrowseResult> {
  try {
    const res = await fetch(
      `${resolveMediaApiBase()}/media/browse?${browseQuery(params)}`,
      mediaFetchInit(),
    );
    if (!res.ok) return parseMediaBrowse(null);
    return parseMediaBrowse(await res.json());
  } catch {
    return parseMediaBrowse(null);
  }
}

export async function getMediaYears(libraryId: string): Promise<number[]> {
  try {
    const q =
      libraryId && libraryId !== "all"
        ? `?libraryId=${encodeURIComponent(libraryId)}`
        : "";
    const res = await fetch(`${resolveMediaApiBase()}/media/years${q}`, mediaFetchInit());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.filter((y) => typeof y === "number" && y > 0) : [];
  } catch {
    return [];
  }
}

export async function getMediaHome(): Promise<MediaHome> {
  try {
    const res = await fetch(`${resolveMediaApiBase()}/media/home`, mediaFetchInit());
    if (!res.ok) return EMPTY_MEDIA_HOME;
    return parseMediaHome(await res.json());
  } catch {
    return EMPTY_MEDIA_HOME;
  }
}

export type MediaBootstrap = {
  home: MediaHome;
  browse: MediaBrowseResult;
};

export async function getMediaBootstrap(limit = MEDIA_PAGE_SIZE_MOBILE): Promise<MediaBootstrap> {
  try {
    const res = await fetch(
      `${resolveMediaApiBase()}/media/bootstrap?limit=${limit}`,
      mediaFetchInit(),
    );
    if (!res.ok) {
      return { home: EMPTY_MEDIA_HOME, browse: parseMediaBrowse(null) };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const libraries = Array.isArray(data.libraries)
      ? (data.libraries as MediaLibraryMenu[])
      : [];
    const years = Array.isArray(data.years)
      ? (data.years as number[]).filter((y) => typeof y === "number" && y > 0)
      : [];
    const browse = parseMediaBrowse({
      items: data.items,
      total: data.total,
      offset: data.offset,
      limit: data.limit,
      hasMore: data.hasMore,
    });
    return {
      home: {
        hero: [],
        rows: [],
        items: [],
        libraries,
        years,
      },
      browse,
    };
  } catch {
    return { home: EMPTY_MEDIA_HOME, browse: parseMediaBrowse(null) };
  }
}
