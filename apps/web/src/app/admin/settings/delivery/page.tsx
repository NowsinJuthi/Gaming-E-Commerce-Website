"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminLicenseFeatureNotice } from "@/components/admin/AdminLicenseFeatureNotice";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  CustomOrderFieldsEditor,
  parseCustomOrderFields,
  serializeCustomOrderFields,
  type CustomOrderField,
} from "@/components/admin/custom-order-fields-editor";
import {
  SavedDeliveryNotesEditor,
  parseSavedDeliveryNotes,
  serializeSavedDeliveryNotes,
  type SavedDeliveryNote,
} from "@/components/admin/saved-delivery-notes-editor";
import {
  CheckIcon,
  KeyIcon,
  PulseIcon,
  TruckIcon,
  WalletIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  getDeliveryOverview,
  getDeliverySettings,
  getSystemStatus,
  retryDelivery,
  updateDeliverySettings,
  type DeliveryOverview,
  type SystemStatus,
} from "@/lib/api";

function attemptStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "success" || normalized === "completed") {
    return "dashboard-pro-status dashboard-pro-status--green";
  }
  if (normalized === "failed" || normalized === "error") {
    return "dashboard-pro-status dashboard-pro-status--amber";
  }
  return "dashboard-pro-status";
}

function patchFieldStats(
  current: DeliveryOverview,
  fields: ReturnType<typeof serializeCustomOrderFields>,
): DeliveryOverview {
  return {
    ...current,
    customOrderFields: {
      total: fields.length,
      enabled: fields.filter((field) => field.enabled).length,
    },
  };
}

function removeFailedJob(
  current: DeliveryOverview,
  orderId: string,
): DeliveryOverview {
  return {
    ...current,
    failedJobs: (current.failedJobs ?? []).filter(
      (job) => job.orderId !== orderId,
    ),
  };
}

function formatSystemMeta(sys: SystemStatus | null, loading: boolean) {
  if (loading) return "Loading platform status…";
  if (!sys) return "Status unavailable";
  return `DB ${sys.database.ok ? "ok" : "down"} · Redis ${sys.redis.ok ? "ok" : "down"}`;
}

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type DeliveryStatTone = "brand" | "success" | "amber" | "muted";

type DeliveryOverviewStat = {
  key: string;
  tone: DeliveryStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  meta: string;
};

function SettingsOverviewStats({
  items,
  className = "",
}: {
  items: DeliveryOverviewStat[];
  className?: string;
}) {
  return (
    <section
      className={`customer-dashboard-overview-section ${className}`.trim()}
      aria-label="Overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-delivery-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-delivery-overview-stat-icon admin-delivery-overview-stat-icon--${item.tone}`}
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
  );
}

