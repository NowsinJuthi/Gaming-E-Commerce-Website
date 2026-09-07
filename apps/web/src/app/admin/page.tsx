"use client";

import Link from "next/link";
import { PriceText } from "@/components/ui/PriceText";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminAnimatedCharts } from "@/components/admin/AdminAnimatedCharts";
import { AdminProductSellAnalytics } from "@/components/admin/AdminProductSellAnalytics";
import { AdminRevenueBreakdown } from "@/components/admin/AdminRevenueBreakdown";
import { AdminRedisGraph } from "@/components/admin/AdminRedisGraph";
import { AdminTelegramNotificationPanel } from "@/components/admin/AdminTelegramNotificationPanel";
import { AdminOrderTwoColumnLayout } from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  CartIcon,
  GridIcon,
  TruckIcon,
  UsersIcon,
} from "@/components/admin/icons";
import {
  formatPrice,
  getAdminOverview,
  getAdminReports,
  getEmailAdminSettings,
  getNotificationAdminOverview,
  getSystemStatus,
  type AdminOverview,
  type AdminReports,
  type EmailSettingsView,
  type NotificationAdminOverview,
  type SystemStatus,
} from "@/lib/api";
import { formatAdminReportRangeLabel } from "@/lib/admin-report-range";
import { WEBSITE_STACK, type StackGroup } from "@/lib/website-stack";

type Tab =
  | "revenue"
  | "orders"
  | "users"
  | "suppliers"
  | "reports"
  | "status";

