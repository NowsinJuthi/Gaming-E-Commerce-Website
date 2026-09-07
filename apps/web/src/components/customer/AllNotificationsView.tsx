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
  BellIcon,
  CheckIcon,
  GridIcon,
  PulseIcon,
  SettingsIcon,
} from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import type { NotificationItem } from "@/lib/api";
import { ALL_NOTIFICATIONS_QUICK_LINKS } from "@/lib/customer-quick-links";

export type NotificationFilter = "all" | "unread" | "read";

type Props = {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  filter: NotificationFilter;
  showAll: boolean;
  remainingCount: number;
  error: string | null;
  busy: boolean;
  onFilterChange: (filter: NotificationFilter) => void;
  onPageChange: (page: number) => void;
  onShowAll: () => void;
  onMarkRead: (id: string) => void;
  onMarkAll: () => void;
};

const FILTER_TABS: readonly { id: NotificationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
];

function formatNotificationDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function AllNotificationsView({
  items,
  total,
  page,
  limit,
  filter,
  showAll,
  remainingCount,
  error,
  busy,
  onFilterChange,
  onPageChange,
  onShowAll,
  onMarkRead,
  onMarkAll,
}: Props) {
  const filteredItems = useMemo(() => {
    if (!showAll) return items;
    if (filter === "unread") return items.filter((n) => !n.read);
    if (filter === "read") return items.filter((n) => n.read);
    return items;
  }, [filter, items, showAll]);

  const unreadOnPage = items.filter((n) => !n.read).length;
  const readOnPage = items.filter((n) => n.read).length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, total);

  const introSubtitle = showAll
    ? total > 0
      ? `${total} ${total === 1 ? "alert" : "alerts"} · Page ${page} of ${totalPages}`
      : "Full notification history"
    : total > 0
      ? `Latest ${items.length} of ${total} alerts`
      : "Latest notifications";

  if (error) {
    return (
      <>
        <AdminOrderPageIntro
          icon={<BellIcon className="h-4 w-4" />}
          title="All notifications"
          subtitle="Could not load notifications"
          quickLinks={ALL_NOTIFICATIONS_QUICK_LINKS}
          quickNavLabel="Account shortcuts"
        />
        <AdminOrderTwoColumnLayout
          main={
            <AdminOrderListCard
              icon={<BellIcon className="h-4 w-4" />}
              title="All notifications"
              subtitle="Complete alert history"
            >
              <div className="dashboard-pro-empty py-8">
                <span className="dashboard-pro-empty-icon" aria-hidden>
                  <GridIcon className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium text-foreground">{error}</p>
                <Link href="/chat" className="dashboard-pro-btn mt-4">
                  Contact support
                </Link>
              </div>
            </AdminOrderListCard>
          }
          sidebar={<NotificationsHelpSidebar />}
        />
      </>
    );
  }

  return (
    <>
      <AdminOrderPageIntro
        icon={<BellIcon className="h-4 w-4" />}
        title="All notifications"
        subtitle={introSubtitle}
        quickLinks={ALL_NOTIFICATIONS_QUICK_LINKS}
        quickNavLabel="Account shortcuts"
      />

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<BellIcon className="h-4 w-4" />}
              title="Notification history"
              subtitle={
                showAll
                  ? total > 0
                    ? `Showing ${pageStart}–${pageEnd} of ${total} · ${unreadOnPage} unread on this page`
                    : "Browse every alert in your account"
                  : total > 0
                    ? `Latest ${items.length} notifications · ${total} total`
                    : "Your most recent alerts"
              }
            >
              <AdminOrderStatsGrid>
                <AdminOrderStatField
                  icon={<BellIcon className="h-4 w-4" />}
                  label="Total alerts"
                  value={total.toLocaleString()}
                  meta="All-time notifications"
                />
                <AdminOrderStatField
                  icon={<PulseIcon className="h-4 w-4" />}
                  label="Unread (page)"
                  value={unreadOnPage.toLocaleString()}
                  meta="On current page"
                />
                <AdminOrderStatField
                  icon={<CheckIcon className="h-4 w-4" />}
                  label="Read (page)"
                  value={readOnPage.toLocaleString()}
                  meta="On current page"
                />
                <AdminOrderStatField
                  icon={<SettingsIcon className="h-4 w-4" />}
                  label={showAll ? "Page" : "Showing"}
                  value={showAll ? `${page}/${totalPages}` : String(items.length)}
                  meta={showAll ? `${limit} per page` : "Latest alerts"}
                />
              </AdminOrderStatsGrid>

              {showAll ? (
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked border-t border-border/60 pt-4">
                  <dt>Filter</dt>
                  <dd>
                    <div className="admin-notifications-tabs" role="tablist">
                      {FILTER_TABS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="tab"
                          aria-selected={filter === t.id}
                          onClick={() => onFilterChange(t.id)}
                          className={`admin-notifications-tab${
                            filter === t.id
                              ? " admin-notifications-tab--active"
                              : ""
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </dd>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2.5">
                {unreadOnPage > 0 ? (
                  <button
                    type="button"
                    onClick={onMarkAll}
                    disabled={busy}
                    className="dashboard-pro-btn text-xs disabled:opacity-50"
                  >
                    {busy ? "Updating…" : "Mark all read"}
                  </button>
                ) : null}
                <Link
                  href="/notifications"
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Notifications overview
                </Link>
                <Link
                  href="/profile?tab=notifications"
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Notification settings
                </Link>
              </div>
            </AdminOrderListCard>

            <AdminOrderListCard
              icon={<BellIcon className="h-4 w-4" />}
              title={showAll ? "All notifications" : "Latest notifications"}
              subtitle={
                showAll
                  ? filter === "all"
                    ? "Order updates, wallet activity, and account alerts"
                    : filter === "unread"
                      ? "Unread alerts on this page"
                      : "Read alerts on this page"
                  : `Last ${items.length} alerts · ${total} total in your account`
              }
              className="admin-product-form-section"
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Alerts</dt>
                <dd>
                  {filteredItems.length === 0 ? (
                    <div className="dashboard-pro-empty py-8">
                      <span className="dashboard-pro-empty-icon" aria-hidden>
                        <GridIcon className="h-6 w-6" />
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        {filter === "all"
                          ? "No notifications on this page"
                          : `No ${filter} notifications on this page`}
                      </p>
                      {filter !== "all" ? (
                        <button
                          type="button"
                          onClick={() => onFilterChange("all")}
                          className="dashboard-pro-btn mt-4 text-xs"
                        >
                          Show all
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                        <table className="panel-3d-table w-full text-sm">
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>Type</th>
                              <th>Message</th>
                              <th>Status</th>
                              <th>Date</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {filteredItems.map((n) => (
                              <tr key={n._id} className="text-foreground-muted">
                                <td className="font-medium text-foreground">
                                  {n.title}
                                </td>
                                <td className="capitalize">
                                  {n.type
                                    ? n.type.replace(/\./g, " ")
                                    : "—"}
                                </td>
                                <td className="max-w-[220px] truncate">
                                  {n.body ?? "—"}
                                </td>
                                <td>
                                  <span
                                    className={`dashboard-pro-status text-[10px] ${
                                      n.read
                                        ? ""
                                        : "dashboard-pro-status--amber"
                                    }`}
                                  >
                                    {n.read ? "Read" : "Unread"}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap">
                                  {formatNotificationDate(n.createdAt)}
                                </td>
                                <td className="text-right">
                                  {!n.read ? (
                                    <button
                                      type="button"
                                      onClick={() => onMarkRead(n._id)}
                                      disabled={busy}
                                      className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                                    >
                                      Mark read
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {showAll && totalPages > 1 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                          <p className="text-xs text-foreground-muted">
                            Page {page} of {totalPages} · {total} total
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onPageChange(page - 1)}
                              disabled={page <= 1 || busy}
                              className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                            >
                              Previous
                            </button>
                            <button
                              type="button"
                              onClick={() => onPageChange(page + 1)}
                              disabled={page >= totalPages || busy}
                              className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {!showAll && total > items.length ? (
                        <div className="flex justify-center border-t border-border/60 pt-4">
                          <button
                            type="button"
                            onClick={onShowAll}
                            disabled={busy}
                            className="dashboard-pro-btn text-xs disabled:opacity-50"
                          >
                            {remainingCount > 0
                              ? `Show all notifications (${remainingCount} more)`
                              : "Show all notifications"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </dd>
              </div>
            </AdminOrderListCard>
          </>
        }
        sidebar={<NotificationsHelpSidebar />}
      />
    </>
  );
}

function NotificationsHelpSidebar() {
  return (
    <>
      <ProductFormOrderCard
        icon={<BellIcon className="h-4 w-4" />}
        title="All notifications guide"
        subtitle="Browse your full alert history"
        className="admin-product-form-section"
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Full history</dt>
          <dd className="text-sm text-foreground-muted">
            The latest 10 alerts show first. Use the button below to open the
            full paginated list with filters.
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Overview</dt>
          <dd className="text-sm text-foreground-muted">
            Quick stats and recent alerts are on the{" "}
            <Link href="/notifications" className="text-accent hover:underline">
              notifications overview
            </Link>
            .
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Preferences</dt>
          <dd className="text-sm text-foreground-muted">
            Manage channels and event alerts in{" "}
            <Link href="/profile?tab=notifications" className="text-accent hover:underline">
              Account settings
            </Link>
            .
          </dd>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        icon={<SettingsIcon className="h-4 w-4" />}
        title="Need help?"
        subtitle="Alerts and account support"
        className="admin-product-form-section"
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Support</dt>
          <dd className="space-y-3 text-sm text-foreground-muted">
            <p>
              Missing an expected alert? Contact support with the notification
              title and date.
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
  );
}
