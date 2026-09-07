"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  BellIcon,
  BoxIcon,
  ChatIcon,
  DollarIcon,
  GridIcon,
  KeyIcon,
  LinkIcon,
  MailIcon,
  PulseIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  StoreIcon,
  SunIcon,
  TruckIcon,
  UsersIcon,
  ImageAttachIcon,
} from "@/components/admin/icons";
import {
  getSystemStatus,
  type SystemStatus,
} from "@/lib/api";
import { useLicenseStatus } from "@/hooks/useLicenseStatus";
import { isLicenseRouteAllowed } from "@/lib/license-features";

type SettingsModule = {
  href: Route;
  label: string;
  description: string;
  group: SettingsGroup;
  icon: ComponentType<{ className?: string }>;
};

type SettingsGroup =
  | "Operations"
  | "Commerce"
  | "Access"
  | "Communications"
  | "Brand";

const SETTINGS_MODULES: SettingsModule[] = [
  {
    href: "/admin/settings/license",
    label: "License key",
    description: "Amarpin activation, validation, and feature access.",
    group: "Access",
    icon: KeyIcon,
  },
  {
    href: "/admin/settings/suppliers",
    label: "Suppliers",
    description: "Upstream integrations, priority, and health.",
    group: "Operations",
    icon: TruckIcon,
  },
  {
    href: "/admin/settings/delivery",
    label: "Manual Delivery",
    description: "Pipeline, queue, order fields, and customer notes.",
    group: "Operations",
    icon: PulseIcon,
  },
  {
    href: "/admin/settings/payments",
    label: "Payment gateways",
    description: "Online gateways, MFS send-money, guest checkout, and sandbox modes.",
    group: "Commerce",
    icon: DollarIcon,
  },
  {
    href: "/admin/settings/customer-panel",
    label: "Customer panel",
    description: "Navigation, storefront, rewards, checkout, and guest orders.",
    group: "Commerce",
    icon: UsersIcon,
  },
  {
    href: "/admin/settings/security",
    label: "Security",
    description: "Rate limits, reCAPTCHA, Cloudflare, audit logs.",
    group: "Access",
    icon: ShieldIcon,
  },
  {
    href: "/admin/settings/roles",
    label: "Roles & permissions",
    description: "Staff access levels and capability groups.",
    group: "Access",
    icon: KeyIcon,
  },
  {
    href: "/admin/settings/notifications",
    label: "Notifications",
    description: "Email, push, and Telegram delivery channels.",
    group: "Communications",
    icon: BellIcon,
  },
  {
    href: "/admin/settings/telegram",
    label: "Telegram bot",
    description: "Order alerts to your Telegram chat with full order details.",
    group: "Communications",
    icon: ChatIcon,
  },
  {
    href: "/admin/settings/email",
    label: "Email / SMTP",
    description: "Sender identities, SMTP, and templates.",
    group: "Communications",
    icon: MailIcon,
  },
  {
    href: "/admin/settings/seo",
    label: "SEO management",
    description: "Meta tags, sitemap, robots.txt, and analyzer.",
    group: "Communications",
    icon: SearchIcon,
  },
  {
    href: "/admin/settings/contact",
    label: "Contact page",
    description: "Public /contact page heading, description, and info cards.",
    group: "Communications",
    icon: MailIcon,
  },
  {
    href: "/admin/settings/website",
    label: "Website pricing",
    description: "Public /website pricing packages, features, and prices.",
    group: "Communications",
    icon: GridIcon,
  },
  {
    href: "/admin/settings/appearance",
    label: "Appearance & theme",
    description: "Logos, accent colors, and light/dark branding.",
    group: "Brand",
    icon: SunIcon,
  },
  {
    href: "/admin/settings/menus",
    label: "Header & footer menus",
    description: "Storefront header links and footer navigation columns.",
    group: "Brand",
    icon: LinkIcon,
  },
  {
    href: "/admin/settings/homepage",
    label: "Homepage slider",
    description: "Hero banner carousel images on the storefront homepage.",
    group: "Brand",
    icon: ImageAttachIcon,
  },
  {
    href: "/admin/settings/appearance/logos",
    label: "Logos",
    description: "Light and dark logos for header, footer, and admin.",
    group: "Brand",
    icon: StoreIcon,
  },
  {
    href: "/admin/settings/appearance/theme",
    label: "Theme & colors",
    description: "Palette, accent, and theme presets.",
    group: "Brand",
    icon: SunIcon,
  },
];