export default function AdminDashboardPage() {
  const [tab] = useState<Tab>("revenue");
  const [data, setData] = useState<AdminOverview | null>(null);
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [notifOverview, setNotifOverview] =
    useState<NotificationAdminOverview | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsView | null>(
    null,
  );
  const [emailLoading, setEmailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportDays, setReportDays] = useState(30);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [fullWebsiteInfoOpen, setFullWebsiteInfoOpen] = useState(false);
  const [redisGraphActive, setRedisGraphActive] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      setStatus(await getSystemStatus());
    } catch (err) {
      setStatus(null);
      setStatusError(
        err instanceof Error ? err.message : "Could not load API status",
      );
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await getAdminOverview();
      setData(overview);
      void getNotificationAdminOverview()
        .then(setNotifOverview)
        .catch(() => setNotifOverview(null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
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
        err instanceof Error ? err.message : "Could not load reports",
      );
    } finally {
      setReportsLoading(false);
    }
  }, [reportDays]);

  useEffect(() => {
    if (!data) {
      setRedisGraphActive(false);
      return;
    }
    const id = window.setTimeout(() => setRedisGraphActive(true), 500);
    return () => window.clearTimeout(id);
  }, [data]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    void loadReports();
  }, [data, loadReports]);

  useEffect(() => {
    if (!fullWebsiteInfoOpen) return;
    void loadStatus();
    setEmailLoading(true);
    void getEmailAdminSettings()
      .then((result) => setEmailSettings(result?.settings ?? null))
      .catch(() => setEmailSettings(null))
      .finally(() => setEmailLoading(false));
    const timer = window.setInterval(() => {
      void loadStatus();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [fullWebsiteInfoOpen, loadStatus]);

  const toggleFullWebsiteInfo = useCallback(() => {
    setFullWebsiteInfoOpen((open) => !open);
  }, []);

  const currency = data?.revenue.currency ?? "BDT";
  const maxRevenue = Math.max(
    ...(reports?.timeseries.map((d) => d.revenue) ?? [1]),
    1,
  );

  return (
    <AdminPageLayout
      section="Administration"
      title="Dashboard"
      description="Revenue, orders, customers, suppliers, and platform health at a glance."
      loading={loading && !data}
      loadingText="Loading dashboard…"
      action={
        <button
          type="button"
          onClick={toggleFullWebsiteInfo}
          className="panel-3d-btn panel-3d-btn-sm"
          aria-expanded={fullWebsiteInfoOpen}
        >
          {fullWebsiteInfoOpen ? "Hide website info" : "Website info"}
        </button>
      }
    >

      {fullWebsiteInfoOpen ? (
        status ? (
          <WebsiteFullInfoPanel
            status={status}
            notifOverview={notifOverview}
            emailSettings={emailSettings}
            emailLoading={emailLoading}
          />
        ) : statusLoading ? (
          <div className="admin-webinfo-stack admin-webinfo-panel admin-webinfo-loading">
            Loading website info…
          </div>
        ) : statusError ? (
          <div className="panel-3d-alert panel-3d-alert-error flex flex-wrap items-center justify-between gap-3">
            <span>{statusError}</span>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="panel-3d-btn panel-3d-btn-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="admin-webinfo-stack admin-webinfo-panel admin-webinfo-loading">
            Loading website info…
          </div>
        )
      ) : null}

      {error ? (
        <div className="panel-3d-alert panel-3d-alert-error">{error}</div>
      ) : null}

      <AdminOrderTwoColumnLayout
        main={
          data ? (
            <>
              <div className="admin-dashboard-content">

              {tab === "revenue" && (
                <div
                  id="dashboard-panel-revenue"
                  role="tabpanel"
                  aria-labelledby="dashboard-tab-revenue"
                  className="space-y-5"
                >
                <AdminRevenueBreakdown
                  data={data}
                  reports={reports}
                  currency={currency}
                  reportDays={reportDays}
                  onReportDaysChange={setReportDays}
                  loading={reportsLoading}
                  error={reportsError}
                />

                <AdminAnimatedCharts data={data} reports={reports} />

                <AdminProductSellAnalytics
                  reports={reports}
                  currency={currency}
                  reportDays={reportDays}
                  onReportDaysChange={setReportDays}
                  loading={reportsLoading}
                  error={reportsError}
                  hideOverview
                />
                </div>
              )}

              {tab === "orders" && (
                <div
                  id="dashboard-panel-orders"
                  role="tabpanel"
                  aria-labelledby="dashboard-tab-orders"
                >
                <ProductFormOrderCard
                  icon={<CartIcon className="h-4 w-4" />}
                  title="Recent orders"
                  subtitle="Latest orders and fulfillment status"
                  className="admin-product-form-section"
                >
                <section className="space-y-4">
                  <div className="panel-stat-grid sm:grid-cols-4">
                    <StatBox label="Total" value={String(data.orders.total)} />
                    <StatBox label="Today" value={String(data.orders.today)} />
                    <StatBox
                      label="Pending"
                      value={String(data.orders.pending)}
                    />
                    <StatBox
                      label="Avg order"
                      value={<PriceText amount={data.orders.averageOrderValue} currency={currency} />}
                    />
                  </div>
                  <div className="panel-3d-table-wrap panel-stack-base overflow-x-auto">
                    <table className="panel-3d-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-foreground-muted">
                        {data.orders.recent.map((o, i) => (
                          <tr key={o.orderNumber ?? i}>
                            <td className="px-4 py-3 font-mono text-xs text-foreground">
                              {o.orderNumber ?? "—"}
                            </td>
                            <td className="px-4 py-3 capitalize">{o.status}</td>
                            <td className="px-4 py-3">
                              <PriceText amount={o.total ?? 0} currency={o.currency ?? currency} />
                            </td>
                            <td className="px-4 py-3 text-foreground-muted">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleDateString()
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Link
                    href="/admin/sales/orders"
                    className="inline-block text-sm font-semibold text-teal-400 hover:underline"
                  >
                    Manage all orders →
                  </Link>
                </section>
                </ProductFormOrderCard>
                </div>
              )}

              {tab === "users" && (
                <div
                  id="dashboard-panel-users"
                  role="tabpanel"
                  aria-labelledby="dashboard-tab-users"
                >
                <ProductFormOrderCard
                  icon={<UsersIcon className="h-4 w-4" />}
                  title="User activity"
                  subtitle="Registrations, roles, and recent sign-ups"
                  className="admin-product-form-section"
                >
                <section className="space-y-4">
                  <div className="panel-stat-grid sm:grid-cols-4">
                    <StatBox label="Total" value={String(data.users.total)} />
                    <StatBox
                      label="New today"
                      value={String(data.users.newToday)}
                    />
                    <StatBox
                      label="Last 7 days"
                      value={String(data.users.newLast7Days)}
                    />
                    <StatBox
                      label="Last 30 days"
                      value={String(data.users.newLast30Days)}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <RoleStatusCard
                      title="By role"
                      entries={data.users.byRole}
                    />
                    <RoleStatusCard
                      title="By status"
                      entries={data.users.byStatus}
                    />
                  </div>
                  <div className="panel-3d-table-wrap panel-stack-base overflow-x-auto">
                    <table className="panel-3d-table">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 font-medium">User</th>
                          <th className="px-4 py-3 font-medium">Roles</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-foreground-muted">
                        {(data.users.recent ?? []).map((u) => (
                          <tr key={u.id}>
                            <td className="px-4 py-3">
                              <p className="text-foreground">{u.email}</p>
                              {u.displayName && (
                                <p className="text-xs text-subtle">
                                  {u.displayName}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {u.roles.join(", ")}
                            </td>
                            <td className="px-4 py-3 capitalize">{u.status}</td>
                            <td className="px-4 py-3 text-foreground-muted">
                              {u.createdAt
                                ? new Date(u.createdAt).toLocaleDateString()
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Link
                    href="/admin/customers"
                    className="inline-block text-sm font-semibold text-teal-400 hover:underline"
                  >
                    Customer management →
                  </Link>
                </section>
                </ProductFormOrderCard>
                </div>
              )}

              {tab === "suppliers" && (
                <div
                  id="dashboard-panel-suppliers"
                  role="tabpanel"
                  aria-labelledby="dashboard-tab-suppliers"
                >
                <ProductFormOrderCard
                  icon={<TruckIcon className="h-4 w-4" />}
                  title="Supplier health"
                  subtitle="Procurement success rates and balances"
                  className="admin-product-form-section"
                >
                <section className="space-y-4">
                  <div className="panel-stat-grid sm:grid-cols-4">
                    <StatBox
                      label="Success rate"
                      value={`${data.suppliers.procurement.successRate}%`}
                    />
                    <StatBox
                      label="Success"
                      value={String(data.suppliers.procurement.success)}
                    />
                    <StatBox
                      label="Failed"
                      value={String(data.suppliers.procurement.failed)}
                    />
                    <StatBox
                      label="Pending"
                      value={String(data.suppliers.procurement.pending)}
                    />
                  </div>
                  <div className="panel-3d-table-wrap panel-stack-base overflow-x-auto">
                    <table className="panel-3d-table">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 font-medium">Supplier</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Balance</th>
                          <th className="px-4 py-3 font-medium">Health</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-foreground-muted">
                        {data.suppliers.list.map((s) => (
                          <tr key={s.code}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-foreground">
                                {s.name}
                              </p>
                              <p className="font-mono text-xs text-subtle">
                                {s.code}
                              </p>
                            </td>
                            <td className="px-4 py-3 capitalize">{s.status}</td>
                            <td className="px-4 py-3">
                              {s.balance != null ? (
                                <PriceText
                                  amount={s.balance}
                                  currency={s.balanceCurrency ?? currency}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground-muted">
                              {s.lastError ? (
                                <span className="text-rose-400">
                                  {s.lastError.slice(0, 40)}
                                </span>
                              ) : s.lastHealthyAt ? (
                                new Date(s.lastHealthyAt).toLocaleDateString()
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Link
                    href="/admin/settings/suppliers"
                    className="inline-block text-sm font-semibold text-teal-400 hover:underline"
                  >
                    Configure suppliers →
                  </Link>
                </section>
                </ProductFormOrderCard>
                </div>
              )}

              {tab === "reports" && (
                <div
                  id="dashboard-panel-reports"
                  role="tabpanel"
                  aria-labelledby="dashboard-tab-reports"
                >
                <ProductFormOrderCard
                  icon={<GridIcon className="h-4 w-4" />}
                  title="Reports & analytics"
                  subtitle={`Revenue timeseries and payment breakdown · ${formatAdminReportRangeLabel(reportDays)}`}
                  className="admin-product-form-section"
                >
                <section className="space-y-4">
                  {reportsLoading ? (
                    <p className="text-sm text-subtle">Loading reports…</p>
                  ) : reportsError ? (
                    <div className="panel-3d-alert panel-3d-alert-error flex flex-wrap items-center justify-between gap-3">
                      <span>{reportsError}</span>
                      <button
                        type="button"
                        onClick={() => void loadReports()}
                        className="panel-3d-btn panel-3d-btn-sm"
                      >
                        Retry
                      </button>
                    </div>
                  ) : reports ? (
                    <>
                      <ProductFormOrderCard
                        title="Revenue timeseries"
                        subtitle={formatAdminReportRangeLabel(reportDays)}
                      >
                        <div className="mt-4 flex h-40 items-end gap-1">
                          {reports.timeseries.length === 0 ? (
                            <p className="text-sm text-subtle">
                              No data in range
                            </p>
                          ) : (
                            reports.timeseries.map((d) => (
                              <div
                                key={d.date}
                                className="flex flex-1 flex-col items-center gap-1"
                                title={`${d.date}: ${formatPrice(d.revenue, currency)}`}
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
                      <ReportTable
                        title="Payment methods"
                        headers={["Method", "Count", "Total"]}
                        rows={reports.paymentBreakdown.map((p) => [
                          p.method,
                          String(p.count),
                          formatPrice(p.total, currency),
                        ])}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-subtle">No report data available.</p>
                  )}
                </section>
                </ProductFormOrderCard>
                </div>
              )}

              </div>
            </>
          ) : null
        }
        sidebar={
          <div className="admin-dashboard-sidebar min-w-0 space-y-5">
            <AdminRedisGraph compact active={redisGraphActive} />
            <AdminTelegramNotificationPanel />
          </div>
        }
      />
    </AdminPageLayout>
  );
}

function formatProcessUptime(seconds?: number): string {
  if (seconds == null || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatMemory(mb?: number) {
  if (mb == null) return "—";
  return `${mb.toLocaleString()} MB`;
}

function WebInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-webinfo-info-row">
      <span className="admin-webinfo-info-label">{label}</span>
      <span className="admin-webinfo-info-value">{value}</span>
    </div>
  );
}

type WebInfoCardAccent =
  | "frontend"
  | "backend"
  | "infra"
  | "api"
  | "version"
  | "process"
  | "db"
  | "queues"
  | "notif";

function WebsiteStackCard({
  group,
  accent,
}: {
  group: StackGroup;
  accent: WebInfoCardAccent;
}) {
  return (
    <div className={`admin-webinfo-card admin-webinfo-card--${accent}`}>
      <p className="admin-webinfo-card-title">{group.title}</p>
      <p className="admin-webinfo-card-sub">{group.subtitle}</p>
      {group.tags ? (
        <div className="admin-webinfo-tags">
          {group.tags.map((tag) => (
            <span key={tag} className="admin-webinfo-tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 space-y-0">
        {group.items.map((item) => (
          <WebInfoRow key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function WebInfoCard({
  accent,
  title,
  subtitle,
  children,
  className = "",
}: {
  accent: WebInfoCardAccent;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`admin-webinfo-card admin-webinfo-card--${accent} ${className}`}>
      <p className="admin-webinfo-card-title">{title}</p>
      {subtitle ? (
        <p className="admin-webinfo-card-sub">{subtitle}</p>
      ) : null}
      <div className={subtitle ? "mt-3 space-y-0" : "mt-2 space-y-0"}>
        {children}
      </div>
    </div>
  );
}

function ApiStatusSummary({ status }: { status: SystemStatus }) {
  return (
    <section className="admin-webinfo-section admin-webinfo-api-status">
      <div className="admin-webinfo-api-status-head">
        <h4 className="admin-webinfo-section-title">API status</h4>
        <p className="admin-webinfo-api-status-sub">
          Live system health · auto refresh every 10s
        </p>
      </div>
      <div className="panel-stat-grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatBox
          label="Overall"
          value={status.status}
          className={
            status.status === "healthy"
              ? "text-emerald-300"
              : "text-amber-300"
          }
        />
        <StatBox
          label="Uptime"
          value={formatProcessUptime(status.uptimeSeconds)}
        />
        <StatBox
          label="MongoDB"
          value={status.database.ok ? "OK" : "Down"}
          className={
            status.database.ok ? "text-emerald-300" : "text-rose-300"
          }
        />
        <StatBox
          label="Redis"
          value={status.redis.ok ? "OK" : "Down"}
          className={
            status.redis.ok ? "text-emerald-300" : "text-rose-300"
          }
        />
        <StatBox
          label="DB latency"
          value={
            status.database.latencyMs != null
              ? `${status.database.latencyMs} ms`
              : "—"
          }
        />
        <StatBox
          label="Redis latency"
          value={
            status.redis.latencyMs != null
              ? `${status.redis.latencyMs} ms`
              : "—"
          }
        />
      </div>
    </section>
  );
}

function WebsiteFullInfoPanel({
  status,
  notifOverview,
  emailSettings,
  emailLoading,
}: {
  status: SystemStatus;
  notifOverview: NotificationAdminOverview | null;
  emailSettings: EmailSettingsView | null;
  emailLoading: boolean;
}) {
  const queueEntries = Object.entries(status.queues);
  const queuesRedisOffline =
    queueEntries.length > 0 &&
    queueEntries.every(([, queue]) => queue.redisOffline);

  return (
    <div className="admin-webinfo-stack admin-webinfo-panel">
      <span
        className="admin-webinfo-panel__glow admin-webinfo-panel__glow--1"
        aria-hidden
      />
      <span
        className="admin-webinfo-panel__glow admin-webinfo-panel__glow--2"
        aria-hidden
      />
      <div className="admin-webinfo-panel__content">
        <header className="admin-webinfo-hero">
          <div className="admin-webinfo-hero-head">
            <span className="admin-webinfo-hero-icon" aria-hidden>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
            </span>
            <div>
              <h3 className="admin-webinfo-hero-title">Website info</h3>
              <p className="admin-webinfo-hero-sub">
                Complete system, API, and queue snapshot — tech stack, routes,
                runtime health, and integrations.
              </p>
            </div>
          </div>
        </header>

        <div className="admin-webinfo-body">
          <ApiStatusSummary status={status} />

          <section className="admin-webinfo-section">
            <h4 className="admin-webinfo-section-title">Platform snapshot</h4>
            <p className="mb-3 text-xs text-subtle">
              Runtime and store identity
            </p>
            <div className="admin-webinfo-grid admin-webinfo-grid--3">
              <WebInfoCard accent="process" title="Platform">
                <WebInfoRow label="Node" value={status.node ?? "—"} />
                <WebInfoRow
                  label="Memory"
                  value={`${formatMemory(status.memory?.heapUsedMb)} / ${formatMemory(status.memory?.heapTotalMb)}`}
                />
                <WebInfoRow
                  label="Public URL"
                  value={status.apis?.version?.publicUrl ?? "—"}
                />
                <WebInfoRow
                  label="API docs"
                  value={
                    status.apis?.version?.docsEnabled ? "Enabled" : "Disabled"
                  }
                />
              </WebInfoCard>

              <WebInfoCard accent="version" title="Store identity">
                {emailLoading ? (
                  <p className="text-sm text-subtle">Loading store identity…</p>
                ) : emailSettings ? (
                  <>
                    <WebInfoRow
                      label="Name"
                      value={emailSettings.fromName || "—"}
                    />
                    <WebInfoRow
                      label="Email"
                      value={emailSettings.fromEmail || "—"}
                    />
                    <WebInfoRow
                      label="SMTP"
                      value={`${emailSettings.enabled ? "Enabled" : "Disabled"}${
                        emailSettings.mockMode ? " · mock mode" : ""
                      }`}
                    />
                  </>
                ) : (
                  <p className="text-sm text-subtle">
                    Configure sender details under Email / SMTP.
                  </p>
                )}
              </WebInfoCard>

              <WebInfoCard
                accent="infra"
                title="General settings"
                className="admin-webinfo-general-settings"
              >
                <p className="text-sm text-foreground-muted">
                  Delivery, payments, security, branding, and customer-facing
                  configuration live under General settings.
                </p>
                <div className="admin-webinfo-general-settings-action">
                  <Link
                    href="/admin/settings"
                    prefetch={false}
                    className="admin-webinfo-action-link inline-flex"
                  >
                    Open General settings →
                  </Link>
                </div>
              </WebInfoCard>
            </div>
          </section>

          <section className="admin-webinfo-section">
            <h4 className="admin-webinfo-section-title">Tech stack</h4>
            <div className="admin-webinfo-grid">
              <WebsiteStackCard
                group={WEBSITE_STACK.frontend}
                accent="frontend"
              />
              <WebsiteStackCard
                group={WEBSITE_STACK.backend}
                accent="backend"
              />
            </div>
          </section>

          <section className="admin-webinfo-section">
            <h4 className="admin-webinfo-section-title">
              Platform &amp; API routes
            </h4>
            <div className="admin-webinfo-grid admin-webinfo-grid--3">
              <WebsiteStackCard
                group={WEBSITE_STACK.infrastructure}
                accent="infra"
              />

              {status.apis ? (
                <WebInfoCard
                  accent="api"
                  title="Website API routes"
                >
                  <WebInfoRow
                    label="Total endpoints"
                    value={String(status.apis.totalEndpoints)}
                  />
                  <WebInfoRow
                    label="Controllers"
                    value={String(status.apis.totalControllers)}
                  />
                  <WebInfoRow
                    label="Global prefix"
                    value={`/${status.apis.globalPrefix}`}
                  />
                  {status.apis.version ? (
                    <>
                      <WebInfoRow
                        label="Base URL"
                        value={`${status.apis.version.publicUrl}/${status.apis.globalPrefix}`}
                      />
                      <WebInfoRow
                        label="Swagger docs"
                        value={
                          status.apis.version.docsEnabled
                            ? status.apis.version.docsPath
                            : "Disabled in production"
                        }
                      />
                    </>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(status.apis.byMethod)
                      .sort((a, b) => b[1] - a[1])
                      .map(([method, count]) => (
                        <span
                          key={method}
                          className="admin-webinfo-method-pill text-foreground"
                        >
                          {method}{" "}
                          <span className="text-teal-300">{count}</span>
                        </span>
                      ))}
                  </div>
                  {status.apis.controllers?.length ? (
                    <div className="admin-webinfo-controller-list">
                      {status.apis.controllers.map((controller) => (
                        <div
                          key={`${controller.name}-${controller.path}`}
                          className="admin-webinfo-controller-row"
                        >
                          <div className="min-w-0">
                            <p className="admin-webinfo-controller-name">
                              {controller.name}
                            </p>
                            <p className="admin-webinfo-controller-path">
                              {controller.path}
                            </p>
                          </div>
                          <span className="admin-webinfo-controller-count">
                            {controller.routes}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </WebInfoCard>
              ) : (
                <WebInfoCard
                  accent="api"
                  title="Website API routes"
                >
                  <p className="text-sm text-subtle">
                    API route data unavailable.
                  </p>
                </WebInfoCard>
              )}

              {status.apis?.version ? (
                <WebInfoCard
                  accent="version"
                  title="API version"
                >
                  <WebInfoRow
                    label="API version"
                    value={status.apis.version.api}
                  />
                  <WebInfoRow
                    label="NestJS"
                    value={status.apis.version.nestjs}
                  />
                  <WebInfoRow
                    label="Swagger"
                    value={status.apis.version.swagger}
                  />
                  <WebInfoRow
                    label="OpenAPI doc"
                    value={status.apis.version.openapi}
                  />
                  <WebInfoRow
                    label="Environment"
                    value={status.apis.version.environment}
                  />
                  <WebInfoRow label="Node.js" value={status.node ?? "—"} />
                  <WebInfoRow
                    label="API port"
                    value={String(status.apis.version.port)}
                  />
                  <WebInfoRow
                    label="Public URL"
                    value={status.apis.version.publicUrl}
                  />
                  <WebInfoRow
                    label="Docs status"
                    value={
                      status.apis.version.docsEnabled ? "Enabled" : "Disabled"
                    }
                  />
                </WebInfoCard>
              ) : (
                <WebInfoCard
                  accent="version"
                  title="API version"
                >
                  <WebInfoRow label="NestJS" value="11" />
                  <WebInfoRow label="API version" value="0.1.0" />
                  <WebInfoRow label="Node.js" value={status.node ?? "—"} />
                  <p className="mt-2 text-xs text-subtle">
                    Restart API server for live version metrics.
                  </p>
                </WebInfoCard>
              )}
            </div>
          </section>

          <Link
            href="/admin/settings/delivery"
            className="admin-webinfo-action-link"
          >
            Delivery pipeline status →
          </Link>

          <section className="admin-webinfo-section">
            <h4 className="admin-webinfo-section-title">Runtime health</h4>
            <div className="admin-webinfo-grid">
              <WebInfoCard
                accent="process"
                title="API process"
              >
                <WebInfoRow label="Status" value={status.status} />
                <WebInfoRow
                  label="Uptime"
                  value={formatProcessUptime(status.uptimeSeconds)}
                />
                <WebInfoRow label="Node" value={status.node ?? "—"} />
                {status.memory ? (
                  <>
                    <WebInfoRow
                      label="Heap used"
                      value={`${status.memory.heapUsedMb} MB`}
                    />
                    <WebInfoRow
                      label="Heap total"
                      value={`${status.memory.heapTotalMb ?? "—"} MB`}
                    />
                    <WebInfoRow
                      label="RSS"
                      value={`${status.memory.rssMb} MB`}
                    />
                  </>
                ) : null}
                {status.timestamp ? (
                  <WebInfoRow
                    label="Last updated"
                    value={new Date(status.timestamp).toLocaleString()}
                  />
                ) : null}
              </WebInfoCard>

              <WebInfoCard
                accent="db"
                title="Database & Redis"
              >
                <WebInfoRow
                  label="MongoDB"
                  value={status.database.ok ? "OK" : "Down"}
                />
                <WebInfoRow
                  label="DB latency"
                  value={
                    status.database.latencyMs != null
                      ? `${status.database.latencyMs} ms`
                      : "—"
                  }
                />
                <WebInfoRow
                  label="DB state"
                  value={status.database.state ?? status.database.error ?? "—"}
                />
                <WebInfoRow
                  label="Redis"
                  value={status.redis.ok ? "OK" : "Down"}
                />
                <WebInfoRow
                  label="Redis latency"
                  value={
                    status.redis.latencyMs != null
                      ? `${status.redis.latencyMs} ms`
                      : "—"
                  }
                />
                {status.redis.metrics ? (
                  <>
                    <WebInfoRow
                      label="Redis memory"
                      value={`${status.redis.metrics.usedMemoryMb} MB`}
                    />
                    <WebInfoRow
                      label="Redis clients"
                      value={String(status.redis.metrics.connectedClients)}
                    />
                    <WebInfoRow
                      label="Ops/sec"
                      value={String(status.redis.metrics.opsPerSec)}
                    />
                    <WebInfoRow
                      label="Keys"
                      value={String(status.redis.metrics.totalKeys)}
                    />
                    {status.redis.metrics.hitRate != null ? (
                      <WebInfoRow
                        label="Hit rate"
                        value={`${status.redis.metrics.hitRate}%`}
                      />
                    ) : null}
                    {status.redis.metrics.version ? (
                      <WebInfoRow
                        label="Redis version"
                        value={status.redis.metrics.version}
                      />
                    ) : null}
                  </>
                ) : (
                  <WebInfoRow
                    label="Redis state"
                    value={status.redis.state ?? status.redis.error ?? "—"}
                  />
                )}
              </WebInfoCard>
            </div>
          </section>

          <section className="admin-webinfo-section">
            <h4 className="admin-webinfo-section-title">Queues &amp; alerts</h4>
            <div className="admin-webinfo-grid">
              <div
                className="admin-webinfo-table-wrap admin-webinfo-card--queues overflow-x-auto"
              >
                <p className="border-b border-border/60 px-4 py-3 text-sm font-semibold text-foreground">
                  BullMQ queues
                </p>
                {queuesRedisOffline ? (
                  <p className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                    Redis is offline. Orders and delivery still work via sync
                    fallback in dev. Run{" "}
                    <code className="rounded bg-black/20 px-1 py-0.5 font-mono text-[11px]">
                      pnpm redis:up
                    </code>{" "}
                    to enable background queues.
                  </p>
                ) : null}
                <table className="panel-3d-table">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 font-medium">Queue</th>
                      <th className="px-4 py-3 font-medium">Waiting</th>
                      <th className="px-4 py-3 font-medium">Active</th>
                      <th className="px-4 py-3 font-medium">Completed</th>
                      <th className="px-4 py-3 font-medium">Failed</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-foreground-muted">
                    {queueEntries.map(([name, q]) => (
                      <tr key={name}>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {name}
                        </td>
                        <td className="px-4 py-3">{q.waiting ?? 0}</td>
                        <td className="px-4 py-3">{q.active ?? 0}</td>
                        <td className="px-4 py-3">{q.completed ?? 0}</td>
                        <td
                          className={`px-4 py-3 ${(q.failed ?? 0) > 0 ? "text-rose-400" : ""}`}
                        >
                          {q.failed ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          {q.ok === false ? (
                            <span
                              className={
                                q.redisOffline
                                  ? "text-amber-300"
                                  : "text-rose-400"
                              }
                            >
                              {queuesRedisOffline
                                ? "Redis offline"
                                : (q.error ?? "Error")}
                            </span>
                          ) : (
                            <span className="text-emerald-300">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {notifOverview ? (
                <WebInfoCard
                  accent="notif"
                  title="Notification channels"
                >
                  <WebInfoRow
                    label="Email"
                    value={
                      notifOverview.channels.email.configured
                        ? "Configured"
                        : "Sandbox"
                    }
                  />
                  <WebInfoRow
                    label="Push"
                    value={
                      notifOverview.channels.push.configured
                        ? "Configured"
                        : "Sandbox"
                    }
                  />
                  <WebInfoRow
                    label="Telegram"
                    value={
                      notifOverview.channels.telegram.configured
                        ? notifOverview.channels.telegram.enabled
                          ? "On"
                          : "Off"
                        : "Not configured"
                    }
                  />
                  {notifOverview.channels.telegram.configured ? (
                    <>
                      <WebInfoRow
                        label="Order alerts"
                        value={
                          notifOverview.channels.telegram.notifyOnOrderPlaced
                            ? "On"
                            : "Off"
                        }
                      />
                      <WebInfoRow
                        label="Chat alerts"
                        value={
                          notifOverview.channels.telegram.notifyOnCustomerChat
                            ? "On"
                            : "Off"
                        }
                      />
                    </>
                  ) : null}
                  <WebInfoRow
                    label="Queue waiting"
                    value={String(notifOverview.queue.waiting)}
                  />
                  <WebInfoRow
                    label="Queue failed"
                    value={String(notifOverview.queue.failed)}
                  />
                  <WebInfoRow
                    label="Event types"
                    value={String(notifOverview.events.length)}
                  />
                  <div className="admin-webinfo-action-links">
                    <Link
                      href="/admin/settings/telegram"
                      className="admin-webinfo-action-link admin-webinfo-action-link--telegram"
                    >
                      Telegram bot settings →
                    </Link>
                    <Link
                      href="/admin/settings/notifications"
                      className="admin-webinfo-action-link admin-webinfo-action-link--notif"
                    >
                      Notification config →
                    </Link>
                  </div>
                </WebInfoCard>
              ) : (
                <WebInfoCard
                  accent="notif"
                  title="Notification channels"
                >
                  <p className="text-sm text-subtle">
                    Notification data unavailable.
                  </p>
                </WebInfoCard>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  className = "text-foreground",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className="panel-3d-stat px-4 py-3">
      <p className="text-[10px] font-semibold uppercase text-subtle">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-bold capitalize ${className}`}>
        {value}
      </p>
    </div>
  );
}

function RoleStatusCard({
  title,
  entries,
}: {
  title: string;
  entries: Record<string, number>;
}) {
  const total = Object.values(entries).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="panel-3d-stat">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {Object.entries(entries).map(([key, count]) => (
          <li key={key}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="capitalize text-foreground-muted">{key}</span>
              <span className="text-foreground-muted">{count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-teal-500/60"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="panel-3d-table-wrap panel-stack-base overflow-x-auto">
      <p className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-subtle">No data</p>
      ) : (
        <table className="panel-3d-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-foreground-muted">
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
