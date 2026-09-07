"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerPageLayout } from "@/components/customer/CustomerPageLayout";
import { NotificationsView } from "@/components/customer/NotificationsView";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api";

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getNotifications({ limit: 20, audience: "customer", excludeChat: true })
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

  const unreadCount = items.filter((n) => !n.read).length;

  const headerAction = useMemo(() => {
    if (loading || error) return null;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <span className="dashboard-pro-status dashboard-pro-status--brand">
          {items.length} total
        </span>
        {unreadCount > 0 ? (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            {unreadCount} unread
          </span>
        ) : (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            All read
          </span>
        )}
      </div>
    );
  }, [error, items.length, loading, unreadCount]);

  return (
    <CustomerPageLayout
      section="Account"
      title="Notifications"
      description="Order updates, wallet activity, and account alerts."
      iconKey="notifications"
      backHref="/dashboard"
      backLabel="Dashboard"
      loading={loading && !error}
      loadingText="Loading notifications…"
      action={loading || error ? null : headerAction}
    >
      <NotificationsView
        items={items}
        error={error}
        busy={busy}
        onMarkRead={(id) => void markRead(id)}
        onMarkAll={() => void markAll()}
      />
    </CustomerPageLayout>
  );
}
