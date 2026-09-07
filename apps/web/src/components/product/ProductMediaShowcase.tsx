"use client";

import Image from "next/image";
import { type ReactNode } from "react";

import { ProductMediaBackground } from "@/components/product/ProductMediaBackground";



type ProductMediaShowcaseProps = {

  imageUrl?: string;

  alt: string;

  compact?: boolean;

  className?: string;

  overlay?: ReactNode;

};



export function ProductMediaShowcase({

  imageUrl,

  alt,

  compact = false,

  className = "",

  overlay,

}: ProductMediaShowcaseProps) {

  return (

    <div

      className={[

        compact ? "" : "product-pdp-card",

        "product-pdp-media-shell",

        compact ? "product-pdp-media-shell--compact" : "",

        className,

      ]

        .filter(Boolean)

        .join(" ")}

    >

      <ProductMediaBackground
        compact={compact}
        imageUrl={imageUrl}
        showBorder={!compact}
        staticPalette={!compact}
      />

      <div className="product-pdp-media-stage">

        <div className="product-pdp-media-halo" aria-hidden />

        <div className="product-pdp-media-ring" aria-hidden />

        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={alt}
            width={900}
            height={900}
            className="product-pdp-media-img"
            priority
            unoptimized
          />
        ) : (

          <div className="product-pdp-media-fallback">No image</div>

        )}

        <div className="product-pdp-media-pedestal" aria-hidden />

      </div>

      {overlay ? <div className="product-pdp-media-overlay">{overlay}</div> : null}

    </div>

  );

}


