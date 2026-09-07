"use client";

import type { ReactNode } from "react";
import { BoxIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { TiltParallaxCard } from "@/components/ui/TiltParallaxCard";
import type { ProductGalleryImage } from "@/lib/product-page";
import { resolveMediaSrc } from "@/lib/site-appearance";

function ProductTitleIcon({
  imageUrl,
}: {
  imageUrl?: string;
}) {
  if (imageUrl) {
    return (
      <span className="product-pdp-title-icon" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" loading="eager" decoding="async" />
      </span>
    );
  }

  return <BoxIcon className="h-4 w-4" strokeWidth={2} aria-hidden />;
}

const GALLERY_PLACEHOLDER_ICON = (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10.5" r="1.5" />
    <path d="M21 15l-5-5L5 19" />
  </svg>
);

type Props = {
  productTitle: string;
  images: ProductGalleryImage[];
  activeUrl: string;
  activeAlt: string;
  onSelect: (url: string) => void;
  actions?: ReactNode;
  actionsNote?: ReactNode;
};

export function ProductDetailImageGallery({
  productTitle,
  images,
  activeUrl,
  activeAlt,
  onSelect,
  actions,
  actionsNote,
}: Props) {
  const displayImages =
    images.length > 0
      ? images
      : activeUrl
        ? [
            {
              id: "fallback",
              url: activeUrl,
              alt: activeAlt,
              source: "media" as const,
            },
          ]
        : [];

  const previewUrl = resolveMediaSrc(activeUrl || displayImages[0]?.url || "");
  const imageCount = displayImages.length;

  return (
    <div className="customer-panel min-w-0">
      <ProductFormOrderCard
        className="admin-product-form-section product-pdp-image-gallery"
        icon={<ProductTitleIcon imageUrl={previewUrl || undefined} />}
        title={productTitle}
        subtitle={
          imageCount > 1 ? `${imageCount} images` : undefined
        }
      >
        <div className="space-y-4">
          <div className="admin-product-form-media-card product-pdp-image-gallery-frame overflow-hidden rounded-xl border border-border bg-sunken">
            <div className="relative aspect-square product-pdp-image-gallery-stage">
              {previewUrl ? (
                <TiltParallaxCard
                  className="product-pdp-image-tilt"
                  innerClassName="product-pdp-image-tilt-inner"
                  maxTilt={12}
                  maxParallax={18}
                  showGlare={false}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={activeAlt}
                    className="product-pdp-image-tilt-img"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                </TiltParallaxCard>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-subtle">
                  {GALLERY_PLACEHOLDER_ICON}
                  <p className="text-sm font-medium text-foreground-muted">
                    No product image
                  </p>
                </div>
              )}
            </div>
          </div>

          {displayImages.length > 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {displayImages.map((item, index) => {
                const itemUrl = resolveMediaSrc(item.url);
                const active = itemUrl === previewUrl;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={
                      item.source === "variation" && item.packageName
                        ? `${item.packageName} package image`
                        : item.alt || `Product image ${index + 1}`
                    }
                    aria-pressed={active}
                    onClick={() => onSelect(item.url)}
                    className={`admin-product-form-media-card product-pdp-image-gallery-thumb overflow-hidden rounded-xl border bg-sunken text-left transition ${
                      active
                        ? "product-pdp-image-gallery-thumb--active"
                        : "border-border"
                    }`}
                  >
                    <div className="relative aspect-square product-pdp-image-gallery-stage">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={itemUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      {index === 0 ? (
                        <span className="absolute left-2 top-2 rounded-md bg-teal-500/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          Main
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {actions ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
              {actions}
              {actionsNote}
            </div>
          ) : null}
        </div>
      </ProductFormOrderCard>
    </div>
  );
}
