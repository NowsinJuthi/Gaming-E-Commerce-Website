"use client";

import Link from "next/link";
import { PriceText } from "@/components/ui/PriceText";
import { memo, useEffect, useMemo, useState } from "react";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  BoxIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
} from "@/components/admin/icons";
import type { OrderDetail } from "@/lib/api";
import {
  formatOrderPackageLabel,
  orderLineQuantity,
  parseOrderItemPackage,
} from "@/lib/admin-order-view";
import {
  loadOrderItemImage,
  orderItemImageKey,
} from "@/lib/order-product-images";
import { productPath } from "@/lib/seo";

type Props = {
  order: OrderDetail;
};

function OrderInfoPanelsInner({ order }: Props) {
  const pricing = order.pricing ?? {
    subtotal: 0,
    couponDiscount: 0,
    voucherDiscount: 0,
    discountTotal: 0,
    total: 0,
    currency: "BDT",
  };
  const currency = pricing.currency ?? "BDT";
  const contact = order.contact;
  const items = useMemo(() => order.items ?? [], [order.items]);
  const itemCount = items.length;
  const productCountLabel = `${itemCount} ${itemCount === 1 ? "product" : "products"}`;
  const [itemImages, setItemImages] = useState<Record<string, string>>({});
  const imageLoadKey = useMemo(() => orderItemImageKey(items), [items]);

  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      const next: Record<string, string> = {};

      await Promise.all(
        items.map(async (item, index) => {
          const key = `${item.productId}::${index}`;
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
    <div className="order-info-panels">
      <ProductFormOrderCard
        className="checkout-secure-card admin-product-form-section order-info-customer-card"
        icon={<UserIcon className="h-4 w-4" aria-hidden />}
        title="Customer details"
        subtitle="Contact and order summary"
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Contact information</dt>
          <dd className="admin-product-form-basic-fields">
            <ul className="checkout-secure-list">
              <li>
                <UserIcon className="h-4 w-4" aria-hidden />
                <span>
                  Customer Name:{" "}
                  <strong>{contact?.fullName?.trim() || "—"}</strong>
                </span>
              </li>
              <li>
                <PhoneIcon className="h-4 w-4" aria-hidden />
                <span>
                  Mobile: <strong>{contact?.mobile?.trim() || "—"}</strong>
                </span>
              </li>
              <li>
                <MailIcon className="h-4 w-4" aria-hidden />
                <span>
                  Email: <strong>{contact?.email?.trim() || "—"}</strong>
                </span>
              </li>
              <li>
                <BoxIcon className="h-4 w-4" aria-hidden />
                <span>
                  Items: <strong>{productCountLabel}</strong>
                </span>
              </li>
            </ul>
          </dd>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        className="checkout-secure-card admin-product-form-section order-info-items-card"
        icon={<BoxIcon className="h-4 w-4" aria-hidden />}
        title="Items in this order"
        subtitle={`${productCountLabel} purchased`}
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Order items</dt>
          <dd className="admin-product-form-basic-fields">
            <ul className="checkout-secure-list order-info-items-list">
              {items.map((item, index) => {
                const { productTitle } = parseOrderItemPackage(item.title);
                const packageLabel = formatOrderPackageLabel(item.title);
                const imageKey = `${item.productId}::${index}`;
                const imageUrl = itemImages[imageKey];

                return (
                  <li key={`${item.productId}-${index}`}>
                    <div className="order-info-items-list-entry">
                      <span className="order-info-items-list-thumb">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <BoxIcon className="h-4 w-4 text-brand" aria-hidden />
                        )}
                      </span>

                      <div className="order-info-items-list-main min-w-0 flex-1">
                        <div className="order-info-items-list-head">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={productPath(item.slug)}
                              className="order-info-items-list-title"
                            >
                              {productTitle}
                            </Link>
                            {packageLabel ? (
                              <p className="order-info-items-list-package">
                                {packageLabel}
                              </p>
                            ) : null}
                            <p className="order-info-items-list-qty">
                              Quantity:{" "}
                              <strong>{orderLineQuantity(item.quantity)}</strong>
                            </p>
                          </div>
                          <p className="order-info-items-list-price">
                            <PriceText
                              amount={item.lineTotal}
                              currency={currency}
                            />
                          </p>
                        </div>

                        {(item.customerInputs ?? []).map((input, inputIndex) => (
                          <div
                            key={inputIndex}
                            className="order-info-items-list-input"
                          >
                            <p className="order-info-items-list-input-label">
                              {input.label}
                            </p>
                            <div className="admin-order-view-input admin-order-view-input--readonly text-xs">
                              {input.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </dd>
        </div>
      </ProductFormOrderCard>
    </div>
  );
}

export const OrderInfoPanels = memo(OrderInfoPanelsInner);
