"use client";

import { memo, useRef, useState } from "react";
import { uploadSiteLogo, type LogoUploadVariant } from "@/lib/api";

const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_ACCEPT =
  ".webp,.gif,.png,.svg,.avif,image/webp,image/gif,image/png,image/svg+xml,image/avif";

type Props = {
  label: string;
  variant: LogoUploadVariant;
  onUploaded: (url: string) => void;
};

export const LogoUploadField = memo(function LogoUploadField({
  label,
  variant,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > LOGO_MAX_BYTES) {
      setError("File must be 5 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const result = await uploadSiteLogo(file, variant);
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
        accept={LOGO_ACCEPT}
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
        {busy ? "Uploading…" : `Upload ${label} logo`}
      </button>
      <p className="text-xs text-subtle">
        WebP, GIF, PNG, SVG, or AVIF — max 5 MB. Your file is saved exactly as
        uploaded (no background changes or re-encoding).
      </p>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
});
