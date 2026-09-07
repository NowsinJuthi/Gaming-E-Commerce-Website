"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AdminOrderListCard,
  AdminOrderPageIntro,
  AdminOrderStatField,
  AdminOrderStatsGrid,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import {
  BoxIcon,
  CheckIcon,
  GridIcon,
  LayersIcon,
  ReceiptIcon,
  SettingsIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import type { DownloadItem } from "@/lib/api";
import { DOWNLOADS_QUICK_LINKS } from "@/lib/customer-quick-links";
import { productPath } from "@/lib/seo";

type Props = {
  items: DownloadItem[];
};

function formatOrderDate(value?: string) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
}

export function DownloadsView({ items }: Props) {
  const stats = useMemo(() => {
    const totalCodes = items.reduce((sum, item) => sum + item.codes.length, 0);
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const orderCount = new Set(items.map((item) => item.orderId)).size;
    return { totalCodes, totalQty, orderCount };
  }, [items]);

  const introSubtitle =
    items.length > 0
      ? `${items.length} ${items.length === 1 ? "product" : "products"} · ${stats.totalCodes} codes · ${stats.orderCount} ${stats.orderCount === 1 ? "order" : "orders"}`
      : "Delivered digital goods from your completed orders";

  return (
    <>
      <AdminOrderPageIntro
        icon={<BoxIcon className="h-4 w-4" />}
        title="Account downloads"
        subtitle={introSubtitle}
        quickLinks={DOWNLOADS_QUICK_LINKS}
        quickNavLabel="Account shortcuts"
      />

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<BoxIcon className="h-4 w-4" />}
              title="Downloads overview"
              subtitle={
                items.length > 0
                  ? `${items.length} delivered products across ${stats.orderCount} orders`
                  : "Digital delivery from completed orders"
              }
            >
              <AdminOrderStatsGrid>
                <AdminOrderStatField
                  icon={<LayersIcon className="h-4 w-4" />}
                  label="Products"
                  value={items.length.toLocaleString()}
                  meta="Delivered digital items"
                />
                <AdminOrderStatField
                  icon={<CheckIcon className="h-4 w-4" />}
                  label="Codes"
                  value={stats.totalCodes.toLocaleString()}
                  meta="License keys and gift cards"
                />
                <AdminOrderStatField
                  icon={<ReceiptIcon className="h-4 w-4" />}
                  label="Orders"
                  value={stats.orderCount.toLocaleString()}
                  meta="Orders with downloads"
                />
                <AdminOrderStatField
                  icon={<BoxIcon className="h-4 w-4" />}
                  label="Quantity"
                  value={stats.totalQty.toLocaleString()}
                  meta="Total units delivered"
                />
              </AdminOrderStatsGrid>

              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-4 text-xs text-foreground-muted">
                <span>
                  <span className="font-semibold text-foreground">Products</span>{" "}
                  {items.length}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Codes</span>{" "}
                  {stats.totalCodes}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Orders</span>{" "}
                  {stats.orderCount}
                </span>
              </div>

              <div className="flex flex-wrap justify-end gap-2.5">
                <Link href="/orders" className="dashboard-pro-btn-ghost text-xs">
                  My orders
                </Link>
                <Link href="/products" className="dashboard-pro-btn-ghost text-xs">
                  Browse store
                </Link>
              </div>
            </AdminOrderListCard>

            <AdminOrderListCard
              icon={<BoxIcon className="h-4 w-4" />}
              title="All downloads"
              subtitle="License keys, gift cards, and digital codes from delivered orders"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Library</dt>
                <dd>
                  {items.length === 0 ? (
                    <div className="dashboard-pro-empty py-8">
                      <span className="dashboard-pro-empty-icon" aria-hidden>
                        <GridIcon className="h-6 w-6" />
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        No downloads yet
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        Completed orders with digital delivery appear here.
                      </p>
                      <Link href="/products" className="dashboard-pro-btn mt-4">
                        Browse products
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {items.map((item, index) => {
                        const orderDate = formatOrderDate(item.orderDate);
                        return (
                          <div
                            key={`${item.orderId}-${item.productId}-${index}`}
                            className="rounded-xl border border-border/60 bg-elevated/40 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <Link
                                  href={productPath(item.slug)}
                                  className="font-semibold text-foreground hover:text-brand"
                                >
                                  {item.title}
                                </Link>
                                <p className="mt-1 text-xs text-subtle">
                                  Order {item.orderNumber ?? item.orderId.slice(-8)}
                                  {orderDate ? ` · ${orderDate}` : ""} · Qty{" "}
                                  {item.quantity}
                                </p>
                              </div>
                              <Link
                                href={`/orders/${item.orderId}`}
                                className="dashboard-pro-btn-ghost shrink-0 text-xs"
                              >
                                View order
                              </Link>
                            </div>
                            <div className="mt-3 space-y-2">
                              {item.codes.map((code, codeIndex) => (
                                <div
                                  key={codeIndex}
                                  className="rounded-lg border border-border/60 bg-sunken/50 px-3 py-2 font-mono text-sm text-foreground"
                                >
                                  {code.code}
                                  {code.pin ? ` · PIN: ${code.pin}` : ""}
                                  {code.serial ? ` · Serial: ${code.serial}` : ""}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </dd>
              </div>
            </AdminOrderListCard>
          </>
        }
        sidebar={
          <>
            <ProductFormOrderCard
              icon={<BoxIcon className="h-4 w-4" />}
              title="Downloads guide"
              subtitle="Codes, orders, and delivery"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>When items appear</dt>
                <dd className="text-sm text-foreground-muted">
                  Downloads are added after your order is delivered. Auto-delivery
                  products usually appear within minutes.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Codes and PINs</dt>
                <dd className="text-sm text-foreground-muted">
                  Copy codes carefully. Some products include a PIN or serial
                  number shown beside the main code.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Order details</dt>
                <dd className="text-sm text-foreground-muted">
                  Open the linked order for full delivery history, messages, and
                  support context.
                </dd>
              </div>
            </ProductFormOrderCard>

            <ProductFormOrderCard
              icon={<SettingsIcon className="h-4 w-4" />}
              title="Need help?"
              subtitle="Missing codes or delivery issues"
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Support</dt>
                <dd className="space-y-3 text-sm text-foreground-muted">
                  <p>
                    If a delivered order is missing from downloads or a code
                    does not work, contact support with your order number.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/chat" className="dashboard-pro-btn text-xs">
                      Live chat
                    </Link>
                    <Link
                      href="/support"
                      className="dashboard-pro-btn-ghost text-xs"
                    >
                      Support center
                    </Link>
                  </div>
                </dd>
              </div>
            </ProductFormOrderCard>
          </>
        }
      />
    </>
  );
}