const MODULE_GROUPS = [
  "Operations",
  "Commerce",
  "Access",
  "Communications",
  "Brand",
] as const;

const MODULES_BY_GROUP = MODULE_GROUPS.map((group) => ({
  group,
  modules: SETTINGS_MODULES.filter((item) => item.group === group),
})).filter((entry) => entry.modules.length > 0);

const MODULE_COUNT = SETTINGS_MODULES.length;

const GROUP_ACCENTS = {
  Operations: "brand",
  Commerce: "accent",
  Access: "success",
  Communications: "amber",
  Brand: "brand",
} as const;

type GroupAccent = (typeof GROUP_ACCENTS)[keyof typeof GROUP_ACCENTS];

const GROUP_META: Record<
  (typeof MODULE_GROUPS)[number],
  { icon: ComponentType<{ className?: string }>; accent: GroupAccent }
> = {
  Operations: { icon: TruckIcon, accent: "brand" },
  Commerce: { icon: DollarIcon, accent: "accent" },
  Access: { icon: ShieldIcon, accent: "success" },
  Communications: { icon: BellIcon, accent: "amber" },
  Brand: { icon: StoreIcon, accent: "brand" },
};

function sumFailedJobs(queues?: SystemStatus["queues"]) {
  if (!queues || typeof queues !== "object") return 0;
  let total = 0;
  for (const queue of Object.values(queues)) {
    if (!queue || typeof queue !== "object") continue;
    total += queue.failed ?? 0;
  }
  return total;
}

function normalizeSystemStatus(raw: SystemStatus): SystemStatus {
  return {
    ...raw,
    database: raw.database ?? { ok: false, error: "Unavailable" },
    redis: raw.redis ?? { ok: false, error: "Unavailable" },
    queues:
      raw.queues && typeof raw.queues === "object" ? raw.queues : {},
  };
}

