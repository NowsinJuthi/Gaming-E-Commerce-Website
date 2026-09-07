"use client";

import { memo, useRef, useState } from "react";
import { CloudUploadIcon } from "@/components/admin/icons";
import { uploadSiteLogo } from "@/lib/api";

const FAVICON_MAX_BYTES = 5 * 1024 * 1024;
const FAVICON_ACCEPT =
  ".ico,.webp,.gif,.png,.svg,.avif,image/x-icon,image/vnd.microsoft.icon,image/webp,image/gif,image/png,image/svg+xml,image/avif";

type Props = {
  onUploaded: (url: string) => void;
};

export const FaviconUploadField = memo(function FaviconUploadField({
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > FAVICON_MAX_BYTES) {
      setError("File must be 5 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const result = await uploadSiteLogo(file, "admin-favicon");
      onUploaded(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={FAVICON_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="admin-logos-upload-btn disabled:opacity-50"
      >
        <CloudUploadIcon className="h-4 w-4 shrink-0" aria-hidden />
        {busy ? "Uploading…" : "Upload admin favicon"}
      </button>
      <p className="text-xs text-subtle">
        Best: 32×32 PNG or ICO with multiple sizes. Browser tabs always display
        favicons at 16–32 px regardless of the original image size. Max 5 MB.
      </p>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
});
