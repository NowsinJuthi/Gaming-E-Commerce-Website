"use client";

import { useMemo, type ReactNode } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  BoxIcon,
  ChartIcon,
  DollarIcon,
  PulseIcon,
  ReceiptIcon,
  TagIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { PriceText } from "@/components/ui/PriceText";
import type { AdminOverview, AdminReports } from "@/lib/api";
import {
  adminReportSelectOptions,
  formatAdminReportRangeLabel,
} from "@/lib/admin-report-range";

type Props = {
  data: AdminOverview;
  reports: AdminReports | null;
  currency: string;
  reportDays: number;
  onReportDaysChange: (days: number) => void;
  loading?: boolean;
  error?: string | null;
};

type StatTone = "brand" | "success" | "amber" | "muted";

function formatRangeLabel(from: string, to: string) {
  return formatAdminReportRangeLabel(0, { from, to });
}

function heroStatClass(tone: StatTone) {
  return [
    "customer-dashboard-overview-stat",
    "admin-revenue-hero-stat",
    `customer-dashboard-overview-stat--${tone}`,
  ].join(" ");
}

function HeroStat({
  tone,
  icon,
  label,
  value,
  meta,
}: {
  tone: StatTone;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta: string;
}) {
  return (
    <div className={heroStatClass(tone)}>
      <span className="customer-dashboard-overview-stat-glow" aria-hidden />
      <span className="customer-dashboard-overview-stat-icon" aria-hidden>
        {icon}
      </span>
      <div className="customer-dashboard-overview-stat-copy min-w-0">
        <dt className="customer-dashboard-overview-stat-label">{label}</dt>
        <dd className="customer-dashboard-overview-stat-value">{value}</dd>
        <p className="customer-dashboard-overview-stat-meta">{meta}</p>
      </div>
    </div>
  );
}

function PeriodStat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: ReactNode;
  accent?: "default" | "positive" | "negative";
}) {
  return (
    <div
      className={`admin-revenue-period-stat admin-revenue-period-stat--${accent}`}
    >
      <p className="admin-revenue-period-stat-label">{label}</p>
      <p className="admin-revenue-period-stat-value">{value}</p>
    </div>
  );
}

export function AdminRevenueBreakdown({
  data,
  reports,
  currency,
  reportDays,
  onReportDaysChange,
  loading = false,
  error = null,
}: Props) {
  const topProducts = useMemo(
    () => reports?.topProducts ?? [],
    [reports?.topProducts],
  );
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
  const { revenue } = data;

  return (
    <ProductFormOrderCard
      icon={<DollarIcon className="h-4 w-4" />}
      title="Revenue breakdown"
      subtitle={`Paid and delivered totals · ${rangeLabel}`}
      className="admin-product-form-section admin-revenue-breakdown"
      action={
        <AdminSelect
          value={String(reportDays)}
          onChange={(v) => onReportDaysChange(Number(v))}
          className="min-w-[9rem]"
          options={adminReportSelectOptions()}
        />
      }
    >
      {error && !loading ? (
        <div className="panel-3d-alert panel-3d-alert-error mb-4">{error}</div>
      ) : null}

      <section className="admin-revenue-breakdown-body" aria-label="Revenue overview">
        <dl className="admin-revenue-hero-stats">
          <HeroStat
            tone="brand"
            icon={<DollarIcon className="h-4 w-4" />}
            label="Net sales"
            value={
              loadingValue ?? (
                <PriceText amount={productSell.netSales} currency={currency} />
              )
            }
            meta={rangeLabel}
          />
          <HeroStat
            tone="success"
            icon={<BoxIcon className="h-4 w-4" />}
            label="Items sold"
            value={loadingValue ?? productSell.itemsSold.toLocaleString()}
            meta="Units in paid orders"
          />
          <HeroStat
            tone="brand"
            icon={<TagIcon className="h-4 w-4" />}
            label="Products sold"
            value={loadingValue ?? productSell.productsSold.toLocaleString()}
            meta="Unique products with sales"
          />
          <HeroStat
            tone="muted"
            icon={<ReceiptIcon className="h-4 w-4" />}
            label="Orders"
            value={loadingValue ?? totalOrders.toLocaleString()}
            meta="Paid orders in range"
          />
        </dl>

        <div className="admin-revenue-period-panel">
          <div className="admin-revenue-period-head">
            <span className="admin-revenue-period-head-icon" aria-hidden>
              <ChartIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="admin-revenue-period-title">Lifetime &amp; period totals</p>
              <p className="admin-revenue-period-sub">
                All-time and rolling windows from paid &amp; delivered orders
              </p>
            </div>
            <span className="admin-revenue-period-chip">
              <PulseIcon className="h-3.5 w-3.5" aria-hidden />
              {currency}
            </span>
          </div>

          <div className="admin-revenue-period-grid">
            <PeriodStat
              label="Today"
              value={<PriceText amount={revenue.today} currency={currency} />}
            />
            <PeriodStat
              label="Last 7 days"
              value={<PriceText amount={revenue.last7Days} currency={currency} />}
            />
            <PeriodStat
              label="Last 30 days"
              value={<PriceText amount={revenue.last30Days} currency={currency} />}
            />
            <PeriodStat
              label="Total"
              value={<PriceText amount={revenue.total} currency={currency} />}
              accent="positive"
            />
            <PeriodStat
              label="Refunded"
              value={<PriceText amount={revenue.refunded} currency={currency} />}
              accent="negative"
            />
            <PeriodStat
              label="Net"
              value={<PriceText amount={revenue.net} currency={currency} />}
              accent="positive"
            />
          </div>
        </div>
      </section>
    </ProductFormOrderCard>
  );
}