function formatUptime(seconds?: number) {
  if (seconds == null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function loadingValue(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type PlatformStatTone = "brand" | "success" | "amber" | "muted";

type PlatformStatItem = {
  key: string;
  tone: PlatformStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  meta: string;
};

function PlatformHealthOverviewStats({ items }: { items: PlatformStatItem[] }) {
  return (
    <section
      className="admin-general-health-panel"
      aria-label="Platform health overview"
    >
      <span
        className="admin-general-health-panel__glow admin-general-health-panel__glow--1"
        aria-hidden
      />
      <span
        className="admin-general-health-panel__glow admin-general-health-panel__glow--2"
        aria-hidden
      />
      <div className="admin-general-health-panel__content">
        <header className="admin-general-health-panel__head">
          <span className="admin-general-health-panel__head-icon" aria-hidden>
            <PulseIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="admin-general-health-panel__title">Platform health</h2>
            <p className="admin-general-health-panel__sub">
              Live system, database, cache, and queue status
            </p>
          </div>
        </header>
        <section className="customer-dashboard-overview-section admin-general-settings-overview">
          <dl className="customer-dashboard-overview-stats">
            {items.map((item, index) => (
              <div
                key={item.key}
                className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-general-health-stat`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span
                  className="customer-dashboard-overview-stat-glow"
                  aria-hidden
                />
                <span
                  className={`customer-dashboard-overview-stat-icon admin-general-health-stat-icon admin-general-health-stat-icon--${item.tone}`}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <div className="customer-dashboard-overview-stat-copy min-w-0">
                  <dt className="customer-dashboard-overview-stat-label">
                    {item.label}
                  </dt>
                  <dd
                    className={[
                      "customer-dashboard-overview-stat-value",
                      item.valueClassName,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
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
      </div>
    </section>
  );
}

function GeneralGroupHeaderIcon({
  icon: Icon,
  accent,
  delayMs = 0,
}: {
  icon: ComponentType<{ className?: string }>;
  accent: GroupAccent;
  delayMs?: number;
}) {
  return (
    <span
      className={`admin-general-group-head-icon admin-general-group-head-icon--${accent}`}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden
    >
      <span className="admin-general-group-head-icon__ring" />
      <span className="admin-general-group-head-icon__shell">
        <Icon className="h-5 w-5" />
      </span>
    </span>
  );
}

function GeneralModuleIcon({
  icon: Icon,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  accent: GroupAccent;
}) {
  return (
    <span
      className={`admin-general-module-icon admin-general-module-icon--${accent}`}
      aria-hidden
    >
      <span className="admin-general-module-icon__ring" />
      <span className="admin-general-module-icon__shell">
        <Icon className="h-5 w-5" />
      </span>
    </span>
  );
}

export default function AdminGeneralSettingsPage() {
  const [sys, setSys] = useState<SystemStatus | null>(null);
  const [sysLoading, setSysLoading] = useState(true);
  const { status: licenseStatus } = useLicenseStatus();

  useEffect(() => {
    let cancelled = false;

    getSystemStatus()
      .then((status) => {
        if (!cancelled && status) setSys(normalizeSystemStatus(status));
      })
      .catch(() => {
        if (!cancelled) setSys(null);
      })
      .finally(() => {
        if (!cancelled) setSysLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const healthy = sys?.status === "healthy";
  const queueCount = sys?.queues ? Object.keys(sys.queues).length : 0;
  const failedJobs = sys ? sumFailedJobs(sys.queues) : 0;
  const statsPending = sysLoading && !sys;

  const platformStats = useMemo<PlatformStatItem[]>(() => {
    const systemStatus = statsPending
      ? "…"
      : (sys?.status ?? "—").replace(/^\w/, (char) => char.toUpperCase());
    const databaseOnline = !statsPending && Boolean(sys?.database.ok);
    const redisOnline = !statsPending && Boolean(sys?.redis.ok);

    return [
      {
        key: "system",
        tone: statsPending ? "muted" : healthy ? "success" : "amber",
        icon: <SettingsIcon className="h-4 w-4" />,
        label: "System",
        value: systemStatus,
        valueClassName:
          !statsPending && !healthy ? "text-amber-300" : undefined,
        meta: `Uptime ${loadingValue(statsPending, formatUptime(sys?.uptimeSeconds))}`,
      },
      {
        key: "database",
        tone: statsPending ? "muted" : databaseOnline ? "success" : "amber",
        icon: <BoxIcon className="h-4 w-4" />,
        label: "Database",
        value: statsPending ? "…" : databaseOnline ? "Online" : "Issue",
        valueClassName: statsPending
          ? undefined
          : databaseOnline
            ? "text-emerald-300"
            : "text-amber-300",
        meta: statsPending
          ? "…"
          : sys?.database.latencyMs != null
            ? `${sys.database.latencyMs}ms latency`
            : sys?.database.state ?? "Status unknown",
      },
      {
        key: "redis",
        tone: statsPending ? "muted" : redisOnline ? "brand" : "amber",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Redis",
        value: statsPending ? "…" : redisOnline ? "Connected" : "Down",
        valueClassName: statsPending
          ? undefined
          : redisOnline
            ? "text-emerald-300"
            : "text-rose-400",
        meta: statsPending
          ? "…"
          : redisOnline && sys?.redis.metrics?.totalKeys != null
            ? `${sys.redis.metrics.totalKeys.toLocaleString()} cache keys`
            : sys?.redis.error ?? sys?.redis.state ?? "Cache layer",
      },
      {
        key: "queues",
        tone: statsPending ? "muted" : failedJobs > 0 ? "amber" : "brand",
        icon: <GridIcon className="h-4 w-4" />,
        label: "Background jobs",
        value: statsPending ? "…" : queueCount.toLocaleString(),
        meta: statsPending
          ? "…"
          : failedJobs > 0
            ? `${failedJobs.toLocaleString()} failed jobs`
            : "Queues monitored",
      },
    ];
  }, [failedJobs, healthy, queueCount, statsPending, sys]);

  return (
    <AdminPageLayout
      section="Settings"
      title="General"
      description="Store-wide preferences, platform health, and quick access to every settings module."
      icon={SettingsIcon}
      backHref="/admin"
      backLabel="Dashboard"
      action={
        statsPending ? null : sys ? (
          <span
            className={`dashboard-pro-status inline-flex ${
              healthy
                ? "dashboard-pro-status--green"
                : "dashboard-pro-status--amber"
            }`}
          >
            {healthy ? "Platform healthy" : sys.status}
          </span>
        ) : null
      }
    >
      <div className="admin-general-page">
        {sys || statsPending ? (
          <PlatformHealthOverviewStats items={platformStats} />
        ) : null}

        <section className="admin-general-modules-panel">
          <span
            className="admin-general-modules-panel__glow"
            aria-hidden
          />
          <header className="admin-general-modules-intro">
            <div className="admin-general-modules-intro__copy">
              <span className="admin-general-modules-intro__icon" aria-hidden>
                <SettingsIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="admin-general-modules-intro__title">Settings modules</h2>
                <p className="admin-general-modules-intro__sub">
                  {MODULE_COUNT} modules · store-wide configuration
                </p>
              </div>
            </div>
            <Link
              href="/admin/settings/email"
              prefetch={false}
              className="admin-general-modules__action"
            >
              Edit store email
            </Link>
          </header>
        </section>

        <div className="admin-general-groups-stack">
          {MODULES_BY_GROUP.map(({ group, modules }, groupIndex) => {
            const accent = GROUP_ACCENTS[group];
            const groupMeta = GROUP_META[group];

            return (
              <section
                key={group}
                className={`admin-general-group-panel admin-general-group-panel--${accent}`}
                style={{ animationDelay: `${groupIndex * 80}ms` }}
              >
                <span
                  className="admin-general-group-panel__glow"
                  aria-hidden
                />
                <header className="admin-general-group-panel__head">
                  <GeneralGroupHeaderIcon
                    icon={groupMeta.icon}
                    accent={accent}
                    delayMs={groupIndex * 120}
                  />
                  <div>
                    <h3 className="admin-general-group__title">{group}</h3>
                    <p className="admin-general-group__sub">
                      {modules.length} module{modules.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </header>

                <div className="admin-general-group-panel__body">
                  <div className="admin-general-group__grid">
                    {modules.map((module) => {
                      const Icon = module.icon;
                      const licensed = isLicenseRouteAllowed(
                        module.href,
                        licenseStatus?.features,
                      );

                      return (
                        <Link
                          key={module.href}
                          href={module.href}
                          prefetch={false}
                          className={`admin-general-module-card admin-general-module-card--${accent}${
                            licensed ? "" : " opacity-75"
                          }`}
                        >
                          <span
                            className="admin-general-module-card__shine"
                            aria-hidden
                          />
                          <div className="admin-general-module-card__main">
                            <GeneralModuleIcon icon={Icon} accent={accent} />
                            <div className="min-w-0 flex-1">
                              <p className="admin-general-module-card__label">
                                {module.label}
                                {!licensed ? (
                                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                                    License
                                  </span>
                                ) : null}
                              </p>
                              <p className="admin-general-module-card__desc">
                                {module.description}
                              </p>
                            </div>
                          </div>
                          <span
                            className="admin-general-module-card__go"
                            aria-hidden
                          >
                            Open
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AdminPageLayout>
  );
}
