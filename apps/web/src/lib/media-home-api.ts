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
};

export const EMPTY_MEDIA_HOME: MediaHome = { hero: [], rows: [], items: [] };

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
    };
  } catch {
    return EMPTY_MEDIA_HOME;
  }
}
