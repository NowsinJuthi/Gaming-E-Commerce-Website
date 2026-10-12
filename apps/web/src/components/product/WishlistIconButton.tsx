"use client";
import { hasAuthSession } from "@/lib/access-token";

import { useState } from "react";
import { HeartIcon } from "@/components/admin/icons";
import { addToWishlist } from "@/lib/api";

export function WishlistIconButton({
  productId,
  className = "",
}: {
  productId: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!hasAuthSession()) {
      window.location.href = "/login";
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await addToWishlist(productId);
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const label = done
    ? "Saved to wishlist"
    : failed
      ? "Failed — tap to retry"
      : "Add to wishlist";

  return (
    <button
      type="button"
      disabled={busy || done}
      onClick={onClick}
      className={`product-pdp-icon-btn ${done ? "product-pdp-icon-btn--active" : ""} ${failed ? "product-pdp-icon-btn--error" : ""} ${className}`.trim()}
      aria-label={label}
      title={label}
    >
      <HeartIcon className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
