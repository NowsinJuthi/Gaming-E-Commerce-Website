import { API_BASE, authRequest } from "@/lib/api";

export type CatalogItem = {
  id: string;
  title: string;
  releaseYear: number;
  firstAirYear: number;
  published: boolean;
  availability: "available" | "unavailable";
  featured: boolean;
  trending: boolean;
  posterUrl?: string | null;
  videoFileName?: string | null;
  videoFileSizeBytes?: number | null;
  seasonCount?: number | null;
};

export type CatalogPage = {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type CatalogKind = "movie" | "series";

export type AdminCatalogDetail = CatalogItem & {
  kind: CatalogKind;
  overview: string;
  runtimeMinutes: number | null;
  rating: number | null;
  genres: string[];
  backdropUrl: string | null;
};

function catalogResource(kind: CatalogKind): "movie-collections" | "series-collections" {
  return kind === "series" ? "series-collections" : "movie-collections";
}

export type CatalogBulkAction =
  | "publish"
  | "unpublish"
  | "delete"
  | "feature"
  | "trending";

function catalogQuery(q?: string, page = 1): string {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listMovieCollections(q?: string, page = 1) {
  return authRequest<CatalogPage>(`/admin/movie-collections${catalogQuery(q, page)}`);
}

export function bulkMovieCollections(ids: string[], action: CatalogBulkAction) {
  return authRequest<{ updated: number }>("/admin/movie-collections/bulk", {
    method: "POST",
    body: JSON.stringify({ ids, action }),
  });
}

export function updateMovieCollection(
  id: string,
  body: Partial<CatalogItem> & { year?: number },
) {
  return authRequest<CatalogItem>(`/admin/movie-collections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listSeriesCollections(q?: string, page = 1) {
  return authRequest<CatalogPage>(`/admin/series-collections${catalogQuery(q, page)}`);
}

export function bulkSeriesCollections(ids: string[], action: CatalogBulkAction) {
  return authRequest<{ updated: number }>("/admin/series-collections/bulk", {
    method: "POST",
    body: JSON.stringify({ ids, action }),
  });
}

export function updateSeriesCollection(
  id: string,
  body: Partial<CatalogItem> & { year?: number },
) {
  return authRequest<CatalogItem>(`/admin/series-collections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getCatalogDetail(kind: CatalogKind, id: string) {
  return authRequest<AdminCatalogDetail>(`/admin/${catalogResource(kind)}/${id}`);
}

export function applyCatalogFromTmdb(
  kind: CatalogKind,
  id: string,
  tmdbId: number,
  updateArtwork = true,
) {
  return authRequest<AdminCatalogDetail>(`/admin/${catalogResource(kind)}/${id}/tmdb`, {
    method: "POST",
    body: JSON.stringify({ tmdbId, updateArtwork }),
  });
}

export async function uploadCatalogPoster(kind: CatalogKind, id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/admin/${catalogResource(kind)}/${id}/poster`, {
    method: "POST",
    body: form,
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    let message = "Poster upload failed.";
    try {
      const data = JSON.parse(text) as { message?: string | string[] };
      if (typeof data.message === "string") message = data.message;
      else if (Array.isArray(data.message)) message = data.message.join(", ");
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as AdminCatalogDetail;
}
