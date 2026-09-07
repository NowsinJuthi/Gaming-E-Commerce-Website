"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getEmailTemplatePreviewHtml, type EmailTemplateItem } from "@/lib/api";
import { resolveLogoSrc } from "@/lib/site-appearance";
import {
  buildEmailPreviewContent,
  hasCustomEmailTemplateContent,
  interpolateEmailTemplate,
  usesBuiltInRichHtmlPreview,
  EMAIL_PREVIEW_VARS,
  type EmailPreviewBranding,
} from "@/lib/email-template-preview";

type PreviewViewport = "mobile" | "desktop";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PhoneFrameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10 5h4" />
    </svg>
  );
}

function DesktopFrameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 20h8M12 17v3" />
    </svg>
  );
}

function ViewportToggle({
  value,
  onChange,
}: {
  value: PreviewViewport;
  onChange: (value: PreviewViewport) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5"
      role="tablist"
      aria-label="Preview viewport"
    >
      {(
        [
          ["mobile", "Mobile", PhoneFrameIcon],
          ["desktop", "Desktop", DesktopFrameIcon],
        ] as const
      ).map(([key, label, Icon]) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
              active
                ? "bg-teal-500/20 text-teal-200 shadow-sm ring-1 ring-teal-500/25"
                : "text-subtle hover:bg-white/[0.04] hover:text-foreground-muted"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function EmailPreviewBody({
  preview,
  branding,
  accent,
  compact,
  viewport,
}: {
  preview: ReturnType<typeof buildEmailPreviewContent>;
  branding: EmailPreviewBranding;
  accent: string;
  compact?: boolean;
  viewport: PreviewViewport;
}) {
  const isDesktop = viewport === "desktop";

  return (
    <div className="overflow-hidden rounded-[1rem] border border-white/5">
      <div
        className={`relative text-center ${
          isDesktop ? "px-10 py-10" : compact ? "px-6 py-6" : "px-6 py-8"
        }`}
        style={{
          background: `radial-gradient(circle at top, ${accent}55 0%, transparent 55%), linear-gradient(135deg, ${accent} 0%, #0b3d3a 52%, #071018 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSI0MCIgaGVpZ2h0PSI40IiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMCA0MGg0MFYwSDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDQwVjBoNDB2NDB6IiBmaWxsPSJub25lIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')] opacity-40" />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.24em] text-white/75">
          Official store
        </p>
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.storeName}
            className="relative mx-auto mt-3 h-10 object-contain"
          />
        ) : (
          <p
            className={`relative mt-2 font-extrabold tracking-tight text-white drop-shadow-sm ${
              isDesktop ? "text-4xl" : "text-3xl"
            }`}
          >
            {branding.storeName}
          </p>
        )}
        <p className="relative mt-2 text-sm leading-snug text-teal-50/90">
          {branding.tagline}
        </p>
      </div>

      <div
        className={`bg-[#0b1220] text-left ${
          isDesktop ? "px-10 py-9" : "px-6 py-7"
        }`}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: accent }}
        >
          {preview.sectionLabel}
        </p>
        <h4
          className={`mt-3 font-bold leading-tight tracking-tight text-white ${
            isDesktop ? "text-[2rem]" : "text-[1.65rem]"
          }`}
        >
          {preview.heading}
        </h4>
        <p className="mt-4 text-sm text-slate-300">{preview.greeting}</p>
        {preview.paragraphs.map((paragraph, index) => (
          <p
            key={`${paragraph}-${index}`}
            className="mt-3 text-sm leading-relaxed text-slate-300"
          >
            {paragraph}
          </p>
        ))}
        {preview.metaLines.length > 0 && (
          <div className="mt-5 space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
            {preview.metaLines.map((line) => (
              <p key={line} className="text-xs font-medium text-slate-400">
                {line}
              </p>
            ))}
          </div>
        )}
        {preview.button && (
          <div className="mt-6">
            <span
              className="inline-flex rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg shadow-black/25"
              style={{ backgroundColor: accent }}
            >
              {preview.button.label}
            </span>
            <p className="mt-2 truncate text-[10px] text-slate-500">
              {preview.button.url}
            </p>
          </div>
        )}
      </div>

      <div
        className={`border-t border-white/10 bg-[#080d16] ${
          isDesktop ? "px-10 py-5" : "px-6 py-4"
        }`}
      >
        <p className="text-[11px] leading-relaxed text-slate-500">
          {branding.footerText}
        </p>
      </div>
    </div>
  );
}

function RichHtmlEmailPreview({
  html,
}: {
  html: string;
}) {
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
      title="Email HTML preview"
      srcDoc={html}
      sandbox="allow-same-origin"
      scrolling="no"
      className="block w-full border-0 bg-[#0b1220]"
      style={{ height, minHeight: 200 }}
    />
  );
}

function FullscreenPreviewModal({
  open,
  onClose,
  subject,
  children,
}: {
  open: boolean;
  onClose: () => void;
  subject: string;
  children: ReactNode;
}) {
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
      className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Full email preview"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0a1018] px-4 py-3 md:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Full email preview
          </p>
          <p className="mt-0.5 truncate text-sm text-foreground">{subject}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="dashboard-pro-btn-ghost shrink-0 text-xs"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </div>
    </div>
  );
}

export function EmailTemplateLivePreview({
  template,
  branding,
  compact = false,
  fullWidth = false,
}: {
  template: EmailTemplateItem;
  branding: EmailPreviewBranding;
  compact?: boolean;
  /** Use full page width and show the entire email without clipping. */
  fullWidth?: boolean;
}) {
  const [viewport, setViewport] = useState<PreviewViewport>(
    fullWidth ? "desktop" : "mobile",
  );
  const [richHtml, setRichHtml] = useState<string | null>(null);
  const [richLoading, setRichLoading] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const useRichPreview = usesBuiltInRichHtmlPreview(template);

  useEffect(() => {
    if (!useRichPreview) {
      setRichHtml(null);
      setRichLoading(false);
      return;
    }

    let cancelled = false;
    setRichLoading(true);

    getEmailTemplatePreviewHtml(template.id)
      .then((res) => {
        if (!cancelled && res.available && res.html) {
          setRichHtml(res.html);
        } else if (!cancelled) {
          setRichHtml(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRichHtml(null);
      })
      .finally(() => {
        if (!cancelled) setRichLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [useRichPreview, template.id]);

  const preview = useMemo(
    () => buildEmailPreviewContent(template, branding),
    [template, branding],
  );

  const displaySubject = useMemo(() => {
    if (!useRichPreview) return preview.subject || "—";
    const vars = {
      ...EMAIL_PREVIEW_VARS,
      store_name: branding.storeName || EMAIL_PREVIEW_VARS.store_name,
    };
    return interpolateEmailTemplate(template.subject, vars) || preview.subject || "—";
  }, [useRichPreview, template.subject, branding.storeName, preview.subject]);

  const accent = branding.primaryColor || "#38bfb0";
  const isDesktop = viewport === "desktop";
  const ViewportIcon = isDesktop ? DesktopFrameIcon : PhoneFrameIcon;
  const hasCustom = hasCustomEmailTemplateContent(template);
  const layoutLabel = useRichPreview && richHtml
    ? "Thank-you receipt layout"
    : preview.usesBuiltIn
      ? "Built-in layout"
      : "Custom layout";

  const frameMaxWidth = fullWidth
    ? "max-w-3xl"
    : isDesktop
      ? "max-w-[720px]"
      : "max-w-[440px]";

  const renderPreviewContent = () => {
    if (useRichPreview && richLoading) {
      return (
        <div
          className="flex items-center justify-center rounded-[1rem] border border-white/5 bg-[#0b1220] text-sm text-subtle"
          style={{ minHeight: fullWidth ? 480 : 320 }}
        >
          Loading preview…
        </div>
      );
    }

    if (useRichPreview && richHtml) {
      return (
        <div className="rounded-[1rem] border border-white/5 bg-[#0b1220]">
          <RichHtmlEmailPreview html={richHtml} />
        </div>
      );
    }

    return (
      <EmailPreviewBody
        preview={preview}
        branding={branding}
        accent={accent}
        compact={compact}
        viewport={viewport}
      />
    );
  };

  return (
    <section className="shell-panel overflow-x-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-white/[0.02] px-4 py-4 md:px-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-500/15 to-teal-500/5 text-teal-300 shadow-inner">
            <EyeIcon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-semibold text-foreground">Live preview</h3>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {fullWidth
                ? "Full email layout — scroll to see everything"
                : "Rendered email with current content"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setFullscreenOpen(true)}
            className="dashboard-pro-btn-ghost text-[10px] font-semibold uppercase tracking-wide"
          >
            Full screen
          </button>
          <span className="rounded-full bg-teal-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-300 ring-1 ring-teal-500/20">
            Real-time
          </span>
          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-subtle">
            {layoutLabel}
          </span>
        </div>
      </div>

      <div className="bg-[#050810] p-4 md:p-5">
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Subject line
          </p>
          <p className="mt-1 truncate text-sm text-foreground">
            {displaySubject}
          </p>
        </div>

        <div className="mb-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-subtle">
            <ViewportIcon className="h-3.5 w-3.5" />
            {isDesktop ? "Desktop inbox preview" : "Mobile inbox preview"}
          </div>
          <ViewportToggle value={viewport} onChange={setViewport} />
        </div>

        <div
          className={`relative mx-auto transition-all duration-300 ease-out ${frameMaxWidth}`}
        >
          {isDesktop ? (
            <div className="rounded-xl border border-white/10 bg-[#101828] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              <div className="flex items-center gap-2 border-b border-white/10 bg-[#0c1424] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                <div className="ml-2 min-w-0 flex-1 truncate rounded-md border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-slate-400">
                  mail.client — {displaySubject}
                </div>
              </div>
              <div className="p-3">{renderPreviewContent()}</div>
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-white/10 bg-[#101828] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              {renderPreviewContent()}
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-[10px] text-subtle">
          {isDesktop ? "Desktop width" : "Mobile width"} ·{" "}
          {useRichPreview && richHtml
            ? "Full email height · customize heading/body to override"
            : hasCustom
              ? "Custom content preview"
              : "Built-in design · customize heading/body to override"}
        </p>
      </div>

      <FullscreenPreviewModal
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        subject={displaySubject}
      >
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101828] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#0c1424] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
            <div className="ml-2 min-w-0 flex-1 truncate rounded-md border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-slate-400">
              mail.client — {displaySubject}
            </div>
          </div>
          <div className="p-3">{renderPreviewContent()}</div>
        </div>
      </FullscreenPreviewModal>
    </section>
  );
}

export function EmailTemplateMiniPreview({
  template,
  branding,
}: {
  template: EmailTemplateItem;
  branding?: Pick<EmailPreviewBranding, "storeName" | "primaryColor" | "logoUrl">;
}) {
  const accent = branding?.primaryColor || "#38bfb0";
  const store = branding?.storeName || "UniQbd";
  const logoSrc = branding?.logoUrl?.trim()
    ? resolveLogoSrc(branding.logoUrl.trim())
    : "";

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0a101a]">
      <div
        className="px-3 py-2.5"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, #0d4f4a 100%)`,
        }}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={store}
            className="mx-auto h-5 max-w-full object-contain"
          />
        ) : (
          <p className="truncate text-[10px] font-bold text-white/90">{store}</p>
        )}
      </div>
      <div className="space-y-1 px-3 py-2.5">
        <p className="truncate text-[11px] font-semibold text-white">
          {template.label}
        </p>
        <p className="line-clamp-2 text-[10px] leading-relaxed text-slate-400">
          {template.subject || "No subject configured"}
        </p>
      </div>
    </div>
  );
}
