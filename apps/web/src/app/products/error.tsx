"use client";

import { HOME_CONTAINER_CLS } from "@/components/home/home-container";
import { useEffect } from "react";

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error in development without crashing
    console.error("[/products] Page error:", error);
  }, [error]);

  return (
    <div className={`${HOME_CONTAINER_CLS} py-10`}>
      <div className="card-premium border-dashed p-12 text-center">
        <p className="mb-1 text-base font-semibold text-foreground">
          Could not load products
        </p>
        <p className="mb-6 text-sm text-foreground-muted">
          Something went wrong while fetching the product catalog. Please try
          again.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
