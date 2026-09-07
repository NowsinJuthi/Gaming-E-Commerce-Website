"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloudUploadIcon } from "@/components/admin/icons";
import { adminGetLastPublish, adminPublishSite, revalidateStorefront } from "@/lib/api";
import { adminToast } from "@/lib/admin-toast";

type Props = {
  /** Icon-only for mobile header; labeled pill for desktop admin topbar. */
  variant?: "compact" | "labeled";
  className?: string;
};

export function AdminPublishControl({
  variant = "labeled",
  className = "",
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    adminGetLastPublish()
      .then((res) => setLastPublishedAt(res.at))
      .catch(() => undefined);
  }, []);

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await adminPublishSite();
      const revalidated = await revalidateStorefront();
      setLastPublishedAt(res.at);
      setPublishOpen(false);
      if (revalidated) {
        adminToast("Site published successfully", true);
      } else {
        adminToast(
          "API cache cleared, but page cache refresh failed. Wait 1–2 min or hard refresh.",
          false,
        );
      }
      router.refresh();
    } catch {
      adminToast("Publish failed. Please try again.", false);
    } finally {
      setPublishing(false);
    }
  }

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        onClick={() => setPublishOpen(true)}
        className={
          className ||
          "shell-icon-btn flex items-center justify-center text-emerald-600 dark:text-emerald-400"
        }
        aria-label="Publish changes"
        title="Publish changes"
      >
        <CloudUploadIcon className="h-5 w-5 shrink-0" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setPublishOpen(true)}
        className={
          className ||
          "flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:border-emerald-400/30 dark:text-emerald-400 dark:hover:bg-emerald-400/15 sm:px-3"
        }
        aria-label="Publish changes"
      >
        <CloudUploadIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Publish</span>
      </button>
    );

  const publishModal =
    mounted && publishOpen ? (
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 pb-safe">
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => !publishing && setPublishOpen(false)}
        />
        <div className="relative z-10 w-full max-w-md max-h-[min(90dvh,32rem)] overflow-y-auto rounded-2xl border border-border bg-elevated shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border px-6 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
              <CloudUploadIcon className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Publish Changes
              </h2>
              <p className="text-xs text-foreground-muted">
                Push all pending changes to the live site
              </p>
            </div>
          </div>

          <div className="space-y-3 px-6 py-5 text-sm text-foreground-muted">
            <p>
              This will clear all cached pages and settings, then notify every
              connected visitor to refresh their data.
            </p>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                Product pages, lists, and homepage sections
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                Store settings and appearance
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                SEO and meta settings
              </li>
            </ul>
            {lastPublishedAt ? (
              <p className="border-t border-border pt-3 text-xs text-foreground-muted">
                Last published:{" "}
                <span className="font-medium text-foreground">
                  {new Date(lastPublishedAt).toLocaleString()}
                </span>
              </p>
            ) : (
              <p className="border-t border-border pt-3 text-xs text-foreground-muted">
                Never published yet.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={() => setPublishOpen(false)}
              disabled={publishing}
              className="rounded-lg px-4 py-2 text-sm font-medium text-foreground-muted transition hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {publishing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Publishing…
                </>
              ) : (
                <>
                  <CloudUploadIcon className="h-3.5 w-3.5" />
                  Publish Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      {trigger}
      {publishModal ? createPortal(publishModal, document.body) : null}
    </>
  );
}
