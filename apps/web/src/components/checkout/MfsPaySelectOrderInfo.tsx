"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckoutItemHeader,
  CheckoutItemPackageRow,
} from "@/components/checkout/CheckoutItemDetails";
import { TrashIcon } from "@/components/admin/icons";
import {
  formatOrderPackageLabel,
  orderLineQuantity,
  parseOrderItemPackage,
} from "@/lib/admin-order-view";
import type { MfsCheckoutSummary } from "@/lib/api";
import { PriceText } from "@/components/ui/PriceText";
import {
  loadOrderItemImage,
  orderItemImageKey,
} from "@/lib/order-product-images";

type Props = {
  summary: MfsCheckoutSummary;
  busy?: boolean;
  editable?: boolean;
  onUpdateQuantity?: (itemIndex: number, quantity: number) => void;
  onRemoveItem?: (itemIndex: number) => void;
};

export function MfsPaySelectOrderInfo({
  summary,
  busy = false,
  editable = false,
  onUpdateQuantity,
  onRemoveItem,
}: Props) {
  const [itemImages, setItemImages] = useState<Record<string, string>>({});
  const items = useMemo(() => summary.items ?? [], [summary.items]);
  const imageLoadKey = useMemo(
    () =>
      orderItemImageKey(
        items.map((item, index) => ({
          productId: item.productId ?? `${item.title}-${index}`,
          slug: item.slug ?? "",
          title: item.title,
        })),
      ),
    [items],
  );

  useEffect(() => {
    if (items.length === 0) return;

    let cancelled = false;

    async function loadImages() {
      const next: Record<string, string> = {};

      await Promise.all(
        items.map(async (item, index) => {
          if (!item.slug) return;
          const key = `${item.productId ?? item.title}::${index}`;
          try {
            const url = await loadOrderItemImage(key, item.slug, item.title);
            if (url) next[key] = url;
          } catch {
            /* ignore missing product */
          }
        }),
      );

      if (!cancelled) {
        setItemImages((prev) => {
          const keys = Object.keys(next);
          if (
            keys.length === Object.keys(prev).length &&
            keys.every((k) => prev[k] === next[k])
          ) {
            return prev;
          }
          return next;
        });
      }
    }

    void loadImages();
    return () => {
      cancelled = true;
    };
  }, [imageLoadKey, items]);

  if (summary.purpose === "wallet_topup") {
    return (
      <div className="mfs-pay-select-order-info">
        <p className="text-sm text-foreground-muted">
          Add{" "}
          <strong className="text-foreground">
            <PriceText amount={summary.amount} currency={summary.currency} />
          </strong>{" "}
          to your wallet balance after payment is verified.
        </p>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <ul className="mfs-pay-select-order-info space-y-3">
      {items.map((item, index) => {
        const itemIndex = item.itemIndex ?? index;
        const { productTitle } = parseOrderItemPackage(item.title);
        const packageName = formatOrderPackageLabel(item.title) ?? undefined;
        const imageKey = `${item.productId ?? item.title}::${index}`;
        const imageUrl = itemImages[imageKey];
        const canEdit = editable && onUpdateQuantity && onRemoveItem;

        return (
          <li
            key={`${item.productId}-${itemIndex}`}
            className="mfs-pay-select-order-item"
          >
            <div className="mfs-pay-order-item-body">
              <div className="checkout-item-head">
                <span className="checkout-item-thumb mfs-pay-order-item-thumb">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={productTitle} />
                  ) : (
                    <span className="checkout-item-thumb-fallback">—</span>
                  )}
                </span>
                <CheckoutItemHeader
                  title={
                    canEdit ? (
                      productTitle
                    ) : (
                      <>
                        {productTitle}
                        <span className="ml-1 font-normal text-foreground-muted">
                          × {orderLineQuantity(item.quantity)}
                        </span>
                      </>
                    )
                  }
                />
              </div>
              {packageName ? (
                <CheckoutItemPackageRow
                  packageName={packageName}
                  unitPrice={item.unitPrice}
                  currency={summary.currency}
                />
              ) : null}
              {canEdit ? (
                <div className="checkout-item-actions mfs-pay-select-item-actions">
                  <div className="checkout-qty">
                    <button
                      type="button"
                      disabled={busy || item.quantity <= 1}
                      onClick={() =>
                        onUpdateQuantity(
                          itemIndex,
                          Math.max(1, item.quantity - 1),
                        )
                      }
                      className="checkout-qty-btn"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="checkout-qty-val">{item.quantity}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onUpdateQuantity(itemIndex, item.quantity + 1)
                      }
                      className="checkout-qty-btn"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemoveItem(itemIndex)}
                    className="checkout-item-remove"
                    aria-label={`Remove ${productTitle}`}
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
