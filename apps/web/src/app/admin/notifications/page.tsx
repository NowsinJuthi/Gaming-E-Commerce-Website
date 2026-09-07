"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { NotificationsView } from "@/components/customer/NotificationsView";
import { BellIcon } from "@/components/admin/icons";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api";

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getNotifications({ limit: 20, audience: "staff", excludeChat: true })
      .then((list) => {
        if (!cancelled) setItems(list.items);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setError("Could not load notifications.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const markAll = useCallback(async () => {
    setBusy(true);
    const prev = items;
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead("staff");
    } catch {
      setItems(prev);
    } finally {
      setBusy(false);
    }
  }, [items]);

  const headerAction = useMemo(() => {
    if (loading || error) return null;

    const unreadCount = items.filter((n) => !n.read).length;

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--brand">
          {items.length} total
        </span>
        {unreadCount > 0 ? (
          <>
            <span className="dashboard-pro-status dashboard-pro-status--amber">
              {unreadCount} unread
            </span>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={busy}
              className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
            >
              {busy ? "Updating…" : "Mark all read"}
            </button>
          </>
        ) : (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            All read
          </span>
        )}
      </div>
    );
  }, [busy, error, items, loading, markAll]);

  return (
    <AdminPageLayout
      section="Administration"
      title="Staff notifications"
      description="Ticket assignments, customer replies, and other admin alerts."
      icon={BellIcon}
      backHref="/admin"
      backLabel="Dashboard"
      loading={loading}
      loadingText="Loading notifications…"
      action={headerAction}
    >
      <NotificationsView
        items={items}
        error={error}
        busy={busy}
        onMarkRead={(id) => void markRead(id)}
        onMarkAll={() => void markAll()}
      />
    </AdminPageLayout>
  );
}
