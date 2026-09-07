"use client";

import Link from "next/link";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { BellIcon, GridIcon } from "@/components/admin/icons";
import { CustomerNotificationsOverviewCard } from "@/components/customer/CustomerNotificationsOverviewCard";
import { NotificationAlertList } from "@/components/customer/NotificationAlertList";
import type { NotificationItem } from "@/lib/api";

type Props = {
  items: NotificationItem[];
  error: string | null;
  busy: boolean;
  onMarkRead: (id: string) => void;
  onMarkAll?: () => void;
};

export function NotificationsView({
  items,
  error,
  busy,
  onMarkRead,
  onMarkAll,
}: Props) {
  const unreadCount = items.filter((n) => !n.read).length;

  if (error) {
    return (
      <div className="customer-notifications-page">
        <AdminOrderListCard
          icon={<GridIcon className="h-4 w-4" />}
          title="Could not load"
          subtitle="Notifications unavailable"
          className="admin-notifications-catalog customer-notifications-card"
        >
          <div className="dashboard-pro-empty py-8">
            <span className="dashboard-pro-empty-icon" aria-hidden>
              <GridIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-foreground">{error}</p>
            <p className="mt-1 text-xs text-subtle">
              Try refreshing the page or contact support if the problem
              continues.
            </p>
            <Link href="/chat" className="dashboard-pro-btn mt-4">
              Contact support
            </Link>
          </div>
        </AdminOrderListCard>
      </div>
    );
  }

  return (
    <div className="customer-notifications-page">
      <AdminOrderListCard
        icon={<BellIcon className="h-4 w-4" />}
        title="Notifications overview"
        subtitle={
          items.length > 0
            ? `${items.length} alerts · ${unreadCount} unread`
            : "Order updates, wallet activity, and account alerts"
        }
        className="admin-notifications-catalog customer-notifications-card"
      >
        <CustomerNotificationsOverviewCard items={items} />

        <div className="flex flex-wrap justify-end gap-2.5">
          <Link href="/dashboard" className="dashboard-pro-btn-ghost text-xs">
            Dashboard
          </Link>
          <Link href="/notifications/all" className="dashboard-pro-btn-ghost text-xs">
            View all
          </Link>
          {onMarkAll && unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAll}
              disabled={busy}
              className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
            >
              {busy ? "Updating…" : "Mark all read"}
            </button>
          ) : null}
        </div>

        <div className="admin-products-filters-list">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-strong/40 pb-4">
            <p className="text-sm font-semibold text-foreground">
              Recent notifications
            </p>
            <span className="text-xs text-foreground-muted">
              {items.length > 0
                ? `Latest ${items.length} alerts`
                : "No alerts yet"}
            </span>
          </div>
        </div>

        <NotificationAlertList
          items={items}
          busy={busy}
          onMarkRead={onMarkRead}
          footerLink={{
            href: "/notifications/all",
            label: "View all notifications",
          }}
          emptyAction={{ href: "/products", label: "Browse store" }}
        />
      </AdminOrderListCard>
    </div>
  );
}
