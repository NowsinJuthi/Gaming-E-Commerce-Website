"use client";

import { type CSSProperties } from "react";
import { DEFAULT_IMAGE_PALETTE } from "@/lib/image-palette";
import { useProductImagePalette } from "@/components/product/use-product-image-palette";

type ProductMediaBackgroundProps = {
  imageUrl?: string;
  compact?: boolean;
  fill?: boolean;
  showBorder?: boolean;
  /** Stable colors on product cards — prevents light→dark flash */
  staticPalette?: boolean;
  className?: string;
};

export function ProductMediaBackground({
  imageUrl,
  compact = false,
  fill = false,
  showBorder = true,
  staticPalette = false,
  className = "",
}: ProductMediaBackgroundProps) {
  const { palette: imagePalette, ready: paletteReady } = useProductImagePalette(
    staticPalette ? "" : (imageUrl ?? ""),
  );

  const palette = staticPalette ? DEFAULT_IMAGE_PALETTE : imagePalette;
  const isPaletteReady = staticPalette ? !!imageUrl : paletteReady;

  const mediaStyle = {
    "--pdp-media-c1": palette.primary,
    "--pdp-media-c2": palette.secondary,
    "--pdp-media-c3": palette.accent,
  } as CSSProperties;

  return (
    <div
      className={[
        "product-pdp-media",
        imageUrl ? "product-pdp-media--tonal" : "",
        imageUrl && isPaletteReady ? "product-pdp-media--palette-ready" : "",
        staticPalette ? "product-pdp-media--static-palette" : "",
        compact ? "product-pdp-media--compact" : "",
        fill ? "product-pdp-media--fill" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={mediaStyle}
      aria-hidden
    >
      {showBorder ? <div className="product-pdp-media-border" /> : null}
      {imageUrl ? (
        <div className="product-pdp-media-tonal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="product-pdp-media-tonal-img"
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}
      <div className="product-pdp-media-bg">
        <div className="product-pdp-media-gradient" />
        <div className="product-pdp-media-gradient-mesh" />
        <div className="product-pdp-media-aurora" />
        <div className="product-pdp-corner-node product-pdp-corner-node--tl">
          <div className="product-pdp-corner-beam product-pdp-corner-beam--tl" />
        </div>
        <div className="product-pdp-corner-node product-pdp-corner-node--tr">
          <div className="product-pdp-corner-beam product-pdp-corner-beam--tr" />
        </div>
        <div className="product-pdp-corner-node product-pdp-corner-node--bl">
          <div className="product-pdp-corner-beam product-pdp-corner-beam--bl" />
        </div>
        <div className="product-pdp-corner-node product-pdp-corner-node--br">
          <div className="product-pdp-corner-beam product-pdp-corner-beam--br" />
        </div>
        <div className="product-pdp-media-grid" />
        <div className="product-pdp-media-spotlight" />
        <div className="product-pdp-media-shimmer" />
        <div className="product-pdp-media-noise" />
        <div className="product-pdp-media-vignette" />
      </div>
    </div>
  );
}
