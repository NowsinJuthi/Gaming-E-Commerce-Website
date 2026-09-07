"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "@/components/admin/icons";
import {
  CheckoutItemHeader,
  CheckoutItemPackageRow,
} from "@/components/checkout/CheckoutItemDetails";
import {
  formatOrderPackageLabel,
  orderLineQuantity,
  parseOrderItemPackage,
} from "@/lib/admin-order-view";
import type { MfsCheckoutSummary } from "@/lib/api";
import {
  loadOrderItemImage,
  orderItemImageKey,
} from "@/lib/order-product-images";

type Props = {
  summary: MfsCheckoutSummary;
};

export function MfsPayOrderSummary({ summary }: Props) {
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

  return (
    <div className="card-premium mfs-pay-order-summary p-6 sm:p-8">
      {summary.purpose === "wallet_topup" ? (
        <p className="text-sm text-foreground-muted">
          Add this amount to your wallet balance after payment is verified.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mfs-pay-order-items">
          <div className="mfs-pay-order-items-head">
            <p className="mfs-pay-order-items-title">Your order</p>
            <Link href="/cart" className="site-header-back-btn shrink-0">
              <ArrowLeftIcon className="h-4 w-4" aria-hidden />
              <span className="truncate">Back to cart</span>
            </Link>
          </div>
          <ul className="space-y-3">
            {items.map((item, index) => {
              const { productTitle } = parseOrderItemPackage(item.title);
              const packageName =
                formatOrderPackageLabel(item.title) ?? undefined;
              const imageKey = `${item.productId ?? item.title}::${index}`;
              const imageUrl = itemImages[imageKey];

              return (
                <li
                  key={`${item.productId}-${index}`}
                  className="rounded-xl border border-border/45 bg-sunken/35 p-4"
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
                          <>
                            {productTitle}
                            <span className="ml-1 font-normal text-foreground-muted">
                              × {orderLineQuantity(item.quantity)}
                            </span>
                          </>
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
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
