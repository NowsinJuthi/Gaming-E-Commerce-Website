"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import type { Route } from "next";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  BellIcon,
  ChatIcon,
  CheckIcon,
  MailIcon,
  PulseIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  adminDispatchNotification,
  adminListNotificationDeliveries,
  getNotificationAdminOverview,
  type NotificationAdminOverview,
  type NotificationDelivery,
} from "@/lib/api";

type Tab = "channels" | "events" | "deliveries" | "test";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "channels", label: "Channels" },
  { id: "events", label: "Events" },
  { id: "deliveries", label: "Delivery log" },
  { id: "test", label: "Test dispatch" },
];

const CHANNEL_LABELS: Record<string, string> = {
  in_app: "In-app",
  email: "Email",
  push: "Push",
  telegram: "Telegram",
};

const EVENT_GROUPS: Array<{ label: string; prefix: string }> = [
  { label: "Account", prefix: "user." },
  { label: "Orders", prefix: "order." },
  { label: "Wallet", prefix: "wallet." },
  { label: "Affiliate", prefix: "affiliate." },
  { label: "Support", prefix: "ticket." },
];

const CHANNEL_FILTER_OPTIONS = [
  { value: "", label: "All channels" },
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "telegram", label: "Telegram" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
  { value: "pending", label: "Pending" },
];

const DELIVERIES_PAGE_SIZE = 20;

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type NotificationStatTone = "brand" | "success" | "amber" | "muted";

