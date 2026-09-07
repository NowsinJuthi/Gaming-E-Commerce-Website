"use client";

import { memo, useRef, useState } from "react";
import { uploadHomepageBanner } from "@/lib/api";

const BANNER_MAX_BYTES = 10 * 1024 * 1024;
const BANNER_ACCEPT =
  ".jpg,.jpeg,.webp,.gif,.png,.avif,image/jpeg,image/webp,image/gif,image/png,image/avif";

type Props = {
  onUploaded: (url: string) => void;
  label?: string;
  recommendedSize?: string;
};

export const BannerUploadField = memo(function BannerUploadField({
  onUploaded,
  label = "banner",
  recommendedSize,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > BANNER_MAX_BYTES) {
      setError("File must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const result = await uploadHomepageBanner(file);
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
        accept={BANNER_ACCEPT}
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
        {busy ? "Uploading…" : `Upload ${label}`}
      </button>
      <p className="text-xs text-subtle">
        {recommendedSize ? (
          <>
            Recommended size:{" "}
            <span className="font-medium text-foreground-muted">{recommendedSize}</span>
            . JPG, PNG, WebP, GIF, or AVIF — max 10 MB.
          </>
        ) : (
          <>JPG, PNG, WebP, GIF, or AVIF — max 10 MB. Wide banners (~4:1) work best.</>
        )}
      </p>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
});
