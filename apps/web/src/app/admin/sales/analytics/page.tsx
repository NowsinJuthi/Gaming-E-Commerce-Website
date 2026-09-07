"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminProductSellAnalytics } from "@/components/admin/AdminProductSellAnalytics";
import {
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { ChartIcon, DollarIcon } from "@/components/admin/icons";
import { PriceText } from "@/components/ui/PriceText";
import {
  formatPrice,
  getAdminOverview,
  getAdminReports,
  type AdminOverview,
  type AdminReports,
} from "@/lib/api";
import { formatAdminReportRangeLabel } from "@/lib/admin-report-range";

export default function AdminSalesAnalyticsPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [reportDays, setReportDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await getAdminOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - reportDays);
    try {
      setReports(
        await getAdminReports({
          from: from.toISOString(),
          to: to.toISOString(),
        }),
      );
    } catch (err) {
      setReports(null);
      setReportsError(
        err instanceof Error ? err.message : "Failed to load reports",
      );
    } finally {
      setReportsLoading(false);
    }
  }, [reportDays]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const currency = overview?.revenue.currency ?? "BDT";
  const maxRevenue = Math.max(
    ...(reports?.timeseries.map((d) => d.revenue) ?? [1]),
    1,
  );

  return (
    <AdminPageLayout
      section="Sales"
      title="Sales Analytics"
      description="Product sales, revenue trends, and payment breakdown by date range."
      icon={ChartIcon}
      backHref="/admin/sales/orders"
      backLabel="Orders"
      loading={loading && !overview}
      loadingText="Loading analytics…"
    >
      {error ? (
        <div className="panel-3d-alert panel-3d-alert-error flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="dashboard-pro-btn-ghost text-sm"
          >
            Try again
          </button>
        </div>
      ) : null}

      <AdminOrderTwoColumnLayout
        main={
          <div className="min-w-0 space-y-5">
            <AdminProductSellAnalytics
              reports={reports}
              currency={currency}
              reportDays={reportDays}
              onReportDaysChange={setReportDays}
              loading={reportsLoading}
              error={reportsError}
            />

            {reports ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <ProductFormOrderCard
                  icon={<ChartIcon className="h-4 w-4" />}
                  title="Revenue trend"
                  subtitle={`${formatAdminReportRangeLabel(reportDays)} · paid orders`}
                  className="admin-product-form-section"
                >
                  <div className="mt-2 flex h-40 items-end gap-1">
                    {reports.timeseries.length === 0 ? (
                      <p className="text-sm text-subtle">No revenue in this range.</p>
                    ) : (
                      reports.timeseries.map((d) => (
                        <div
                          key={d.date}
                          className="flex flex-1 flex-col items-center gap-1"
                          title={`${d.date}: ${formatPrice(d.revenue, currency)}`}
                          role="img"
                          aria-label={`${d.date}: ${formatPrice(d.revenue, currency)}`}
                        >
                          <div
                            className="w-full rounded-t bg-teal-500/60"
                            style={{
                              height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%`,
                            }}
                          />
                          <span className="text-[8px] text-subtle">
                            {d.date.slice(5)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </ProductFormOrderCard>

                <ProductFormOrderCard
                  icon={<DollarIcon className="h-4 w-4" />}
                  title="Payment methods"
                  subtitle="Count and total by method"
                  className="admin-product-form-section"
                >
                  <div className="panel-3d-table-wrap overflow-x-auto">
                    <table className="panel-3d-table">
                      <thead>
                        <tr>
                          <th>Method</th>
                          <th>Orders</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.paymentBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-sm text-subtle">
                              No payment data in this range.
                            </td>
                          </tr>
                        ) : (
                          reports.paymentBreakdown.map((row) => (
                            <tr key={row.method}>
                              <td className="capitalize">{row.method}</td>
                              <td>{row.count.toLocaleString()}</td>
                              <td>
                                <PriceText amount={row.total} currency={currency} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </ProductFormOrderCard>
              </div>
            ) : null}
          </div>
        }
      />
    </AdminPageLayout>
  );
}
