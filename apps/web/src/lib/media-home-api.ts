import { API_BASE } from "@/lib/api";

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
  libraries: MediaLibraryMenu[];
};

export const EMPTY_MEDIA_HOME: MediaHome = { hero: [], rows: [], items: [], libraries: [] };

export function parseMediaHome(data: unknown): MediaHome {
  if (!data || typeof data !== "object") return EMPTY_MEDIA_HOME;
  const payload = data as MediaHome;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const items = Array.isArray(payload.items)
    ? payload.items
    : rows.flatMap((row) => row.items ?? []);
  return {
    hero: Array.isArray(payload.hero) ? payload.hero : [],
    rows,
    items,
    libraries: Array.isArray(payload.libraries) ? payload.libraries : [],
  };
}

export async function getMediaHome(): Promise<MediaHome> {
  try {
    const res = await fetch(`${API_BASE}/media/home`, {
      cache: "no-store",
    });
    if (!res.ok) return EMPTY_MEDIA_HOME;
    return parseMediaHome(await res.json());
  } catch {
    return EMPTY_MEDIA_HOME;
  }
}
