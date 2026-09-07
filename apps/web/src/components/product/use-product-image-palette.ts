"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_IMAGE_PALETTE,
  extractImagePalette,
  getCachedImagePalette,
  type ImagePalette,
} from "@/lib/image-palette";

export function useProductImagePalette(src: string): {
  palette: ImagePalette;
  ready: boolean;
} {
  const [palette, setPalette] = useState<ImagePalette>(() =>
    src ? (getCachedImagePalette(src) ?? DEFAULT_IMAGE_PALETTE) : DEFAULT_IMAGE_PALETTE,
  );
  const [ready, setReady] = useState(() =>
    src ? !!getCachedImagePalette(src) : false,
  );

  useEffect(() => {
    if (!src) {
      setPalette(DEFAULT_IMAGE_PALETTE);
      setReady(false);
      return;
    }

    const cached = getCachedImagePalette(src);
    if (cached) {
      setPalette(cached);
      setReady(true);
      return;
    }

    setPalette(DEFAULT_IMAGE_PALETTE);
    setReady(false);

    let cancelled = false;
    void extractImagePalette(src).then((next) => {
      if (cancelled || !next) return;
      setPalette(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return { palette, ready };
}