export default function AdminDeliveryPage() {
  const [data, setData] = useState<DeliveryOverview | null>(null);
  const [sys, setSys] = useState<SystemStatus | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [sysLoading, setSysLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fieldsBusy, setFieldsBusy] = useState(false);
  const [notesBusy, setNotesBusy] = useState(false);
  const [customFields, setCustomFields] = useState<CustomOrderField[]>([]);
  const [savedNotes, setSavedNotes] = useState<SavedDeliveryNote[]>([]);
  
  const pollBusyRef = useRef(false);

  const loadOverview = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (silent) {
      if (pollBusyRef.current) return;
      pollBusyRef.current = true;
      setRefreshing(true);
    } else {
      setOverviewError(null);
    }
    try {
      const overview = await getDeliveryOverview();
      setData(overview);
    } catch (err) {
      if (!silent) {
        setData(null);
        setOverviewError(
          err instanceof Error ? err.message : "Failed to load delivery overview",
        );
      }
    } finally {
      if (silent) {
        pollBusyRef.current = false;
        setRefreshing(false);
      }
    }
  }, []);

  const loadSystem = useCallback(async () => {
    try {
      const status = await getSystemStatus();
      setSys(status);
    } catch {
      setSys(null);
    }
  }, []);

  const loadSettings = useCallback(() => {
    return getDeliverySettings()
      .then((settings) => {
        setCustomFields(parseCustomOrderFields(settings.customOrderFields));
        setSavedNotes(parseSavedDeliveryNotes(settings.savedDeliveryNotes ?? []));
      })
      .catch(() => {
        setCustomFields([]);
        setSavedNotes([]);
      });
  }, []);

  const refreshOverview = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadOverview();
    } finally {
      setRefreshing(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    let cancelled = false;
    setOverviewLoading(true);
    setSysLoading(true);
    setSettingsLoading(true);

    void loadOverview().finally(() => {
      if (!cancelled) setOverviewLoading(false);
    });
    void loadSystem().finally(() => {
      if (!cancelled) setSysLoading(false);
    });
    loadSettings().finally(() => {
      if (!cancelled) setSettingsLoading(false);
    });

    const timer = window.setInterval(() => {
      void loadOverview({ silent: true });
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadOverview, loadSystem, loadSettings]);

  async function onSaveFields(fieldsToSave: CustomOrderField[] = customFields) {
    setFieldsBusy(true);
    hideAdminToast();
    try {
      const payload = serializeCustomOrderFields(fieldsToSave);
      if (payload.length === 0) {
        adminToast("Add at least one template name under Manual Delivery, then save again.", false);
        return;
      }
      const updated = await updateDeliverySettings({
        customOrderFields: payload,
      });
      const parsed = parseCustomOrderFields(updated.customOrderFields);
      setCustomFields(parsed);
      setData((current) =>
        current ? patchFieldStats(current, payload) : current,
      );
      adminToast("Manual Delivery templates saved. They will appear in Sales → Orders → Delivery field.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not save fields", false);
      void loadOverview({ silent: true });
    } finally {
      setFieldsBusy(false);
    }
  }

  async function onSaveNotes() {
    setNotesBusy(true);
    hideAdminToast();
    try {
      const payload = serializeSavedDeliveryNotes(savedNotes);
      if (payload.length === 0) {
        adminToast("Add at least one note title and message under Saved customer notes, then save again.", false);
        return;
      }
      const updated = await updateDeliverySettings({
        savedDeliveryNotes: payload,
      });
      setSavedNotes(parseSavedDeliveryNotes(updated.savedDeliveryNotes));
      adminToast("Saved customer notes stored. They will appear in Sales → Orders → Customer note.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not save notes", false);
      void loadOverview({ silent: true });
    } finally {
      setNotesBusy(false);
    }
  }

  async function onRetry(orderId: string) {
    setBusy(orderId);
    hideAdminToast();
    try {
      const result = await retryDelivery(orderId);
      adminToast(result.queued
          ? `Delivery re-queued for order ${orderId.slice(-6)}.`
          : `Delivery retried synchronously for order ${orderId.slice(-6)}.`, true);
      setData((current) =>
        current ? removeFailedJob(current, orderId) : current,
      );
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Retry failed", false);
      void loadOverview({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  const overviewPending = overviewLoading && !data;
  const q = data?.queue ?? {
    ok: false,
    name: "—",
    error: "Queue unavailable",
  };
  const rs = data?.retryStrategy;
  const redis = data?.redis ?? { ok: false, error: "Unavailable" };
  const failedJobs = data?.failedJobs ?? [];
  const supplierAttempts = data?.supplierAttempts ?? [];
  const queueHealthy = q.ok === true;
  const failedJobCount = failedJobs.length;
  const attemptCount = supplierAttempts.length;
  const enabledTemplates = data?.customOrderFields?.enabled ?? 0;
  const totalTemplates = data?.customOrderFields?.total ?? 0;
  const healthy = sys?.status === "healthy";
  const pipelineSteps = data?.pipeline ?? [];
  const queueMeta = overviewPending
    ? "Loading queue…"
    : q.ok
      ? `${q.waiting ?? 0} waiting · ${q.failed ?? 0} failed`
      : q.error ?? "Queue unavailable";

  const overviewStats = useMemo<DeliveryOverviewStat[]>(() => {
    const redisOnline = !overviewPending && redis.ok;
    const systemStatus = overviewPending
      ? "…"
      : (sys?.status ?? "—").replace(/^\w/, (char) => char.toUpperCase());

    return [
      {
        key: "queue",
        tone: "brand",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Delivery queue",
        value: loadingStat(overviewPending, q.ok ? String(q.active ?? 0) : "—"),
        meta: queueMeta,
      },
      {
        key: "redis",
        tone: overviewPending ? "muted" : redisOnline ? "success" : "amber",
        icon: <WalletIcon className="h-4 w-4" />,
        label: "Redis",
        value: loadingStat(overviewPending, redisOnline ? "Connected" : "Down"),
        valueClassName: overviewPending
          ? undefined
          : redisOnline
            ? "text-emerald-300"
            : "text-rose-400",
        meta: overviewPending
          ? "…"
          : (redis.state ?? redis.error ?? "Cache layer"),
      },
      {
        key: "retry",
        tone: "amber",
        icon: <ZapIcon className="h-4 w-4" />,
        label: "Retry attempts",
        value: loadingStat(overviewPending, rs ? String(rs.attempts) : "—"),
        meta: overviewPending
          ? "…"
          : rs
            ? `${rs.backoff.type} backoff · ${rs.backoff.delay}ms base`
            : "BullMQ strategy",
      },
      {
        key: "system",
        tone: overviewPending ? "muted" : healthy ? "success" : "amber",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "System",
        value: systemStatus,
        valueClassName:
          !overviewPending && !healthy ? "text-amber-300" : undefined,
        meta: formatSystemMeta(sys, sysLoading),
      },
      {
        key: "order-fields",
        tone: "brand",
        icon: <KeyIcon className="h-4 w-4" />,
        label: "Order fields",
        value: loadingStat(overviewPending, enabledTemplates.toLocaleString()),
        meta: overviewPending
          ? "…"
          : `${totalTemplates} templates · preset messages`,
      },
    ];
  }, [
    enabledTemplates,
    healthy,
    overviewPending,
    q.active,
    q.ok,
    queueMeta,
    redis.error,
    redis.ok,
    redis.state,
    rs,
    sys,
    sysLoading,
    totalTemplates,
  ]);

  const retryStrategyStats = useMemo<DeliveryOverviewStat[]>(() => {
    if (!rs) return [];

    return [
      {
        key: "attempts",
        tone: "amber",
        icon: <ZapIcon className="h-4 w-4" />,
        label: "Max attempts",
        value: rs.attempts.toLocaleString(),
        meta: "Per failed job",
      },
      {
        key: "backoff",
        tone: "brand",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Backoff",
        value: rs.backoff.type,
        meta: `${rs.backoff.delay.toLocaleString()}ms base delay`,
      },
      {
        key: "completed",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Keep completed",
        value: rs.removeOnComplete.toLocaleString(),
        meta: "Jobs retained after success",
      },
      {
        key: "failed",
        tone: "amber",
        icon: <KeyIcon className="h-4 w-4" />,
        label: "Keep failed",
        value: rs.removeOnFail.toLocaleString(),
        meta: "Jobs retained after failure",
      },
    ];
  }, [rs]);

  return (
    <AdminPageLayout
      section="Settings"
      title="Manual Delivery"
      description="Payment → Queue → Supplier → Delivery → Notification"
      icon={PulseIcon}
      backHref="/admin/settings"
      backLabel="General"
      action={
        overviewPending ? null : (
          <span
            className={`dashboard-pro-status whitespace-nowrap ${
              queueHealthy
                ? "dashboard-pro-status--green"
                : "dashboard-pro-status--amber"
            }`}
          >
            {queueHealthy ? "Queue online" : "Queue issue"}
          </span>
        )
      }
    >

      <AdminLicenseFeatureNotice path="/admin/settings/delivery" />

      {overviewError ? (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <span>{overviewError}</span>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Try again
          </button>
        </div>
      ) : null}

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<PulseIcon className="h-4 w-4" />}
              title="Delivery overview"
              subtitle={
                overviewPending
                  ? "Loading queue status…"
                  : queueHealthy
                    ? "Queue online · pipeline active"
                    : "Queue issue · check Redis and workers"
              }
              className="admin-delivery-catalog"
            >
              <SettingsOverviewStats
                items={overviewStats}
                className="admin-delivery-overview"
              />

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                <span>
                  <span className="font-semibold text-foreground">Queue</span>{" "}
                  {overviewPending ? "…" : (q.name ?? "—")}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Failed jobs</span>{" "}
                  {overviewPending ? "…" : failedJobCount.toLocaleString()}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Attempts</span>{" "}
                  {overviewPending
                    ? "…"
                    : `${attemptCount.toLocaleString()} recent supplier logs`}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Health</span>{" "}
                  {overviewPending
                    ? "…"
                    : healthy
                      ? "All systems healthy"
                      : "Check platform status"}
                </span>
              </div>

              <div className="flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => void refreshOverview()}
                  disabled={overviewLoading || refreshing}
                  className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                >
                  {refreshing || overviewLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              <dl>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Pipeline flow</dt>
                  <dd>
                    {overviewPending ? (
                      <p className="text-sm text-subtle">Loading pipeline…</p>
                    ) : pipelineSteps.length === 0 ? (
                      <p className="text-sm text-subtle">Pipeline steps unavailable.</p>
                    ) : (
                      <div className="admin-delivery-flow">
                        {pipelineSteps.map((step, i) => (
                          <div key={step.key} className="admin-delivery-flow-item">
                            <article className="admin-delivery-step">
                              <span className="admin-delivery-step-index">{i + 1}</span>
                              <p className="admin-delivery-step-label">{step.label}</p>
                              <p className="admin-delivery-step-desc">{step.description}</p>
                            </article>
                            {i < pipelineSteps.length - 1 ? (
                              <span className="admin-delivery-flow-arrow" aria-hidden>
                                →
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </dd>
                </div>
              </dl>
            </AdminOrderListCard>

            <ProductFormOrderCard
              className="admin-product-form-section"
              icon={<KeyIcon className="h-4 w-4" />}
              title="Custom order fields"
              subtitle="Manual delivery templates for checkout and order fulfillment."
            >
              <dl>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Templates</dt>
                  <dd className="admin-product-form-sidebar-fields">
                    {settingsLoading ? (
                      <p className="text-sm text-subtle">
                        Loading manual delivery templates…
                      </p>
                    ) : (
                      <CustomOrderFieldsEditor
                        fields={customFields}
                        onChange={setCustomFields}
                        saving={fieldsBusy}
                        onSave={(fieldsToSave) => onSaveFields(fieldsToSave)}
                      />
                    )}
                  </dd>
                </div>
              </dl>
            </ProductFormOrderCard>

            <ProductFormOrderCard
              className="admin-product-form-section"
              icon={<TruckIcon className="h-4 w-4" />}
              title="Saved customer notes"
              subtitle="Preset messages for delivery staff during manual fulfillments."
            >
              <dl>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Presets</dt>
                  <dd className="admin-product-form-sidebar-fields">
                    {settingsLoading ? (
                      <p className="text-sm text-subtle">Loading saved customer notes…</p>
                    ) : (
                      <SavedDeliveryNotesEditor
                        notes={savedNotes}
                        onChange={setSavedNotes}
                        saving={notesBusy}
                        onSave={onSaveNotes}
                      />
                    )}
                  </dd>
                </div>
              </dl>
            </ProductFormOrderCard>

            {rs ? (
              <ProductFormOrderCard
                className="admin-product-form-section"
                icon={<ZapIcon className="h-4 w-4" />}
                title="Retry strategy"
                subtitle="BullMQ worker retry policy for failed delivery jobs."
              >
                <SettingsOverviewStats
                  items={retryStrategyStats}
                  className="admin-delivery-retry-overview"
                />
              </ProductFormOrderCard>
            ) : null}

            <AdminOrderListCard
              icon={<PulseIcon className="h-4 w-4" />}
              title="Failed delivery jobs"
              subtitle={
                overviewPending
                  ? "Loading failed jobs…"
                  : refreshing
                    ? "Refreshing queue…"
                    : `${failedJobCount.toLocaleString()} job${failedJobCount === 1 ? "" : "s"} in failed state`
              }
              className="admin-delivery-jobs-catalog"
            >
              {overviewPending ? (
                <div className="admin-products-table-empty">Loading failed jobs…</div>
              ) : !failedJobs.length ? (
                <div className="dashboard-pro-empty px-4 py-8">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <PulseIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    No failed jobs
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                    The delivery queue has no jobs waiting for retry.
                  </p>
                </div>
              ) : (
                <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                  <table className="panel-3d-table admin-delivery-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Attempts</th>
                        <th>Error</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedJobs.map((job) => (
                        <tr key={job.id} className="text-foreground-muted">
                          <td className="font-mono text-xs text-foreground">
                            …{job.orderId.slice(-8)}
                          </td>
                          <td>{job.attemptsMade}</td>
                          <td className="max-w-xs truncate text-xs text-rose-300">
                            {job.failedReason ?? "—"}
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              disabled={busy === job.orderId}
                              onClick={() => void onRetry(job.orderId)}
                              className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                            >
                              {busy === job.orderId ? "…" : "Retry"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminOrderListCard>

            <AdminOrderListCard
              icon={<TruckIcon className="h-4 w-4" />}
              title="Recent supplier attempts"
              subtitle={
                overviewPending
                  ? "Loading attempts…"
                  : `${attemptCount.toLocaleString()} recent upstream procurement logs`
              }
              className="admin-delivery-attempts-catalog"
            >
              {overviewPending ? (
                <div className="admin-products-table-empty">Loading attempts…</div>
              ) : !supplierAttempts.length ? (
                <div className="dashboard-pro-empty px-4 py-8">
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <TruckIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    No recent attempts
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                    Supplier procurement logs will appear here after delivery runs.
                  </p>
                </div>
              ) : (
                <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                  <table className="panel-3d-table admin-delivery-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Status</th>
                        <th>Attempt</th>
                        <th>Error</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierAttempts.map((attempt) => (
                        <tr key={attempt.id} className="text-foreground-muted">
                          <td className="font-mono text-xs">{attempt.supplierCode}</td>
                          <td>
                            <span
                              className={`whitespace-nowrap capitalize ${attemptStatusClass(attempt.status)}`}
                            >
                              {attempt.status}
                            </span>
                          </td>
                          <td>#{attempt.attempt}</td>
                          <td className="max-w-xs truncate text-xs text-rose-300">
                            {attempt.error ?? "—"}
                          </td>
                          <td className="text-right">
                            {attempt.orderId ? (
                              <button
                                type="button"
                                disabled={busy === attempt.orderId}
                                onClick={() => void onRetry(attempt.orderId!)}
                                className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                              >
                                {busy === attempt.orderId ? "…" : "Retry"}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminOrderListCard>

            <ProductFormOrderCard
              className="admin-product-form-section admin-delivery-sidebar"
              icon={<TruckIcon className="h-4 w-4" />}
              title="Setup guide"
              subtitle="How orders move through manual delivery."
            >
              <dl>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Pipeline</dt>
                  <dd className="text-sm text-foreground-muted">
                    Orders move through payment confirmation, queue dispatch, supplier
                    procurement, delivery, and customer notification.
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Manual delivery</dt>
                  <dd className="text-sm text-foreground-muted">
                    Templates saved here appear under Sales → Orders → Delivery field
                    for staff completing manual fulfillments.
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Customer notes</dt>
                  <dd className="text-sm text-foreground-muted">
                    Preset note messages appear in Sales → Orders → Customer note for
                    quick replies during delivery.
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Failed jobs</dt>
                  <dd className="text-sm text-foreground-muted">
                    Use Retry to re-queue a failed delivery job. The queue auto-refreshes
                    every 15 seconds.
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Suppliers</dt>
                  <dd className="text-sm text-foreground-muted">
                    Configure upstream failover and product mappings in Settings →
                    Suppliers before high-volume delivery windows.
                  </dd>
                </div>
              </dl>
            </ProductFormOrderCard>
          </>
        }
      />
    </AdminPageLayout>
  );
}
