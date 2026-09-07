"use client";

import type { ReactNode } from "react";
import { BellIcon, CheckIcon, PulseIcon } from "@/components/admin/icons";
import type { NotificationItem } from "@/lib/api";

type StatTone = "brand" | "success" | "amber" | "muted";

type OverviewStat = {
  key: string;
  tone: StatTone;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  meta: string;
};

type Props = {
  items: NotificationItem[];
};

export function CustomerNotificationsOverviewCard({ items }: Props) {
  const unreadCount = items.filter((n) => !n.read).length;
  const readCount = items.length - unreadCount;

  const stats: OverviewStat[] = [
    {
      key: "total",
      tone: "brand",
      icon: <BellIcon className="h-4 w-4" aria-hidden />,
      label: "Total alerts",
      value: items.length.toLocaleString(),
      meta: "All notifications",
    },
    {
      key: "unread",
      tone: "amber",
      icon: <PulseIcon className="h-4 w-4" aria-hidden />,
      label: "Unread",
      value: unreadCount.toLocaleString(),
      meta: "Needs your attention",
    },
    {
      key: "read",
      tone: "success",
      icon: <CheckIcon className="h-4 w-4" aria-hidden />,
      label: "Read",
      value: readCount.toLocaleString(),
      meta: "Already viewed",
    },
    {
      key: "latest",
      tone: "brand",
      icon: <BellIcon className="h-4 w-4" aria-hidden />,
      label: "Latest alert",
      value: items[0]?.createdAt
        ? new Date(items[0].createdAt).toLocaleDateString()
        : "—",
      meta: "Most recent notification",
    },
  ];

  return (
    <section
      className="customer-dashboard-overview-section"
      aria-labelledby="customer-notifications-overview-title"
    >
      <dl className="customer-dashboard-overview-stats">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${stat.tone}`}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className="customer-dashboard-overview-stat-icon"
              aria-hidden
            >
              {stat.icon}
            </span>
            <div className="customer-dashboard-overview-stat-copy min-w-0">
              <dt className="customer-dashboard-overview-stat-label">
                {stat.label}
              </dt>
              <dd className="customer-dashboard-overview-stat-value">
                {stat.value}
              </dd>
              <p className="customer-dashboard-overview-stat-meta">
                {stat.meta}
              </p>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
