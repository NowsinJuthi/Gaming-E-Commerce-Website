"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  type AdminSmbServer,
  type MediaLibraryKind,
  type SmbBrowseEntry,
} from "@/lib/media-ops-api";

export default function AdminFileManagerPage() {
  const [servers, setServers] = useState<AdminSmbServer[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browsePath, setBrowsePath] = useState("");
  const [entries, setEntries] = useState<SmbBrowseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  const selected = useMemo(
    () => servers.find((server) => server.id === selectedId) ?? null,
    [servers, selectedId],
  );

  const reload = useCallback(async () => {
    const data = await listSmbServers();
    setServers(data.servers);
  }, []);

  const loadBrowse = useCallback(async (id: string, path: string) => {
    const data = await browseSmb(id, path);
    setEntries(data.entries);
  }, []);

  useEffect(() => {
    reload()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load Samba servers."),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    if (!selectedId) return;
    void loadBrowse(selectedId, browsePath).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not browse this share."),
    );
  }, [selectedId, browsePath, loadBrowse]);

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

  const parentPath = browsePath.includes("/")
    ? browsePath.slice(0, browsePath.lastIndexOf("/"))
    : "";

  return (
    <AdminPageLayout
      section="Operations"
      title="Samba file manager"
      description="Browse configured Samba shares and add a folder as a media library."
      icon={BoxIcon}
      backHref="/admin"
      backLabel="Dashboard"
      action={
        <button type="button" className="dashboard-pro-btn shrink-0" onClick={() => setShowConnect((v) => !v)}>
          {showConnect ? "Close" : "Connect server"}
        </button>
      }
    >
      <div className={styles.layout}>
        {error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
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
                <Field label="Share name" value={share} onChange={setShare} placeholder="Data-Storage" required />
                <Field label="Username" value={username} onChange={setUsername} placeholder="samba-user" required />
                <Field label="Password" value={password} onChange={setPassword} type="password" required />
                <Field label="Domain (optional)" value={domain} onChange={setDomain} placeholder="WORKGROUP" />
                <button type="submit" className="dashboard-pro-btn disabled:opacity-50" disabled={busy}>
                  {busy ? "Connecting…" : "Save & connect"}
                </button>
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
                      setError(null);
                    }}
                  >
                    <span className={styles.serverMeta}>
                      <span className={styles.serverName}>{server.name}</span>
                      <span className={styles.serverHost}>
                        {server.host}/{server.share}
                      </span>
                      <span className="mt-1.5 inline-flex text-xs text-subtle">
                        {server.lastError ? "Needs password" : "Ready"}
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
                  Choose a server from the sidebar to browse folders or create a media library.
                </p>
              </div>
            ) : (
              <div>
                <div className={styles.toolbar}>
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost"
                    disabled={!browsePath}
                    onClick={() => setBrowsePath(parentPath)}
                  >
                    Up
                  </button>
                  <p className={styles.uncPath}>
                    \\{selected.host}\{selected.share}
                    {browsePath ? `\\${browsePath}` : ""}
                  </p>
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost"
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
                    Delete
                  </button>
                </div>
                {selected.lastError ? (
                  <form
                    className="flex flex-wrap items-end gap-2 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveSmbPassword(selected.id, updatePassword)
                        .then(async () => {
                          setUpdatePassword("");
                          await reload();
                          await loadBrowse(selected.id, browsePath);
                        })
                        .catch((err: unknown) =>
                          setError(err instanceof Error ? err.message : "Could not save password."),
                        );
                    }}
                  >
                    <label className="text-xs">
                      Samba password
                      <input
                        className={styles.inputLike}
                        type="password"
                        value={updatePassword}
                        onChange={(event) => setUpdatePassword(event.target.value)}
                        required
                      />
                    </label>
                    <button type="submit" className="dashboard-pro-btn disabled:opacity-50">
                      Save password
                    </button>
                  </form>
                ) : null}
                <div className={styles.fileTableWrap}>
                  <table className={styles.fileTable}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
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
                              onClick={() => entry.isDirectory && setBrowsePath(entry.path)}
                            >
                              <span>{entry.name}</span>
                            </button>
                          </td>
                          <td>{entry.isDirectory ? "Folder" : "File"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {entries.length === 0 ? (
                    <p className={styles.emptyFolder}>This folder is empty or not reachable.</p>
                  ) : null}
                </div>
                <form
                  className={styles.libraryForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addSmbLibrary({
                      serverId: selected.id,
                      path: browsePath,
                      name: libraryName || selected.name,
                      kind: libraryKind,
                    })
                      .then(() => {
                        setLibraryName("");
                        setError(null);
                      })
                      .catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : "Could not add library."),
                      );
                  }}
                >
                  <label className="text-xs">
                    Library name
                    <input
                      className={styles.inputLike}
                      value={libraryName}
                      onChange={(event) => setLibraryName(event.target.value)}
                      placeholder={selected.name}
                      required
                    />
                  </label>
                  <label className="text-xs">
                    Kind
                    <select
                      className={styles.select}
                      value={libraryKind}
                      onChange={(event) => setLibraryKind(event.target.value as MediaLibraryKind)}
                    >
                      <option value="movies">Movies</option>
                      <option value="tv">TV</option>
                    </select>
                  </label>
                  <button type="submit" className="dashboard-pro-btn disabled:opacity-50">
                    Add as media library
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminPageLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
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
    </div>
  );
}
