"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { PriceText } from "@/components/ui/PriceText";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import {
  BoxIcon,
  CheckIcon,
  GridIcon,
  StoreIcon,
  TagIcon,
} from "@/components/admin/icons";
import { type WishlistEntry } from "@/lib/api";
import { productPath } from "@/lib/seo";

type Props = {
  items: WishlistEntry[];
  msg: string | null;
  onRemove: (productId: string) => void;
  onMoveToCart: (productId: string) => void;
};

type StatTone = "brand" | "success" | "amber" | "muted";

type WishlistOverviewStat = {
  key: string;
  tone: StatTone;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta: string;
};

function isInStock(item: WishlistEntry) {
  if (item.product.inStock === false) return false;
  if (item.product.stock && item.product.stock.available <= 0) return false;
  return true;
}

export function WishlistView({ items, msg, onRemove, onMoveToCart }: Props) {
  const stats = useMemo(() => {
    const inStockCount = items.filter(isInStock).length;
    const outOfStockCount = items.length - inStockCount;
    const currency = items[0]?.product.pricing.currency ?? "BDT";
    const totalValue = items.reduce(
      (sum, item) => sum + (item.product.pricing.basePrice ?? 0),
      0,
    );
    return { inStockCount, outOfStockCount, currency, totalValue };
  }, [items]);

  const overviewStats: WishlistOverviewStat[] = [
    {
      key: "saved",
      tone: "brand",
      icon: <TagIcon className="h-4 w-4" aria-hidden />,
      label: "Saved items",
      value: items.length.toLocaleString(),
      meta: "Products in your wishlist",
    },
    {
      key: "in-stock",
      tone: "success",
      icon: <CheckIcon className="h-4 w-4" aria-hidden />,
      label: "In stock",
      value: stats.inStockCount.toLocaleString(),
      meta: "Ready to add to cart",
    },
    {
      key: "unavailable",
      tone: stats.outOfStockCount > 0 ? "amber" : "muted",
      icon: <BoxIcon className="h-4 w-4" aria-hidden />,
      label: "Unavailable",
      value: stats.outOfStockCount.toLocaleString(),
      meta: "Out of stock or inactive",
    },
    {
      key: "value",
      tone: "brand",
      icon: <StoreIcon className="h-4 w-4" aria-hidden />,
      label: "Total value",
      value:
        items.length > 0 ? (
          <PriceText amount={stats.totalValue} currency={stats.currency} />
        ) : (
          "—"
        ),
      meta: "Combined base prices",
    },
  ];

  return (
    <>
      {msg ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {msg}
        </div>
      ) : null}

      <div className="customer-wishlist-content space-y-5">
        <section
          className="customer-dashboard-overview-section"
          aria-labelledby="customer-wishlist-overview-title"
        >
          <dl className="customer-dashboard-overview-stats">
            {overviewStats.map((stat) => (
              <div
                key={stat.key}
                className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${stat.tone}`}
              >
                <span
                  className="customer-dashboard-overview-stat-glow"
                  aria-hidden
                />
                <span
                  className="customer-dashboard-overview-stat-icon"
                  aria-hidden
                >
                  {stat.icon}
                </span>
                <div className="customer-dashboard-overview-stat-copy min-w-0">
                  <dt className="customer-dashboard-overview-stat-label">
                    {stat.label}
                  </dt>
                  <dd className="customer-dashboard-overview-stat-value">
                    {stat.value}
                  </dd>
                  <p className="customer-dashboard-overview-stat-meta">
                    {stat.meta}
                  </p>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <AdminOrderListCard
          icon={<TagIcon className="h-4 w-4" />}
          title="Saved products"
          subtitle="Add items to cart or remove them from your wishlist"
          className="admin-product-form-section"
        >
          <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
            <dt>Products</dt>
            <dd>
              {items.length === 0 ? (
                <div className="dashboard-pro-empty py-8">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <GridIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    Your wishlist is empty
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    Save products while browsing to find them here later.
                  </p>
                  <Link href="/products" className="dashboard-pro-btn mt-4">
                    Browse products
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => {
                    const available = isInStock(item);
                    return (
                      <div
                        key={item._id}
                        className="rounded-xl border border-border/60 bg-elevated/40 p-4"
                      >
                        <Link
                          href={productPath(item.product.slug)}
                          className="font-semibold text-foreground hover:text-brand"
                        >
                          {item.product.title}
                        </Link>
                        <p className="mt-1 text-sm text-foreground-muted">
                          <PriceText
                            amount={item.product.pricing.basePrice}
                            currency={item.product.pricing.currency}
                          />
                        </p>
                        <p className="mt-1 text-xs text-subtle capitalize">
                          {item.product.type}
                          {available ? " · In stock" : " · Out of stock"}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onMoveToCart(item.productId)}
                            disabled={!available}
                            className="dashboard-pro-btn text-xs disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Add to cart
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemove(item.productId)}
                            className="dashboard-pro-btn-ghost text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </dd>
          </div>
        </AdminOrderListCard>
      </div>
    </>
  );
}
