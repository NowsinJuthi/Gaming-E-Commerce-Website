"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ChatIcon, CheckIcon, FileIcon, GridIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  getChatAdminOverview,
  getOnlineUsers,
  type ChatAdminOverview,
} from "@/lib/api";

const ONLINE_POLL_MS = 45_000;

type ChatStatusStatTone = "brand" | "success" | "amber" | "muted";

type ChatStatusOverviewItem = {
  key: string;
  tone: ChatStatusStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function ChatStatusOverviewStats({ items }: { items: ChatStatusOverviewItem[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-chat-status-overview"
      aria-label="Chat system overview"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone}`}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              {item.icon}
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                {item.label}
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {item.value}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                {item.meta}
              </p>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function LiveChatSystemStatusPanel() {
  const [overview, setOverview] = useState<ChatAdminOverview | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    try {
      const data = await getChatAdminOverview();
      setOverview(data);
    } catch {
      setOverview(null);
    }
  }, []);

  const loadOnline = useCallback(async () => {
    try {
      const ids = await getOnlineUsers();
      setOnline(Array.isArray(ids) ? ids : []);
    } catch {
      setOnline([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([loadOverview(), loadOnline()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadOverview, loadOnline]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadOnline();
    }, ONLINE_POLL_MS);
    return () => window.clearInterval(interval);
  }, [loadOnline]);

  const totalRooms =
    overview != null ? overview.openRooms + overview.closedRooms : 0;

  const overviewItems = useMemo<ChatStatusOverviewItem[]>(() => {
    if (!overview) return [];
    return [
      {
        key: "open",
        tone: "brand",
        icon: <ChatIcon className="h-4 w-4" />,
        label: "Open rooms",
        value: overview.openRooms.toLocaleString(),
        meta: "Active conversations",
      },
      {
        key: "closed",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Closed rooms",
        value: overview.closedRooms.toLocaleString(),
        meta: "Archived threads",
      },
      {
        key: "messages",
        tone: "amber",
        icon: <FileIcon className="h-4 w-4" />,
        label: "Messages",
        value: overview.totalMessages.toLocaleString(),
        meta: "All-time volume",
      },
      {
        key: "total",
        tone: "muted",
        icon: <GridIcon className="h-4 w-4" />,
        label: "Total rooms",
        value: totalRooms.toLocaleString(),
        meta: "Open + closed",
      },
    ];
  }, [overview, totalRooms]);

  return (
    <div className="space-y-4">
      <ProductFormOrderCard
        icon={<ChatIcon className="h-4 w-4" />}
        title="System status"
        subtitle={
          loading
            ? "Loading chat overview…"
            : overview
              ? `${overview.openRooms.toLocaleString()} open · ${overview.totalMessages.toLocaleString()} messages`
              : "Chat overview unavailable"
        }
        className="w-full"
      >
        {overview ? (
          <>
            <ChatStatusOverviewStats items={overviewItems} />

            <div className="mt-4">
              <Link
                href="/admin/chat"
                className="dashboard-pro-btn-ghost px-4 py-2 text-sm"
              >
                Open live chat console
              </Link>
            </div>
          </>
        ) : !loading ? (
          <p className="text-sm text-foreground-muted">
            Could not load chat overview. You can still open the live chat console
            to manage rooms.
          </p>
        ) : null}
      </ProductFormOrderCard>

      <ProductFormOrderCard
        icon={<ChatIcon className="h-4 w-4" />}
        title="Configuration"
        subtitle="Transport, namespace, and storage"
        className="w-full"
      >
        {overview ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                Transport
              </dt>
              <dd className="mt-0.5 text-foreground">{overview.transport}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                Namespace
              </dt>
              <dd className="mt-0.5 text-foreground">{overview.namespace}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                Storage
              </dt>
              <dd className="mt-0.5 text-foreground">MongoDB + Redis</dd>
            </div>
          </dl>
        ) : loading ? (
          <p className="text-sm text-foreground-muted">Loading…</p>
        ) : (
          <p className="text-sm text-foreground-muted">Configuration unavailable.</p>
        )}
      </ProductFormOrderCard>

      <ProductFormOrderCard
        icon={<ChatIcon className="h-4 w-4" />}
        title="Online presence"
        subtitle={`${online.length.toLocaleString()} user${online.length === 1 ? "" : "s"} connected`}
        className="w-full"
      >
        {online.length > 0 ? (
          <ul className="space-y-1 font-mono text-xs text-foreground-muted">
            {online.slice(0, 20).map((id) => (
              <li key={id} className="truncate">
                …{id.slice(-8)}
              </li>
            ))}
            {online.length > 20 ? (
              <li className="text-subtle">
                +{online.length - 20} more
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-foreground-muted">
            No users are currently connected to live chat.
          </p>
        )}
      </ProductFormOrderCard>
    </div>
  );
}
