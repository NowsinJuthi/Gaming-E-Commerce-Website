"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { BoxIcon } from "@/components/admin/icons";
import styles from "@/components/admin/file-manager-page.module.css";
import {
  addSmbLibrary,
  browseSmb,
  createSmbServer,
  deleteSmbServer,
  listSmbServers,
  saveSmbPassword,
  testSmbServer,
  uploadSmbMedia,
  type AdminSmbServer,
  type MediaLibraryKind,
  type SmbBrowseEntry,
} from "@/lib/media-ops-api";
import { CLOUDFLARE_PROXY_UPLOAD_BYTES } from "@/lib/api";

const VIDEO_ACCEPT = ".mkv,.mp4,.avi,.mov,.wmv,.m4v,.ts,.m2ts,.webm,.mpg,.mpeg,video/*";
const LARGE_UPLOAD_HOST = Boolean(process.env.NEXT_PUBLIC_LARGE_UPLOAD_ORIGIN?.trim());

function totalPickBytes(files: File[]) {
  return files.reduce((sum, file) => sum + file.size, 0);
}

export default function AdminFileManagerPage() {
  const [servers, setServers] = useState<AdminSmbServer[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browsePath, setBrowsePath] = useState("");
  const [entries, setEntries] = useState<SmbBrowseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [browsing, setBrowsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("445");
  const [share, setShare] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [updatePassword, setUpdatePassword] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [libraryKind, setLibraryKind] = useState<MediaLibraryKind>("movies");
  const [pendingDir, setPendingDir] = useState<SmbBrowseEntry | null>(null);
  const [pickLabel, setPickLabel] = useState<string | null>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [uploadKind, setUploadKind] = useState<MediaLibraryKind>("movies");
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "upload" | "samba">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => servers.find((server) => server.id === selectedId) ?? null,
    [servers, selectedId],
  );

  const reload = useCallback(async () => {
    const data = await listSmbServers();
    setServers(data.servers);
  }, []);

  const loadBrowse = useCallback(async (id: string, path: string) => browseSmb(id, path), []);

  useEffect(() => {
    reload()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load Samba servers."),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setBrowsing(true);
    setError(null);
    setEntries([]);
    void loadBrowse(selectedId, browsePath)
      .then(async (data) => {
        if (cancelled) return;
        setEntries(data.entries);
        await reload();
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(browseErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setBrowsing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, browsePath, loadBrowse, reload]);

  const pathSegments = browsePath ? browsePath.split("/").filter(Boolean) : [];
  const parentPath = browsePath.includes("/") ? browsePath.slice(0, browsePath.lastIndexOf("/")) : "";
  const uncPath = selected
    ? `\\\\${selected.host}\\${selected.share}${browsePath ? `\\${browsePath.replace(/\//g, "\\")}` : ""}`
    : "";
  const showCredentials = Boolean(selected && (selected.lastError || (error && !uploadError)));

  function openLibrary(entry: { name: string; path: string }) {
    setPendingDir({ name: entry.name, path: entry.path, isDirectory: true });
    setLibraryName(entry.name);
    setLibraryKind(pathLooksLikeTv(`${entry.path} ${entry.name}`) ? "tv" : "movies");
  }

  function resetPickers() {
    setPickedFiles([]);
    setPickLabel(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  async function startUpload() {
    if (!selected || pickedFiles.length === 0) return;
    const bytes = totalPickBytes(pickedFiles);
    if (!LARGE_UPLOAD_HOST && bytes > CLOUDFLARE_PROXY_UPLOAD_BYTES * 0.95) {
      setUploadError(
        "Total size is over Cloudflare’s ~100MB limit while the site is proxied. Copy the file onto the Samba share from your LAN, or set up upload.uniqbd.com (grey cloud) with NEXT_PUBLIC_LARGE_UPLOAD_ORIGIN and rebuild web.",
      );
      return;
    }
    setBusy(true);
    setUploadError(null);
    setUploadPct(0);
    setUploadPhase("upload");
    setUploadNote(null);
    try {
      const result = await uploadSmbMedia(selected.id, browsePath, uploadKind, pickedFiles, {
        onProgress: ({ loaded, total, phase }) => {
          if (phase === "processing") {
            setUploadPhase("samba");
            setUploadPct(100);
            return;
          }
          if (total > 0) {
            setUploadPct(Math.min(99, Math.round((loaded / total) * 100)));
          }
        },
      });
      setUploadNote(
        result.logs?.[1] ??
          `Uploaded ${result.uploaded} file(s). Scan runs in the background — check Movie/Series collections shortly.`,
      );
      resetPickers();
      const data = await loadBrowse(selected.id, browsePath);
      setEntries(data.entries);
      await reload();
    } catch (err) {
      setUploadNote(null);
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      setUploadPhase("idle");
      setUploadPct(0);
    }
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createSmbServer({
        name: name || host,
        host,
        port: Number(port) || 445,
        share,
        username,
        password,
        domain,
      });
      setShowConnect(false);
      setPassword("");
      await reload();
      setSelectedId(created.id);
      setBrowsePath("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add Samba server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageLayout
      section="Movie Server"
      title="Samba file manager"
      description="Connect network storage, browse shares, upload videos, and link folders to media libraries."
      icon={BoxIcon}
      action={
        <button type="button" className={styles.connectToggle} onClick={() => setShowConnect((open) => !open)}>
          {showConnect ? "Close" : "+ Connect server"}
        </button>
      }
    >
      <div className={styles.layout}>
        {error && !selected ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        ) : null}
        {showConnect ? (
          <section className={styles.connectPanel}>
            <div className={styles.connectHead}>
              <div>
                <h2 className={styles.connectTitle}>Connect Samba server</h2>
                <p className={styles.connectHint}>
                  Use the Samba account from your server (<code className="text-xs">pdbedit -L</code>), not your
                  Windows login unless they match. Leave domain blank for WORKGROUP.
                </p>
              </div>
            </div>
            <form className={styles.connectBody} onSubmit={(event) => void onCreate(event)}>
              <div className={styles.formGrid}>
                <Field label="Display name" value={name} onChange={setName} placeholder="Data-Storage" />
                <Field label="Server IP / host" value={host} onChange={setHost} placeholder="192.168.0.10" required />
                <Field label="Port" value={port} onChange={setPort} />
                <Field
                  label="Share name"
                  value={share}
                  onChange={setShare}
                  placeholder="Data-Storage"
                  hint="Samba share from smbclient -L //host -U user — not a Windows drive label (e.g. 12TB-Storage)."
                  required
                />
                <Field label="Username" value={username} onChange={setUsername} placeholder="samba-user" required />
                <Field label="Password" value={password} onChange={setPassword} type="password" required />
                <Field label="Domain (optional)" value={domain} onChange={setDomain} placeholder="WORKGROUP" />
                <div className={styles.field} style={{ display: "flex", alignItems: "flex-end" }}>
                  <button type="submit" className={styles.uploadStart} disabled={busy}>
                    {busy ? "Connecting…" : "Save & connect"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        ) : null}

        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHead}>
              <h2 className={styles.sidebarTitle}>Servers</h2>
              <span className="text-xs text-subtle">{servers.length}</span>
            </div>
            <ul className={styles.serverList}>
              {loading ? <li className="px-3 py-8 text-center text-xs text-subtle">Loading…</li> : null}
              {servers.map((server) => (
                <li key={server.id}>
                  <button
                    type="button"
                    className={`${styles.serverBtn} ${selectedId === server.id ? styles.serverBtnActive : ""}`}
                    onClick={() => {
                      setSelectedId(server.id);
                      setBrowsePath("");
                      setPendingDir(null);
                      resetPickers();
                      setUploadNote(null);
                      setError(null);
                    }}
                  >
                    <span className={styles.serverIcon}>
                      <ServerIcon />
                    </span>
                    <span className={styles.serverMeta}>
                      <span className={styles.serverName}>{server.name}</span>
                      <span className={styles.serverHost}>
                        {server.host}/{server.share}
                      </span>
                      <span className="mt-1.5 inline-flex">
                        <ServerStatusBadge server={server} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {!loading && servers.length === 0 ? (
                <li className="px-3 py-8 text-center text-xs text-subtle">
                  No servers yet. Click Connect server above.
                </li>
              ) : null}
            </ul>
          </aside>

          <section className={styles.main}>
            {!selected ? (
              <div className={styles.mainEmpty}>
                <p className="text-sm font-medium">Select a Samba server</p>
                <p className="max-w-sm text-xs">
                  Choose a server from the sidebar to browse folders, upload videos, or create a media library.
                </p>
              </div>
            ) : (
              <>
                <header className={styles.mainHead}>
                  <div className="min-w-0 flex-1">
                    <h2 className={styles.mainTitle}>{selected.name}</h2>
                    <p className={styles.uncPath} title={uncPath}>
                      {uncPath}
                    </p>
                  </div>
                  <div className={styles.toolbar}>
                    <button
                      type="button"
                      className={styles.toolBtn}
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        setError(null);
                        void testSmbServer(selected.id)
                          .then(async () => {
                            await reload();
                            const data = await loadBrowse(selected.id, browsePath);
                            setEntries(data.entries);
                          })
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : "Connection test failed."),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      Test connection
                    </button>
                    <button
                      type="button"
                      className={`${styles.toolBtn} ${styles.dangerBtn}`}
                      onClick={() => {
                        if (!confirm(`Remove ${selected.name}?`)) return;
                        void deleteSmbServer(selected.id)
                          .then(async () => {
                            setSelectedId(null);
                            await reload();
                          })
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : "Could not remove server."),
                          );
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </header>

                {showCredentials ? (
                  <div className={styles.credPanel}>
                    <h3 className={styles.credTitle}>Connection required</h3>
                    <p className={styles.credMessage}>
                      {error || selected.lastError || "Could not reach this share. Re-enter the Samba password."}
                    </p>
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setBusy(true);
                        setError(null);
                        void saveSmbPassword(selected.id, updatePassword)
                          .then(async () => {
                            setUpdatePassword("");
                            await reload();
                            const data = await loadBrowse(selected.id, browsePath);
                            setEntries(data.entries);
                          })
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : "Could not save password."),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      <label className="min-w-[12rem] flex-1 text-xs">
                        Samba password
                        <input
                          className={styles.inputLike}
                          type="password"
                          value={updatePassword}
                          onChange={(event) => setUpdatePassword(event.target.value)}
                          placeholder="Share password"
                          required
                        />
                      </label>
                      <button type="submit" className={styles.toolBtn} disabled={busy || !updatePassword}>
                        {busy ? "Saving…" : "Save password"}
                      </button>
                    </form>
                  </div>
                ) : null}

                <nav className={styles.breadcrumb} aria-label="Folder path">
                  <button type="button" className={styles.crumb} onClick={() => setBrowsePath("")}>
                    <HomeIcon />
                    Share root
                  </button>
                  {pathSegments.map((segment, index) => {
                    const path = pathSegments.slice(0, index + 1).join("/");
                    const isLast = index === pathSegments.length - 1;
                    return (
                      <span key={path} className="inline-flex items-center">
                        <ChevronIcon />
                        <button
                          type="button"
                          className={`${styles.crumb} ${isLast ? styles.crumbActive : ""}`}
                          onClick={() => !isLast && setBrowsePath(path)}
                          disabled={isLast}
                        >
                          {segment}
                        </button>
                      </span>
                    );
                  })}
                </nav>

                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    disabled={!browsePath}
                    onClick={() => setBrowsePath(parentPath)}
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    disabled={browsing}
                    onClick={() => {
                      setBrowsing(true);
                      void loadBrowse(selected.id, browsePath)
                        .then((data) => {
                          setEntries(data.entries);
                          setError(null);
                        })
                        .catch((err: unknown) => setError(browseErrorMessage(err)))
                        .finally(() => setBrowsing(false));
                    }}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    onClick={() =>
                      openLibrary({
                        name: browsePath ? browsePath.split("/").pop() || selected.share : selected.share,
                        path: browsePath,
                      })
                    }
                  >
                    Library from current folder
                  </button>
                </div>

                {uploadError ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                    <p className="m-0">{uploadError}</p>
                    {uploadError.includes("Share name was not found") && selected ? (
                      <p className="mb-0 mt-2 text-xs text-rose-200/90">
                        Fix: delete this server, reconnect with the correct share (sidebar shows{" "}
                        <strong>{selected.share}</strong>). On the storage box:{" "}
                        <code className="text-[0.7rem]">smbclient -L //{selected.host} -U {selected.username}</code>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <section className={styles.uploadPanel} aria-label="Upload video">
                  <div className={styles.uploadHead}>
                    <div className="min-w-0 flex-1">
                      <h3 className={styles.uploadTitle}>Upload to Samba</h3>
                      <p className={styles.uploadPath} title={uncPath}>
                        {uncPath}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {LARGE_UPLOAD_HOST
                          ? "Large uploads use the dedicated upload host (bypasses Cloudflare size cap)."
                          : "Through Cloudflare (orange cloud), browser uploads above ~100MB fail — use Samba on the storage LAN or configure upload.uniqbd.com (grey cloud)."}
                      </p>
                    </div>
                    <label className={styles.field}>
                      <span className="sr-only">Content type</span>
                      <select
                        className={styles.select}
                        value={uploadKind}
                        onChange={(event) => setUploadKind(event.target.value as MediaLibraryKind)}
                        disabled={busy}
                      >
                        <option value="movies">Movie upload</option>
                        <option value="tv">Series upload</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className={styles.uploadStart}
                      disabled={busy || pickedFiles.length === 0}
                      onClick={() => void startUpload()}
                    >
                      {busy ? "Working…" : "↑ Start upload"}
                    </button>
                  </div>
                  <div className={styles.dropZone}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={VIDEO_ACCEPT}
                      className={styles.fileInput}
                      tabIndex={-1}
                      aria-hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (folderInputRef.current) folderInputRef.current.value = "";
                        if (file) {
                          setPickedFiles([file]);
                          setPickLabel(file.name);
                          if (pathLooksLikeTv(file.name)) setUploadKind("tv");
                        } else {
                          resetPickers();
                        }
                      }}
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      accept={VIDEO_ACCEPT}
                      className={styles.fileInput}
                      tabIndex={-1}
                      aria-hidden
                      multiple
                      onChange={(event) => {
                        const list = event.target.files;
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        if (!list?.length) {
                          resetPickers();
                          return;
                        }
                        const files = Array.from(list).filter((file) => isVideoFileName(file.name));
                        if (!files.length) {
                          setError("No video files found in that folder.");
                          resetPickers();
                          return;
                        }
                        setPickedFiles(files);
                        const root =
                          (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/")[0] ??
                          "folder";
                        setPickLabel(`${files.length} video file(s) · ${root}`);
                        if (pathLooksLikeTv(root)) setUploadKind("tv");
                      }}
                      {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                    />
                    <div className={styles.pickActions}>
                      <button
                        type="button"
                        className={styles.pickButton}
                        disabled={busy}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Choose file
                      </button>
                      <button
                        type="button"
                        className={styles.pickButton}
                        disabled={busy}
                        onClick={() => folderInputRef.current?.click()}
                      >
                        Choose folder
                      </button>
                    </div>
                    <p className={styles.fileMeta}>
                      {pickLabel
                        ? `Selected: ${pickLabel}`
                        : "Upload adds files here, links or creates a media library, then scans TMDB for posters."}
                    </p>
                    {uploadNote ? <p className={styles.fileMeta}>{uploadNote}</p> : null}
                    {uploadPhase !== "idle" ? (
                      <div className={styles.uploadProgressWrap} aria-live="polite">
                        <div className={styles.uploadProgressTrack}>
                          <div
                            className={
                              uploadPhase === "samba"
                                ? `${styles.uploadProgressBar} ${styles.uploadProgressBarIndeterminate}`
                                : styles.uploadProgressBar
                            }
                            style={uploadPhase === "upload" ? { width: `${uploadPct}%` } : undefined}
                          />
                        </div>
                        <p className={styles.uploadProgressLabel}>
                          {uploadPhase === "upload"
                            ? `Sending to server… ${uploadPct}%${totalPickBytes(pickedFiles) > 0 ? ` · ${formatBytes(totalPickBytes(pickedFiles))}` : ""}`
                            : "Writing to Samba storage… this can take several minutes for large files."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>

                <div className={styles.fileTableWrap}>
                  {browsing ? (
                    <p className={styles.emptyFolder}>Loading folder…</p>
                  ) : (
                    <table className={styles.fileTable}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Size</th>
                          <th style={{ width: "8.5rem" }} />
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.path} className={styles.fileRow}>
                            <td>
                              <button
                                type="button"
                                className={styles.fileNameBtn}
                                disabled={!entry.isDirectory}
                                onClick={() => {
                                  if (!entry.isDirectory) return;
                                  setBrowsePath(entry.path);
                                  setPendingDir(null);
                                  resetPickers();
                                }}
                              >
                                <FolderIcon />
                                <span>{entry.name}</span>
                              </button>
                            </td>
                            <td className="text-subtle">{entry.isDirectory ? "Folder" : "File"}</td>
                            <td className="text-subtle">{entry.isDirectory ? "0 B" : "—"}</td>
                            <td className="text-right">
                              {entry.isDirectory ? (
                                <button
                                  type="button"
                                  className={styles.addBtn}
                                  onClick={() => openLibrary(entry)}
                                >
                                  Add library
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {entries.length === 0 ? (
                          <tr>
                            <td colSpan={4} className={styles.emptyFolder}>
                              This folder is empty.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  )}
                </div>

                {pendingDir ? (
                  <div className={styles.librarySheet}>
                    <h3 className={styles.librarySheetTitle}>Create media library</h3>
                    <p className={styles.librarySheetPath}>
                      {`\\\\${selected.host}\\${selected.share}${
                        pendingDir.path ? `\\${pendingDir.path.replace(/\//g, "\\")}` : ""
                      }`}
                    </p>
                    <form
                      className={styles.libraryForm}
                      onSubmit={(event) => {
                        event.preventDefault();
                        setBusy(true);
                        setError(null);
                        void addSmbLibrary({
                          serverId: selected.id,
                          path: pendingDir.path,
                          name: libraryName || pendingDir.name,
                          kind: libraryKind,
                        })
                          .then(() => {
                            setPendingDir(null);
                            setLibraryName("");
                          })
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : "Could not add library."),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      <div className={styles.field}>
                        <label htmlFor="lib-name">Library name</label>
                        <input
                          id="lib-name"
                          className={styles.inputLike}
                          value={libraryName}
                          onChange={(event) => setLibraryName(event.target.value)}
                          required
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="lib-kind">Content type</label>
                        <select
                          id="lib-kind"
                          className={styles.select}
                          value={libraryKind}
                          onChange={(event) => setLibraryKind(event.target.value as MediaLibraryKind)}
                        >
                          <option value="movies">Movies</option>
                          <option value="tv">TV series</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="submit" className={styles.uploadStart} disabled={busy}>
                          {busy ? "Creating…" : "Create library"}
                        </button>
                        <button type="button" className={styles.toolBtn} onClick={() => setPendingDir(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </AdminPageLayout>
  );
}

function ServerStatusBadge({ server }: { server: AdminSmbServer }) {
  if (server.lastError) {
    return (
      <span className={`${styles.badge} ${styles.badgeOffline}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Offline
      </span>
    );
  }
  if (server.lastOkAt) {
    return (
      <span className={`${styles.badge} ${styles.badgeOnline}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Connected
      </span>
    );
  }
  return <span className={`${styles.badge} ${styles.badgeIdle}`}>Not tested</span>;
}

function pathLooksLikeTv(value: string): boolean {
  return /\b(tv|series|season|episode|anime)\b/i.test(value);
}

function isVideoFileName(name: string): boolean {
  return /\.(mkv|mp4|avi|mov|wmv|m4v|ts|m2ts|webm|mpg|mpeg)$/i.test(name);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function browseErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not browse this share.";
  if (/failed to fetch/i.test(message)) {
    return "The folder list did not finish. Refresh the page after the API finishes restarting.";
  }
  return message;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input
        className={styles.inputLike}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <p className={styles.fieldHint}>{hint}</p> : null}
    </div>
  );
}

function ServerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.crumbSep} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#26bfb0]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z" />
    </svg>
  );
}
