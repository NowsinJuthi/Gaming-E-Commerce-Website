import { authRequest } from "@/lib/api";

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

export type CatalogBulkAction =
  | "publish"
  | "unpublish"
  | "delete"
  | "feature"
  | "trending";

export function listMovieCollections(q?: string) {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return authRequest<{ items: CatalogItem[]; total: number }>(
    `/admin/movie-collections${qs}`,
  );
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

export function listSeriesCollections(q?: string) {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return authRequest<{ items: CatalogItem[]; total: number }>(
    `/admin/series-collections${qs}`,
  );
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
