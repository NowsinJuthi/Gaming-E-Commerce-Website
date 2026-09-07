"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/admin/icons";

function EmailHtmlPreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);

  const syncHeight = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const next = Math.ceil(
      Math.max(
        doc.documentElement.scrollHeight,
        doc.documentElement.offsetHeight,
        doc.body?.scrollHeight ?? 0,
        doc.body?.offsetHeight ?? 0,
      ),
    );
    if (next > 0) setHeight(next);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let resizeObserver: ResizeObserver | undefined;

    const handleLoad = () => {
      syncHeight();
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      resizeObserver = new ResizeObserver(() => syncHeight());
      resizeObserver.observe(doc.body);
      doc.querySelectorAll("img").forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", syncHeight, { once: true });
        }
      });
      window.setTimeout(syncHeight, 150);
      window.setTimeout(syncHeight, 600);
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserver?.disconnect();
    };
  }, [html, syncHeight]);

  return (
    <iframe
      ref={iframeRef}
      title="Sent email preview"
      srcDoc={html}
      sandbox="allow-same-origin"
      scrolling="no"
      className="block w-full border-0 bg-[#0b1220]"
      style={{ height, minHeight: 200 }}
    />
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  subject?: string;
  recipient?: string;
  html?: string;
  note?: string;
  loading?: boolean;
  error?: string | null;
};

export function AdminEmailLogPreviewModal({
  open,
  onClose,
  subject,
  recipient,
  html,
  note,
  loading = false,
  error = null,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Sent email preview"
      onClick={onClose}
    >
      <div
        className="admin-email-log-preview-modal flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-checkout-surface-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
              Sent email
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {subject || "Email preview"}
            </p>
            {recipient ? (
              <p className="mt-1 truncate text-xs text-foreground-muted">
                To: {recipient}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="dashboard-pro-btn-ghost shrink-0 p-2"
            aria-label="Close preview"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-subtle">
              Loading email preview…
            </p>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : html ? (
            <EmailHtmlPreview html={html} />
          ) : (
            <p className="py-10 text-center text-sm text-subtle">
              Email preview is not available.
            </p>
          )}
          {note && !loading && !error ? (
            <p className="mt-3 text-xs text-foreground-muted">{note}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
