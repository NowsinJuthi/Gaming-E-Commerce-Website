"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { uploadProductImage } from "@/lib/api";
import { resolveMediaSrc } from "@/lib/site-appearance";

export type ProductImageItem = {
  id: string;
  url: string;
  alt: string;
};

const IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif";
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ALT_MAX_LENGTH = 125;

function newId() {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** SEO-friendly alt text suggestion from product title + image position. */
export function suggestProductImageAlt(
  productTitle: string,
  index: number,
  total = 1,
): string {
  const title = productTitle.trim();
  if (!title) return "";
  if (total <= 1 || index === 0) return title.slice(0, ALT_MAX_LENGTH);
  const suffix = ` - image ${index + 1}`;
  const maxTitle = ALT_MAX_LENGTH - suffix.length;
  return `${title.slice(0, Math.max(1, maxTitle))}${suffix}`;
}

export function parseMediaItems(raw: string): ProductImageItem[] {
  return raw
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter(Boolean)
    .map((url) => ({ id: newId(), url, alt: "" }));
}

export function serializeMediaItems(items: ProductImageItem[]): string {
  return items.map((i) => i.url).join("\n");
}

type ProductImageGalleryProps = {
  items: ProductImageItem[];
  onChange: (
    items:
      | ProductImageItem[]
      | ((prev: ProductImageItem[]) => ProductImageItem[]),
  ) => void;
  /** Used to auto-suggest accessible alt text for SEO. */
  productTitle?: string;
};

function imageErrorFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  (e.target as HTMLImageElement).src =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' fill='%23334155'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='12'%3EInvalid URL%3C/text%3E%3C/svg%3E";
}

