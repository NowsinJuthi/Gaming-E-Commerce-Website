"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { WishlistView } from "@/components/customer/WishlistView";
import {
  addToCart,
  getWishlist,
  removeFromWishlist,
  type WishlistEntry,
} from "@/lib/api";

function isInStock(item: WishlistEntry) {
  if (item.product.inStock === false) return false;
  if (item.product.stock && item.product.stock.available <= 0) return false;
  return true;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getWishlist()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(productId: string) {
    await removeFromWishlist(productId);
    setMsg(null);
    load();
  }

  async function moveToCart(productId: string) {
    try {
      await addToCart(productId, 1);
      window.dispatchEvent(new Event("cart-change"));
      setMsg("Added to cart.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not add to cart");
    }
  }

  const headerAction = useMemo(() => {
    const inStockCount = items.filter(isInStock).length;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--brand">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <span className="dashboard-pro-status dashboard-pro-status--green">
          {inStockCount} in stock
        </span>
      </div>
    );
  }, [items]);

  return (
    <CustomerPageLayout
      section="Account"
      title="Wishlist"
      description="Saved products you want to buy later."
      iconKey="wishlist"
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading}
      loadingText="Loading wishlist…"
      action={loading ? null : headerAction}
    >
      <WishlistView
        items={items}
        msg={msg}
        onRemove={(productId) => void remove(productId)}
        onMoveToCart={(productId) => void moveToCart(productId)}
      />
    </CustomerPageLayout>
  );
}
