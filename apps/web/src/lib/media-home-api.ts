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

export async function getMediaHome(): Promise<MediaHome> {
  try {
    const res = await fetch(`${API_BASE}/media/home`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return EMPTY_MEDIA_HOME;
    const data = (await res.json()) as MediaHome;
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const items = Array.isArray(data.items)
      ? data.items
      : rows.flatMap((row) => row.items ?? []);
    return {
      hero: Array.isArray(data.hero) ? data.hero : [],
      rows,
      items,
      libraries: Array.isArray(data.libraries) ? data.libraries : [],
    };
  } catch {
    return EMPTY_MEDIA_HOME;
  }
}
