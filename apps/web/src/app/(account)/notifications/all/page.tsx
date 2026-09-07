"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AllNotificationsView,
  type NotificationFilter,
} from "@/components/customer/AllNotificationsView";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api";

const PREVIEW_LIMIT = 10;
const PAGE_LIMIT = 25;

export default function AllNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (pageNum: number, fullList: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const limit = fullList ? PAGE_LIMIT : PREVIEW_LIMIT;
      const data = await getNotifications({
        page: pageNum,
        limit,
        audience: "customer",
        excludeChat: true,
      });
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch {
      setItems([]);
      setTotal(0);
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, false);
  }, [load]);

  function showFullList() {
    setShowAll(true);
    setFilter("all");
    void load(1, true);
  }

  async function markRead(id: string) {
    const prev = items;
    setItems((cur) =>
      cur.map((n) => (n._id === id ? { ...n, read: true } : n)),
    );
    try {
      await markNotificationRead(id);
    } catch {
      setItems(prev);
    }
  }

  async function markAll() {
    setBusy(true);
    const prev = items;
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead("customer");
    } catch {
      setItems(prev);
    } finally {
      setBusy(false);
    }
  }

  const unreadOnPage = items.filter((n) => !n.read).length;
  const remainingCount = Math.max(0, total - items.length);

  const headerAction = useMemo(() => {
    if (loading || error) return null;

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--brand">
          {total} total
        </span>
        {unreadOnPage > 0 ? (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            {unreadOnPage} unread
          </span>
        ) : (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            {showAll ? "Page read" : "Latest read"}
          </span>
        )}
        {showAll ? (
          <span className="dashboard-pro-status">
            Page {page}/{Math.max(1, Math.ceil(total / PAGE_LIMIT))}
          </span>
        ) : (
          <span className="dashboard-pro-status">Latest {items.length}</span>
        )}
      </div>
    );
  }, [error, items.length, loading, page, showAll, total, unreadOnPage]);

  return (
    <CustomerPageLayout
      section="Account"
      title="All notifications"
      description={
        showAll
          ? "Full notification history with filters and pagination."
          : "Latest notifications — expand to view full history."
      }
      iconKey="notifications"
      backHref="/notifications"
      backLabel="Notifications"
      loading={loading}
      loadingText="Loading all notifications…"
      action={headerAction}
    >
      <AllNotificationsView
        items={items}
        total={total}
        page={page}
        limit={showAll ? PAGE_LIMIT : PREVIEW_LIMIT}
        filter={filter}
        showAll={showAll}
        remainingCount={remainingCount}
        error={error}
        busy={busy}
        onFilterChange={setFilter}
        onPageChange={(next) => void load(next, true)}
        onShowAll={showFullList}
        onMarkRead={(id) => void markRead(id)}
        onMarkAll={() => void markAll()}
      />
    </CustomerPageLayout>
  );
}
