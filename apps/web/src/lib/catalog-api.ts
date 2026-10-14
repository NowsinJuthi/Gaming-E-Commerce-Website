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

export type CatalogPage = {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

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
