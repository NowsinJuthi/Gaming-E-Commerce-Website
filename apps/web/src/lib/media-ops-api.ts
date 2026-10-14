import { authRequest, authSmbMediaUpload, type AuthFormDataProgress } from "@/lib/api";

export type MediaLibraryKind = "movies" | "tv";

export type AdminMediaLibrary = {
  id: string;
  name: string;
  kind: MediaLibraryKind;
  provider: "local" | "smb";
  rootPath: string;
  enabled: boolean;
  imageUrl?: string | null;
  smbServerId?: string | null;
  smbShare?: string | null;
  smbRemotePath?: string | null;
  itemCount: number;
  missingCount: number;
  unmatchedCount: number;
};

export type AdminSmbServer = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  domain: string;
  share: string;
  enabled: boolean;
  hasPassword: boolean;
  lastOkAt?: string | null;
  lastError?: string | null;
};

export type SmbBrowseEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

export function listMediaLibraries() {
  return authRequest<{
    libraries: AdminMediaLibrary[];
    totals: { items: number; missing: number; unmatched: number };
  }>("/admin/libraries");
}

export type MovieServerDashboardLibrary = AdminMediaLibrary & {
  catalogCount: number;
};

export function getMovieServerDashboard() {
  return authRequest<{
    totals: {
      libraries: number;
      movies: number;
      series: number;
      catalog: number;
    };
    libraries: MovieServerDashboardLibrary[];
  }>("/admin/movie-server/dashboard");
}

export function createMediaLibrary(body: {
  name: string;
  kind: MediaLibraryKind;
  rootPath: string;
}) {
  return authRequest<AdminMediaLibrary>("/admin/libraries", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateMediaLibrary(
  id: string,
  body: Partial<{
    name: string;
    kind: MediaLibraryKind;
    rootPath: string;
    enabled: boolean;
  }>,
) {
  return authRequest<AdminMediaLibrary>(`/admin/libraries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type LibraryIndexedItem = {
  id: string;
  fileName: string;
  status: string;
  match: string;
  resolution: string;
  codec: string;
};

export function indexMediaLibrary(id: string) {
  return authRequest<{
    indexed: number;
    matched: number;
    unmatched: number;
    removed?: number;
    logs: string[];
  }>(
    `/admin/libraries/${id}/index`,
    { method: "POST" },
  );
}

export function listLibraryItems(id: string) {
  return authRequest<{ items: LibraryIndexedItem[] }>(`/admin/libraries/${id}/items`);
}

export function deleteMediaLibrary(id: string) {
  return authRequest<{ deleted: boolean }>(`/admin/libraries/${id}`, {
    method: "DELETE",
  });
}

export function listSmbServers() {
  return authRequest<{ servers: AdminSmbServer[] }>("/admin/media-shares");
}

export function createSmbServer(body: {
  name: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  domain?: string;
  share: string;
}) {
  return authRequest<AdminSmbServer>("/admin/media-shares", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function saveSmbPassword(id: string, password: string) {
  return authRequest<AdminSmbServer>(`/admin/media-shares/${id}/credentials`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function deleteSmbServer(id: string) {
  return authRequest<{ deleted: boolean }>(`/admin/media-shares/${id}`, {
    method: "DELETE",
  });
}

export function testSmbServer(id: string) {
  return authRequest<{ ok: boolean; error?: string | null }>(
    `/admin/media-shares/${id}/test`,
    { method: "POST" },
  );
}

export function browseSmb(id: string, path = "") {
  const qs = path ? `?path=${encodeURIComponent(path)}` : "";
  return authRequest<{ path: string; entries: SmbBrowseEntry[] }>(
    `/admin/media-shares/${id}/browse${qs}`,
  );
}

export function addSmbLibrary(body: {
  serverId: string;
  path: string;
  name: string;
  kind: MediaLibraryKind;
}) {
  return authRequest<AdminMediaLibrary>("/admin/media-shares/libraries", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type SmbUploadResult = {
  uploaded: number;
  library: AdminMediaLibrary;
  indexed: number;
  matched: number;
  unmatched: number;
  removed?: number;
  logs: string[];
};

export async function uploadSmbMedia(
  serverId: string,
  browsePath: string,
  kind: MediaLibraryKind,
  files: File[],
  opts?: { onProgress?: (progress: AuthFormDataProgress) => void },
): Promise<SmbUploadResult> {
  const form = new FormData();
  form.append("path", browsePath);
  form.append("kind", kind);
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    form.append("files", file, rel);
  }
  return authSmbMediaUpload<SmbUploadResult>(serverId, form, { onProgress: opts?.onProgress });
}
