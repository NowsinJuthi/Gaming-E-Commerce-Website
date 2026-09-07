"use client";

import { useRef, useState } from "react";
import { uploadBlogImage } from "@/lib/api";
import {
  BLOG_IMAGE_TARGET_HEIGHT,
  BLOG_IMAGE_TARGET_SIZE_LABEL,
  BLOG_IMAGE_TARGET_WIDTH,
  BLOG_IMAGE_UPLOAD_HINT,
  formatBlogImageSavedLabel,
} from "@/lib/blog-image-spec";
import { resolveMediaSrc } from "@/lib/site-appearance";

const IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif";
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

type SavedImageMeta = {
  width: number;
  height: number;
  sizeBytes?: number;
};

type BlogImagePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
};

function imageErrorFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  (e.target as HTMLImageElement).src =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' fill='%23334155'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='12'%3EInvalid URL%3C/text%3E%3C/svg%3E";
}

export function BlogImagePicker({
  id,
  label,
  value,
  onChange,
  required = false,
  placeholder = "/api/uploads/blog/example.webp",
  hint,
}: BlogImagePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [savedMeta, setSavedMeta] = useState<SavedImageMeta | null>(null);

  const preview = resolveMediaSrc(value.trim());
  const outputSizeLabel = `${BLOG_IMAGE_TARGET_SIZE_LABEL} px`;
  const savedSizeMismatch =
    savedMeta != null &&
    (savedMeta.width !== BLOG_IMAGE_TARGET_WIDTH ||
      savedMeta.height !== BLOG_IMAGE_TARGET_HEIGHT);

  function validateUrlInput(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError(null);
      return true;
    }
    if (trimmed.startsWith("/api/uploads/")) {
      setUrlError(null);
      return true;
    }
    try {
      new URL(trimmed);
      setUrlError(null);
      return true;
    } catch {
      setUrlError("Enter a valid image URL (https://… or /api/uploads/…)");
      return false;
    }
  }

  async function handleFile(file: File) {
    if (file.size > IMAGE_MAX_BYTES) {
      setUrlError("Image must be 10 MB or smaller.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUrlError("Please choose an image file.");
      return;
    }
    setUploadBusy(true);
    setUrlError(null);
    setUploadNote(null);
    try {
      const result = await uploadBlogImage(file);
      onChange(result.url);
      const meta: SavedImageMeta = {
        width: result.width ?? 1600,
        height: result.height ?? BLOG_IMAGE_TARGET_HEIGHT,
        sizeBytes: result.sizeBytes,
      };
      setSavedMeta(meta);
      setUploadNote(formatBlogImageSavedLabel(meta));
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelCls}>
        {label}
        {required ? " *" : ""}
      </label>

      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          className="admin-input min-w-0 flex-1"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            validateUrlInput(e.target.value);
            setSavedMeta(null);
            setUploadNote(null);
          }}
          placeholder={placeholder}
          required={required}
        />
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          className="btn-secondary btn-secondary-sm shrink-0"
          disabled={uploadBusy}
          onClick={() => fileRef.current?.click()}
        >
          {uploadBusy ? "Uploading…" : "Upload"}
        </button>
      </div>

      <p className="text-xs text-subtle">{hint ?? BLOG_IMAGE_UPLOAD_HINT}</p>

      <p className="blog-image-picker-target-size" aria-label="Blog image output size">
        <span className="blog-image-picker-target-size__label">Output size</span>
        <span className="blog-image-picker-target-size__value">
          {BLOG_IMAGE_TARGET_SIZE_LABEL} px · WebP
        </span>
      </p>

      {urlError ? (
        <p className="text-xs text-red-400" role="alert">
          {urlError}
        </p>
      ) : null}

      {uploadNote ? (
        <p className="text-xs text-emerald-300/90" role="status">
          {uploadNote}
        </p>
      ) : null}

      {savedSizeMismatch && savedMeta ? (
        <p className="text-xs text-amber-300/90" role="status">
          Last upload saved as {savedMeta.width}×{savedMeta.height} px. Re-upload to
          convert to {BLOG_IMAGE_TARGET_SIZE_LABEL} px.
        </p>
      ) : null}

      {preview ? (
        <div className="blog-image-picker-preview mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`${label} preview`}
            className="blog-image-picker-preview__img"
            onError={imageErrorFallback}
          />
          <p className="mt-1.5 text-[10px] text-subtle">
            Preview frame · Target {outputSizeLabel}
          </p>
        </div>
      ) : null}
    </div>
  );
}
