"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  BoxIcon,
  DollarIcon,
  LayersIcon,
  ReceiptIcon,
  TagIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { PriceText } from "@/components/ui/PriceText";
import { formatPrice, type AdminReports } from "@/lib/api";
import {
  adminReportSelectOptions,
  formatAdminReportRangeLabel,
} from "@/lib/admin-report-range";

type Props = {
  reports: AdminReports | null;
  currency: string;
  reportDays: number;
  onReportDaysChange: (days: number) => void;
  loading?: boolean;
  error?: string | null;
  /** When true, overview stat cards are omitted (shown in AdminRevenueBreakdown). */
  hideOverview?: boolean;
};

type StatTone = "brand" | "success" | "amber" | "muted";

function productSellOverviewStatClass(tone: StatTone) {
  return [
    "customer-dashboard-overview-stat",
    `customer-dashboard-overview-stat--${tone}`,
    "w-full text-left",
  ].join(" ");
}

function formatRangeLabel(from: string, to: string) {
  return formatAdminReportRangeLabel(0, { from, to });
}

function ProductSellLeaderboardRow({
  rank,
  productId,
  title,
  amount,
  barWidth,
  meta,
}: {
  rank: number;
  productId: string;
  title: string;
  amount: ReactNode;
  barWidth: number;
  meta: ReactNode;
}) {
  return (
    <li className="admin-product-sell-row">
      <div className="admin-product-sell-row-head">
        <span className="admin-product-sell-rank">{rank}</span>
        <Link
          href={`/admin/products/${productId}/edit`}
          className="admin-product-sell-title"
        >
          {title}
        </Link>
        <span className="admin-product-sell-amount">{amount}</span>
      </div>
      <div className="admin-product-sell-bar-track">
        <div
          className="admin-product-sell-bar-fill"
          style={{ width: `${Math.max(8, barWidth)}%` }}
        />
      </div>
      <p className="admin-product-sell-meta">{meta}</p>
    </li>
  );
}

export function AdminProductSellAnalytics({
  reports,
  currency,
  reportDays,
  onReportDaysChange,
  loading = false,
  error = null,
  hideOverview = false,
}: Props) {
  const topProducts = useMemo(
    () => reports?.topProducts ?? [],
    [reports?.topProducts],
  );
  const peakRevenue = Math.max(...topProducts.map((p) => p.revenue), 1);
  const totalOrders = useMemo(
    () => reports?.timeseries.reduce((sum, row) => sum + row.orders, 0) ?? 0,
    [reports],
  );

  const productSell = useMemo(() => {
    if (reports?.productSell) return reports.productSell;
    return {
      netSales: topProducts.reduce((sum, product) => sum + product.revenue, 0),
      itemsSold: topProducts.reduce((sum, product) => sum + product.quantity, 0),
      productsSold: topProducts.length,
    };
  }, [reports?.productSell, topProducts]);

  const rangeLabel =
    reports?.range.from && reports?.range.to
      ? formatRangeLabel(reports.range.from, reports.range.to)
      : formatAdminReportRangeLabel(reportDays);

  const loadingValue = loading ? "…" : null;

  return (
    <div className="admin-product-sell-analytics space-y-5">
      {!hideOverview ? (
      <section
        className="customer-dashboard-overview-section"
        aria-label="Product sales overview"
      >
        <dl className="customer-dashboard-overview-stats">
          <div className={productSellOverviewStatClass("brand")}>
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              <DollarIcon className="h-4 w-4" />
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                Net sales
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {loadingValue ?? (
                  <PriceText amount={productSell.netSales} currency={currency} />
                )}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                {rangeLabel}
              </p>
            </div>
          </div>
          <div className={productSellOverviewStatClass("success")}>
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              <BoxIcon className="h-4 w-4" />
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                Items sold
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {loadingValue ??
                  productSell.itemsSold.toLocaleString()}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                Units in paid orders
              </p>
            </div>
          </div>
          <div className={productSellOverviewStatClass("brand")}>
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              <TagIcon className="h-4 w-4" />
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                Products sold
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {loadingValue ??
                  productSell.productsSold.toLocaleString()}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                Unique products with sales
              </p>
            </div>
          </div>
          <div className={productSellOverviewStatClass("muted")}>
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              <ReceiptIcon className="h-4 w-4" />
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">Orders</dt>
              <dd className="customer-dashboard-overview-stat-value">
                {loadingValue ?? totalOrders.toLocaleString()}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                Paid orders in range
              </p>
            </div>
          </div>
        </dl>
      </section>
      ) : null}

      <ProductFormOrderCard
        icon={<LayersIcon className="h-4 w-4" />}
        title="Product sell analytics"
        subtitle={loading ? "Loading product sales…" : rangeLabel}
        className="admin-product-form-section"
        action={
          hideOverview ? undefined : (
          <AdminSelect
            value={String(reportDays)}
            onChange={(v) => onReportDaysChange(Number(v))}
            className="min-w-[9rem]"
            options={adminReportSelectOptions()}
          />
          )
        }
      >
        {error && !loading ? (
          <div className="panel-3d-alert panel-3d-alert-error mb-4">{error}</div>
        ) : null}

        <div className="admin-product-sell-layout">
          <section aria-label="Top sellers">
            <div className="admin-product-sell-section-head">
              <h3>Top sellers</h3>
              <span>By net sales</span>
            </div>
            {loading ? (
              <p className="text-sm text-subtle">Loading top products…</p>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-subtle">
                No paid product sales in this range.
              </p>
            ) : (
              <ul className="admin-product-sell-list">
                {topProducts.map((product, index) => (
                  <ProductSellLeaderboardRow
                    key={product.productId}
                    rank={index + 1}
                    productId={product.productId}
                    title={product.title}
                    amount={
                      <PriceText amount={product.revenue} currency={currency} />
                    }
                    barWidth={(product.revenue / peakRevenue) * 100}
                    meta={`${product.quantity.toLocaleString()} items sold`}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Product performance">
            <div className="admin-product-sell-section-head">
              <h3>Product performance</h3>
              <span>By revenue share</span>
            </div>
            {loading ? (
              <p className="text-sm text-subtle">Loading product performance…</p>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-subtle">No product sales yet.</p>
            ) : (
              <ul className="admin-product-sell-list">
                {topProducts.map((product, index) => {
                  const share =
                    productSell.netSales > 0
                      ? Math.round((product.revenue / productSell.netSales) * 100)
                      : 0;
                  return (
                    <ProductSellLeaderboardRow
                      key={product.productId}
                      rank={index + 1}
                      productId={product.productId}
                      title={product.title}
                      amount={`${share}%`}
                      barWidth={share}
                      meta={
                        <>
                          {product.quantity.toLocaleString()} items sold ·{" "}
                          <PriceText amount={product.revenue} currency={currency} />{" "}
                          net sales
                        </>
                      }
                    />
                  );
                })}
              </ul>
            )}
            {topProducts.length > 0 ? (
              <p className="admin-product-sell-footnote text-xs text-foreground-muted">
                Paid orders only · Top {topProducts.length} products by revenue ·{" "}
                {formatPrice(productSell.netSales, currency)} total product sales
              </p>
            ) : null}
          </section>
        </div>
      </ProductFormOrderCard>
    </div>
  );
}