export function ProductImageGallery({
  items,
  onChange,
  productTitle = "",
}: ProductImageGalleryProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlAltDraft, setUrlAltDraft] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const missingAltCount = useMemo(
    () => items.filter((item) => item.url.trim() && !item.alt.trim()).length,
    [items],
  );

  function suggestAltForIndex(index: number, total = items.length): string {
    return suggestProductImageAlt(productTitle, index, total);
  }

  function addUrl(url: string, alt = ""): boolean {
    const trimmed = resolveMediaSrc(url.trim());
    if (!trimmed) return false;
    const isUploadPath = trimmed.startsWith("/api/uploads/");
    if (!isUploadPath) {
      try {
        new URL(trimmed);
      } catch {
        setUrlError("Enter a valid image URL (https://… or /api/uploads/…)");
        return false;
      }
    }

    if (items.some((i) => resolveMediaSrc(i.url.trim()) === trimmed)) {
      setUrlError("This image is already in the product gallery.");
      return false;
    }

    const nextIndex = items.length;
    const resolvedAlt =
      alt.trim() ||
      suggestAltForIndex(nextIndex, nextIndex + 1);

    onChange([
      ...items,
      { id: newId(), url: trimmed, alt: resolvedAlt },
    ]);
    setUrlDraft("");
    setUrlAltDraft("");
    setUrlError(null);
    return true;
  }

  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function updateAlt(id: string, alt: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, alt } : i)));
  }

  function applySuggestedAlt(id: string, index: number) {
    const suggestion = suggestAltForIndex(index);
    if (!suggestion) return;
    updateAlt(id, suggestion);
  }

  function autoFillAllAltText() {
    if (!productTitle.trim()) return;
    onChange(
      items.map((item, index) =>
        item.alt.trim()
          ? item
          : { ...item, alt: suggestAltForIndex(index) },
      ),
    );
  }

  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= items.length) return;
    const a = items[idx];
    const b = items[next];
    if (!a || !b) return;
    const copy = [...items];
    copy[idx] = b;
    copy[next] = a;
    onChange(copy);
  }

  async function onFileSelect(file: File | undefined) {
    if (!file) return;
    setUrlError(null);
    if (!file.type.startsWith("image/")) {
      setUrlError("Please choose an image file.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setUrlError("Image must be 10 MB or smaller.");
      return;
    }
    setUploadBusy(true);
    try {
      const result = await uploadProductImage(file);
      addUrl(result.url);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <ProductFormOrderCard
      className="admin-product-form-section"
      icon={
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10.5" r="1.5" />
          <path d="M21 15l-5-5L5 19" />
        </svg>
      }
      title="Product images"
      subtitle="First image is the main product photo. Add alt text for SEO and accessibility."
      showBody={open}
      action={
        <button
          type="button"
          className="rich-text-section-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close product images" : "Open product images"}
          aria-expanded={open}
        >
          <ChevronIcon
            className={`rich-text-section-toggle-icon${open ? " rich-text-section-toggle-icon--open" : ""}`}
          />
        </button>
      }
    >
      <div className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
              Product gallery
            </p>
            {items.length > 0 ? (
              <p className="mt-1 text-xs text-foreground-muted">
                {missingAltCount > 0
                  ? `${missingAltCount} image${missingAltCount === 1 ? "" : "s"} missing alt text`
                  : "All images have alt text"}
              </p>
            ) : null}
          </div>
          {items.length > 0 && missingAltCount > 0 ? (
            <button
              type="button"
              onClick={autoFillAllAltText}
              disabled={!productTitle.trim()}
              className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
              title={
                productTitle.trim()
                  ? "Fill empty alt fields from the product title"
                  : "Add a product title first"
              }
            >
              Auto-fill alt text
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.length > 0 ? (
            items.map((item, index) => {
              const hasAlt = Boolean(item.alt.trim());
              const suggestion = suggestAltForIndex(index);

              return (
              <div
                key={item.id}
                className="admin-product-form-media-card overflow-hidden rounded-xl border border-border bg-sunken"
              >
                <div className="relative aspect-[4/3] bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaSrc(item.url)}
                    alt={item.alt || `Product image ${index + 1}`}
                    className="h-full w-full object-cover"
                    onError={imageErrorFallback}
                  />
                  {index === 0 && (
                    <span className="absolute left-2 top-2 rounded-md bg-teal-500/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Main
                    </span>
                  )}
                  {!hasAlt ? (
                    <span className="absolute right-2 top-2 rounded-md bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      No alt
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 p-3">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label
                        htmlFor={`product-image-alt-${item.id}`}
                        className="text-[10px] font-semibold uppercase tracking-wider text-subtle"
                      >
                        Alt text
                      </label>
                      <span
                        className={`text-[10px] font-semibold uppercase ${
                          hasAlt ? "text-emerald-300" : "text-amber-300"
                        }`}
                      >
                        {hasAlt ? "SEO ready" : "Required for SEO"}
                      </span>
                    </div>
                    <input
                      id={`product-image-alt-${item.id}`}
                      value={item.alt}
                      onChange={(e) => updateAlt(item.id, e.target.value)}
                      placeholder={
                        suggestion ||
                        "Describe the image for search engines and screen readers"
                      }
                      maxLength={ALT_MAX_LENGTH}
                      className="admin-input w-full text-xs text-foreground"
                    />
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-subtle">
                        {item.alt.length}/{ALT_MAX_LENGTH} characters
                      </p>
                      {!hasAlt && suggestion ? (
                        <button
                          type="button"
                          onClick={() => applySuggestedAlt(item.id, index)}
                          className="text-[11px] font-semibold text-brand hover:underline"
                        >
                          Use suggestion
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(item.id, -1)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground-muted hover:bg-muted disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => move(item.id, 1)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground-muted hover:bg-muted disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="dashboard-pro-btn-ghost ml-auto text-xs text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
            })
          ) : (
            <div className="admin-product-form-media-card overflow-hidden rounded-xl border border-dashed border-border-strong bg-sunken/40 sm:col-span-2">
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-4 text-center text-subtle">
                <svg
                  viewBox="0 0 24 24"
                  className="h-8 w-8 opacity-60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="10.5" r="1.5" />
                  <path d="M21 15l-5-5L5 19" />
                </svg>
                <p className="text-sm font-medium text-foreground-muted">
                  No product images yet
                </p>
                <p className="max-w-sm text-xs">
                  Upload or paste a URL below.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="admin-product-form-dropzone rounded-xl border border-dashed border-border-strong bg-sunken/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">
          Add image
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={urlDraft}
            onChange={(e) => {
              setUrlDraft(e.target.value);
              setUrlError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl(urlDraft, urlAltDraft);
              }
            }}
            placeholder="https://example.com/product-image.jpg"
            className="admin-input flex-1 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => addUrl(urlDraft, urlAltDraft)}
            className="btn-primary shrink-0"
          >
            Add URL
          </button>
          <button
            type="button"
            disabled={uploadBusy}
            onClick={() => fileRef.current?.click()}
            className="dashboard-pro-btn-ghost shrink-0 disabled:opacity-50"
          >
            {uploadBusy ? "Uploading…" : "Upload file"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => void onFileSelect(e.target.files?.[0])}
          />
        </div>
        <div className="mt-3">
          <label
            htmlFor="product-image-url-alt"
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle"
          >
            Alt text (optional)
          </label>
          <input
            id="product-image-url-alt"
            value={urlAltDraft}
            onChange={(e) => setUrlAltDraft(e.target.value)}
            placeholder={
              suggestAltForIndex(items.length) ||
              "Describe the image — auto-filled from title if left empty"
            }
            maxLength={ALT_MAX_LENGTH}
            className="admin-input w-full text-sm text-foreground"
          />
        </div>
        {urlError && (
          <p className="mt-2 text-xs text-rose-400">{urlError}</p>
        )}
        <p className="mt-2 text-xs text-subtle">
          Paste a hosted URL or upload JPG, PNG, WebP, GIF, or AVIF (max 10 MB).
          Alt text is suggested from the product title when available.
        </p>
      </div>
    </ProductFormOrderCard>
  );
}