type NotificationsOverviewStat = {
  key: string;
  tone: NotificationStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function NotificationsOverviewStats({
  items,
}: {
  items: NotificationsOverviewStat[];
}) {
  return (
    <section
      className="customer-dashboard-overview-section admin-notifications-overview"
      aria-label="Notifications overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-notifications-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-notifications-overview-stat-icon admin-notifications-overview-stat-icon--${item.tone}`}
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

function countLiveChannels(overview: NotificationAdminOverview) {
  return [
    overview.channels.email.configured,
    overview.channels.push.configured,
    overview.channels.telegram.configured,
  ].filter(Boolean).length;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

function emailChannelDetails(
  email: NotificationAdminOverview["channels"]["email"],
): string[] {
  const lines = [`From: ${email.from}`];
  if (email.host) lines.push(`SMTP: ${email.host}`);
  if (email.mockMode) {
    lines.push("Mock mode is on in Email / SMTP settings.");
  } else if (email.enabled === false) {
    lines.push("Email delivery is disabled in Email / SMTP settings.");
  } else if (!email.configured) {
    lines.push("Configure SMTP in Settings → Email / SMTP.");
  } else {
    lines.push("Live via admin SMTP settings.");
  }
  return lines;
}

const PUSH_CHANNEL_DETAILS = ["Env: FCM_SERVER_KEY", "Legacy HTTP API"] as const;

type DeliveryRow = { id: string; cells: string[] };

const DeliveryTable = memo(function DeliveryTable({
  loading,
  rows,
}: {
  loading: boolean;
  rows: DeliveryRow[];
}) {
  return (
    <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
      {loading ? (
        <div className="admin-products-table-empty">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="dashboard-pro-empty px-4 py-8">
          <p className="text-sm font-semibold text-foreground">
            No deliveries yet.
          </p>
        </div>
      ) : (
        <table className="panel-3d-table admin-notifications-table w-full text-sm">
          <thead>
            <tr>
              <th>Event</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Recipient</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-mono text-xs">{row.cells[0]}</td>
                <td className="capitalize">{row.cells[1]}</td>
                <td className="capitalize">{row.cells[2]}</td>
                <td className="max-w-[140px] truncate text-xs text-subtle">
                  {row.cells[3]}
                </td>
                <td className="text-foreground-muted">{row.cells[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
});

const ChannelCard = memo(function ChannelCard({
  title,
  icon: Icon,
  configured,
  details,
  settingsHref,
}: {
  title: string;
  icon: typeof MailIcon;
  configured: boolean;
  details: readonly string[];
  settingsHref?: Route;
}) {
  return (
    <ProductFormOrderCard
      icon={<Icon className="h-4 w-4" />}
      title={title}
      subtitle={details[0] ?? "Notification channel"}
      className="admin-product-form-section admin-notifications-channel-card"
      action={
        <span
          className={`dashboard-pro-status${
            configured ? " dashboard-pro-status--green" : " dashboard-pro-status--amber"
          }`}
        >
          {configured ? "Live" : "Sandbox"}
        </span>
      }
    >
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Configuration</dt>
        <dd className="admin-product-form-sidebar-fields space-y-3">
      <ul className="space-y-1 text-xs text-foreground-muted">
        {details.map((line) => (
          <li key={`${title}-${line}`}>{line}</li>
        ))}
      </ul>
      {settingsHref ? (
        <Link
          href={settingsHref}
          prefetch={false}
          className="dashboard-pro-quick-link inline-flex text-xs"
        >
          Open settings
        </Link>
      ) : null}
        </dd>
      </div>
    </ProductFormOrderCard>
  );
});

const EventGroupSection = memo(function EventGroupSection({
  label,
  events,
}: {
  label: string;
  events: NotificationAdminOverview["events"];
}) {
  return (
    <AdminOrderListCard
      icon={<ZapIcon className="h-4 w-4" />}
      title={label}
      subtitle={`${events.length} event type${events.length === 1 ? "" : "s"}`}
      className="admin-notifications-events-catalog h-full min-w-0"
    >
      <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
        <table className="panel-3d-table admin-notifications-table w-full text-sm">
          <thead>
            <tr>
              <th>Event</th>
              <th>Type</th>
              <th>Default channels</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.event} className="text-foreground-muted">
                <td className="font-mono text-xs text-teal-300">{event.event}</td>
                <td className="capitalize">{event.type}</td>
                <td className="text-xs">
                  {event.defaultChannels
                    .map((channel) => CHANNEL_LABELS[channel] ?? channel)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminOrderListCard>
  );
});

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>("channels");
  const [overview, setOverview] = useState<NotificationAdminOverview | null>(
    null,
  );
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [deliveriesTotal, setDeliveriesTotal] = useState(0);
  const [deliveriesPage, setDeliveriesPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [testUserId, setTestUserId] = useState("");
  const [testEvent, setTestEvent] = useState("order.paid");
  const [testContext, setTestContext] = useState(
    '{"orderNumber":"ORD-TEST","orderId":"demo"}',
  );
  const [coreLoading, setCoreLoading] = useState(true);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveriesReady, setDeliveriesReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const refreshBusyRef = useRef(false);
  const deliveriesFetchRef = useRef(false);
  const tabRef = useRef(tab);
  const channelFilterRef = useRef(channelFilter);
  const statusFilterRef = useRef(statusFilter);
  const testUserIdRef = useRef(testUserId);
  const testEventRef = useRef(testEvent);
  const testContextRef = useRef(testContext);
  tabRef.current = tab;
  channelFilterRef.current = channelFilter;
  statusFilterRef.current = statusFilter;
  testUserIdRef.current = testUserId;
  testEventRef.current = testEvent;
  testContextRef.current = testContext;

  const loadCore = useCallback(async (silent = false) => {
    if (silent) {
      if (refreshBusyRef.current) return;
      refreshBusyRef.current = true;
      setRefreshing(true);
    } else {
      setCoreLoading(true);
      setLoadError(null);
    }
    try {
      const data = await getNotificationAdminOverview();
      setOverview(data);
    } catch (err) {
      if (!silent) {
        setOverview(null);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load notifications.",
        );
      }
    } finally {
      if (silent) {
        refreshBusyRef.current = false;
        setRefreshing(false);
      } else {
        setCoreLoading(false);
      }
    }
  }, []);

  const loadDeliveries = useCallback(async (silent = false) => {
    if (deliveriesFetchRef.current) return;
    deliveriesFetchRef.current = true;
    if (!silent) setDeliveriesLoading(true);
    try {
      const result = await adminListNotificationDeliveries({
        channel: channelFilterRef.current || undefined,
        status: statusFilterRef.current || undefined,
        page: deliveriesPage,
        limit: DELIVERIES_PAGE_SIZE,
      });
      setDeliveries(result.items);
      setDeliveriesTotal(result.total);
      setDeliveriesReady(true);
    } catch {
      if (!silent) {
        setDeliveries([]);
        setDeliveriesTotal(0);
      }
    } finally {
      deliveriesFetchRef.current = false;
      if (!silent) setDeliveriesLoading(false);
    }
  }, [deliveriesPage]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (tab === "deliveries") void loadDeliveries();
  }, [tab, deliveriesPage, loadDeliveries]);

  const deliveriesTotalPages = Math.max(
    1,
    Math.ceil(deliveriesTotal / DELIVERIES_PAGE_SIZE),
  );

  useEffect(() => {
    if (deliveriesPage > deliveriesTotalPages) {
      setDeliveriesPage(deliveriesTotalPages);
    }
  }, [deliveriesPage, deliveriesTotalPages]);

  const deliveryRows = useMemo(
    () =>
      deliveries.map((delivery) => ({
        id: delivery._id,
        cells: [
          delivery.event,
          delivery.channel,
          delivery.status,
          delivery.recipient ?? "—",
          formatDate(delivery.createdAt),
        ],
      })),
    [deliveries],
  );

  const emailDetails = useMemo(
    () =>
      overview ? emailChannelDetails(overview.channels.email) : [],
    [overview],
  );

  const eventsByGroup = useMemo(() => {
    if (!overview) return [];
    return EVENT_GROUPS.map((group) => ({
      label: group.label,
      events: overview.events.filter((event) =>
        event.event.startsWith(group.prefix),
      ),
    })).filter((group) => group.events.length > 0);
  }, [overview]);

  const testEventOptions = useMemo(
    () =>
      overview?.events.map((event) => ({
        value: event.event,
        label: event.event,
      })) ?? [],
    [overview],
  );

  const liveChannels = overview ? countLiveChannels(overview) : 0;
  const statsPending = coreLoading && !overview;

  const notificationsOverviewStats = useMemo<NotificationsOverviewStat[]>(
    () => [
      {
        key: "email",
        tone: overview?.channels.email.configured
          ? "success"
          : overview?.channels.email.mockMode
            ? "amber"
            : "brand",
        icon: <MailIcon className="h-4 w-4" />,
        label: "Email",
        value: loadingStat(
          statsPending,
          overview?.channels.email.configured ? "Live" : "Sandbox",
        ),
        meta: statsPending
          ? "…"
          : overview?.channels.email.mockMode
            ? "Mock mode"
            : overview?.channels.email.enabled === false
              ? "Disabled"
              : "SMTP channel",
      },
      {
        key: "sent",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Sent",
        value: loadingStat(
          statsPending,
          (overview?.deliveries.sent ?? 0).toLocaleString(),
        ),
        meta: "Successful deliveries",
      },
      {
        key: "failed",
        tone: (overview?.deliveries.failed ?? 0) > 0 ? "amber" : "muted",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Failed",
        value: loadingStat(
          statsPending,
          (overview?.deliveries.failed ?? 0).toLocaleString(),
        ),
        meta: statsPending
          ? "…"
          : `${overview?.deliveries.skipped ?? 0} skipped`,
      },
      {
        key: "queue",
        tone: (overview?.queue.waiting ?? 0) > 0 ? "brand" : "muted",
        icon: <ZapIcon className="h-4 w-4" />,
        label: "Queue",
        value: loadingStat(
          statsPending,
          (overview?.queue.waiting ?? 0).toLocaleString(),
        ),
        meta: statsPending
          ? "…"
          : `${overview?.queue.active ?? 0} active · ${overview?.queue.failed ?? 0} failed jobs`,
      },
    ],
    [overview, statsPending],
  );

  const onDispatch = useCallback(async () => {
    if (!testUserIdRef.current.trim()) {
      adminToast("User ID is required.", false);
      return;
    }
    setBusy(true);
    hideAdminToast();
    try {
      let context: Record<string, unknown> = {};
      if (testContextRef.current.trim()) {
        context = JSON.parse(testContextRef.current) as Record<string, unknown>;
      }
      await adminDispatchNotification({
        userId: testUserIdRef.current.trim(),
        event: testEventRef.current,
        context,
      });
      adminToast("Notification dispatched.", true);
      void loadCore(true);
      if (tabRef.current === "deliveries") void loadDeliveries(true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Dispatch failed.", false);
    } finally {
      setBusy(false);
    }
  }, [loadCore, loadDeliveries]);

  return (
    <AdminPageLayout
      section="Settings"
      title="Notifications"
      description="Email, push, Telegram, and event-based delivery for customers and staff."
      icon={BellIcon}
      backHref="/admin/settings"
      backLabel="General"
      action={
        statsPending ? null : (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            {liveChannels}/3 channels live
          </span>
        )
      }
    >

      {loadError && !overview ? (
        <ProductFormOrderCard
          title="Could not load notifications"
          subtitle={loadError}
          className="admin-notifications-error space-y-3"
        >
          <button
            type="button"
            onClick={() => void loadCore()}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Retry
          </button>
        </ProductFormOrderCard>
      ) : (
        <>
          <div className="admin-notifications-page space-y-5">
                <AdminOrderListCard
                  icon={<BellIcon className="h-4 w-4" />}
                  title="Notifications overview"
                  subtitle={
                    statsPending
                      ? "Loading notification settings…"
                      : `${overview?.events.length ?? 0} event types · ${overview?.deliveries.pending ?? 0} pending deliveries`
                  }
                  className="admin-notifications-catalog"
                >
                  <NotificationsOverviewStats items={notificationsOverviewStats} />

                  <div className="admin-notifications-summary flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                    <span>
                      <span className="font-semibold text-foreground">Events</span>{" "}
                      {statsPending ? "…" : (overview?.events.length ?? 0).toLocaleString()}
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">Pending</span>{" "}
                      {statsPending
                        ? "…"
                        : (overview?.deliveries.pending ?? 0).toLocaleString()}
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">Push</span>{" "}
                      {statsPending
                        ? "…"
                        : overview?.channels.push.configured
                          ? "FCM live"
                          : "Env required"}
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">Telegram</span>{" "}
                      {statsPending
                        ? "…"
                        : overview?.channels.telegram.configured
                          ? "Bot live"
                          : "Env required"}
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => void loadCore(true)}
                      disabled={coreLoading || refreshing}
                      className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                    >
                      {refreshing || coreLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>

                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Sections</dt>
                    <dd>
                      <div className="admin-notifications-tabs">
                        {TABS.map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setTab(id)}
                            className={`admin-notifications-tab${
                              tab === id ? " admin-notifications-tab--active" : ""
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </dd>
                  </div>
                </AdminOrderListCard>

                <div className="admin-notifications-content min-w-0 space-y-5">
                {tab === "channels" && overview ? (
                  <div className="admin-notifications-channels space-y-5">
                    <ChannelCard
                      title="Email"
                      icon={MailIcon}
                      configured={overview.channels.email.configured}
                      details={emailDetails}
                      settingsHref="/admin/settings/email"
                    />
                    <ChannelCard
                      title="Push (FCM)"
                      icon={BellIcon}
                      configured={overview.channels.push.configured}
                      details={PUSH_CHANNEL_DETAILS}
                    />
                    <ChannelCard
                      title="Telegram"
                      icon={ChatIcon}
                      configured={overview.channels.telegram.configured}
                      details={[
                        "Admin order alerts via bot token + chat ID",
                        "Configure under Settings → Telegram bot",
                      ]}
                      settingsHref="/admin/settings/telegram"
                    />
                  </div>
                ) : null}

                {tab === "events" && overview ? (
                  <div className="admin-notifications-events-grid">
                    {eventsByGroup.map((group) => (
                      <EventGroupSection
                        key={group.label}
                        label={group.label}
                        events={group.events}
                      />
                    ))}
                  </div>
                ) : null}

                {tab === "deliveries" ? (
                  <AdminOrderListCard
                    icon={<PulseIcon className="h-4 w-4" />}
                    title="Delivery log"
                    subtitle="Recent notification deliveries"
                    className="admin-notifications-deliveries-catalog"
                  >
                    <div className="admin-products-filters-list">
                      <div className="admin-notifications-toolbar">
                        <div className="admin-security-blocks-toolbar-item">
                          <label className={`${labelCls} sr-only`}>Channel</label>
                          <AdminSelect
                            value={channelFilter}
                            onChange={setChannelFilter}
                            className="w-full"
                            options={CHANNEL_FILTER_OPTIONS}
                          />
                        </div>
                        <div className="admin-security-blocks-toolbar-item">
                          <label className={`${labelCls} sr-only`}>Status</label>
                          <AdminSelect
                            value={statusFilter}
                            onChange={setStatusFilter}
                            className="w-full"
                            options={STATUS_FILTER_OPTIONS}
                          />
                        </div>
                        <div className="admin-security-blocks-toolbar-item">
                          <button
                            type="button"
                            onClick={() => {
                              if (deliveriesPage !== 1) setDeliveriesPage(1);
                              else void loadDeliveries();
                            }}
                            className="admin-security-blocks-toolbar-btn dashboard-pro-btn-ghost text-xs"
                          >
                            Search
                          </button>
                        </div>
                        <div className="admin-security-blocks-toolbar-item">
                          <button
                            type="button"
                            onClick={() => void loadDeliveries(true)}
                            className="admin-security-blocks-toolbar-btn dashboard-pro-btn-ghost text-xs"
                          >
                            Refresh
                          </button>
                        </div>
                      </div>
                    </div>
                    <DeliveryTable
                      loading={deliveriesLoading && !deliveriesReady}
                      rows={deliveryRows}
                    />
                    {!deliveriesLoading && deliveriesTotal > DELIVERIES_PAGE_SIZE ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 px-4 py-3 text-sm">
                        <p className="text-subtle">
                          Page {deliveriesPage} of {deliveriesTotalPages} ·{" "}
                          {deliveriesTotal.toLocaleString()} deliveries
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deliveriesPage <= 1}
                            onClick={() =>
                              setDeliveriesPage((p) => Math.max(1, p - 1))
                            }
                            className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            disabled={deliveriesPage >= deliveriesTotalPages}
                            onClick={() =>
                              setDeliveriesPage((p) =>
                                Math.min(deliveriesTotalPages, p + 1),
                              )
                            }
                            className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </AdminOrderListCard>
                ) : null}

                {tab === "test" && overview ? (
                  <ProductFormOrderCard
                    icon={<BellIcon className="h-4 w-4" />}
                    title="Test notification"
                    subtitle="Send a test event-based notification to any user"
                    className="admin-product-form-section admin-notifications-test"
                  >
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Recipient</dt>
                      <dd className="admin-product-form-sidebar-fields space-y-4">
                    <div>
                      <label className={labelCls}>User ID</label>
                      <input
                        value={testUserId}
                        onChange={(event) => setTestUserId(event.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Event</label>
                      <AdminSelect
                        value={testEvent}
                        onChange={setTestEvent}
                        className="w-full"
                        options={testEventOptions}
                      />
                    </div>
                      </dd>
                    </div>
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Context</dt>
                      <dd className="admin-product-form-sidebar-fields">
                    <label className={labelCls}>Payload (JSON)</label>
                    <textarea
                      rows={4}
                      value={testContext}
                      onChange={(event) => setTestContext(event.target.value)}
                      className={`${inputCls} font-mono text-xs`}
                    />
                      </dd>
                    </div>
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Dispatch</dt>
                      <dd className="admin-product-form-sidebar-fields">
                    <button
                      type="button"
                      onClick={() => void onDispatch()}
                      disabled={busy}
                      className="btn-primary disabled:opacity-50"
                    >
                      {busy ? "Dispatching…" : "Dispatch notification"}
                    </button>
                      </dd>
                    </div>
                  </ProductFormOrderCard>
                ) : null}

                {!overview && !coreLoading && tab !== "deliveries" ? (
                  <ProductFormOrderCard
                    icon={<BellIcon className="h-4 w-4" />}
                    title="Overview unavailable"
                    subtitle="Notification overview could not be loaded"
                    className="admin-product-form-section"
                  >
                    <p className="text-sm text-subtle">
                      Notification overview unavailable.
                    </p>
                  </ProductFormOrderCard>
                ) : null}
                </div>

                <ProductFormOrderCard
                  className="admin-product-form-section admin-notifications-help"
                  icon={<BellIcon className="h-4 w-4" />}
                  title="Notifications guide"
                  subtitle="Pipeline, channels, and queue."
                >
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Pipeline</dt>
                    <dd className="text-sm text-foreground-muted">
                      Event → template → user preferences → queue → channel
                      delivery. In-app notifications sync immediately.
                    </dd>
                  </div>
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Queue</dt>
                    <dd>
                      <div className="admin-notifications-sidebar-stats grid grid-cols-2 gap-2">
                        <div className="admin-notifications-sidebar-stat">
                          <p className="text-[10px] uppercase text-subtle">Active</p>
                          <p className="mt-1 text-base font-bold text-sky-300">
                            {statsPending ? "…" : (overview?.queue.active ?? 0)}
                          </p>
                        </div>
                        <div className="admin-notifications-sidebar-stat">
                          <p className="text-[10px] uppercase text-subtle">Failed</p>
                          <p className="mt-1 text-base font-bold text-rose-300">
                            {statsPending ? "…" : (overview?.queue.failed ?? 0)}
                          </p>
                        </div>
                      </div>
                    </dd>
                  </div>
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Email</dt>
                    <dd className="text-sm text-foreground-muted">
                      SMTP is configured under{" "}
                      <Link
                        href="/admin/settings/email"
                        className="text-accent hover:underline"
                      >
                        Settings → Email / SMTP
                      </Link>
                      . Mock mode logs messages without sending.
                    </dd>
                  </div>
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Telegram</dt>
                    <dd className="text-sm text-foreground-muted">
                      Order alerts are configured under{" "}
                      <Link
                        href="/admin/settings/telegram"
                        className="text-accent hover:underline"
                      >
                        Settings → Telegram bot
                      </Link>
                      . Customer Telegram delivery still uses user chat IDs.
                    </dd>
                  </div>
                </ProductFormOrderCard>
          </div>
        </>
      )}
    </AdminPageLayout>
  );
}
