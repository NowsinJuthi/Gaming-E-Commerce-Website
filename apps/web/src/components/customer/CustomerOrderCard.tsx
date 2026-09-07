"use client";

import Link from "next/link";
import { PriceText } from "@/components/ui/PriceText";
import { useState } from "react";
import { BoxIcon, CheckIcon, ChevronIcon, CopyIcon, EyeIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { OrderDeliveryCards } from "@/components/orders/OrderDeliveryCards";
import { OrderDeliveryProductIcon } from "@/components/orders/OrderDeliveryProductIcon";
import { resolveOrderId, type OrderDetail } from "@/lib/api";
import { orderLineQuantity } from "@/lib/admin-order-view";
import { customerOrderStatusLabel } from "@/lib/customer-order-status";

type OrderTone = "success" | "processing" | "amber" | "muted";
type CardTone = "success" | "amber" | "muted" | "processing";

function statusMeta(status: string): {
  label: string;
  tone: OrderTone;
  cardTone: CardTone;
} {
  const label = customerOrderStatusLabel(status);
  switch (status) {
    case "delivered":
      return { label, tone: "success", cardTone: "success" };
    case "processing":
    case "paid":
      return { label, tone: "processing", cardTone: "processing" };
    case "pending":
      return { label, tone: "amber", cardTone: "amber" };
    default:
      return { label, tone: "muted", cardTone: "muted" };
  }
}

function formatOrderDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Props = {
  order: OrderDetail;
  /** Dashboard Recent orders — no inner items card shell */
  flatExpandedItems?: boolean;
};

export function CustomerOrderCard({ order, flatExpandedItems = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const items = order.items ?? [];
  const pricing = order.pricing ?? {
    subtotal: 0,
    couponDiscount: 0,
    voucherDiscount: 0,
    discountTotal: 0,
    total: 0,
    currency: "BDT",
  };
  const currency = pricing.currency ?? "BDT";
  const meta = statusMeta(order.status);
  const itemCount = items.reduce(
    (sum, item) => sum + orderLineQuantity(item.quantity),
    0,
  );
  const dateLabel = formatOrderDate(order.createdAt);

  async function copyOrderNumber() {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      className={`dashboard-recent-order dashboard-recent-order--${meta.cardTone}${expanded ? " dashboard-recent-order--expanded" : ""}`}
    >
      <span className="dashboard-recent-order-accent" aria-hidden />

      <div className="dashboard-recent-order-inner">
        <div className="dashboard-recent-order-main">
          <OrderDeliveryProductIcon
            title={items[0]?.title ?? order.orderNumber}
            slug={items[0]?.slug}
            deliveryType={items[0]?.deliveryType}
            variant="recent-order"
          />

          <div className="min-w-0 flex-1">
            <div className="dashboard-recent-order-header">
              <div className="dashboard-recent-order-title-block">
                <p className="dashboard-recent-order-title">
                  Order Number:{" "}
                  <strong className="dashboard-recent-order-number">
                    {order.orderNumber}
                    <button
                      type="button"
                      onClick={copyOrderNumber}
                      className={`dashboard-recent-order-copy dashboard-recent-order-copy--inline${
                        copied ? " dashboard-recent-order-copy--copied" : ""
                      }`}
                      aria-label={
                        copied
                          ? "Copied"
                          : `Copy order number ${order.orderNumber}`
                      }
                      title={copied ? "Copied!" : "Copy order number"}
                    >
                      {copied ? (
                        <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  </strong>
                </p>
                <p className="dashboard-recent-order-meta">
                  {dateLabel}
                  {dateLabel ? " · " : ""}
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </p>
              </div>
              <span
                className={`dashboard-recent-order-badge dashboard-recent-order-badge--${meta.tone}`}
              >
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        <div className="dashboard-recent-order-actions">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className={`dashboard-recent-order-expand ${expanded ? "dashboard-recent-order-expand--open" : ""}`}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide order details" : "Show order details"}
          >
            <ChevronIcon className="h-4 w-4" />
          </button>
          <Link
            href={`/orders/${resolveOrderId(order)}`}
            className="dashboard-recent-order-view"
          >
            <EyeIcon className="h-4 w-4" aria-hidden />
            <span className="dashboard-recent-order-view-label">View order</span>
          </Link>
        </div>
      </div>

      {expanded ? (
        <div className="dashboard-recent-order-details">
          {flatExpandedItems ? (
            <OrderDeliveryCards
              items={items}
              giftCards={order.manualGiftCards}
              embedded
            />
          ) : (
            <ProductFormOrderCard
              className="admin-product-form-section dashboard-recent-order-items-card"
              iconClassName="order-items-section-icon-gold"
              icon={<BoxIcon className="h-4 w-4" aria-hidden />}
              title="Order items"
              subtitle={`${items.length} ${items.length === 1 ? "product" : "products"} · delivery codes and details`}
            >
              <OrderDeliveryCards
                items={items}
                giftCards={order.manualGiftCards}
                embedded
              />
            </ProductFormOrderCard>
          )}

          <footer className="dashboard-recent-order-details-foot">
            <span className="dashboard-recent-order-details-foot-label">
              Order total
            </span>
            <strong className="dashboard-recent-order-details-foot-value">
              <PriceText amount={pricing.total} currency={currency} />
            </strong>
          </footer>
        </div>
      ) : null}
    </article>
  );
}
