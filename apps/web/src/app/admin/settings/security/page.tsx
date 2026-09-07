"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  CheckIcon,
  KeyIcon,
  PulseIcon,
  ShieldIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  createAccessBlock,
  getSecurityAdminOverview,
  getSecuritySettings,
  listAccessBlocks,
  listActivityLogs,
  listAuditLogs,
  removeAccessBlock,
  updateSecuritySettings,
  type AccessBlockItem,
  type AccessBlockType,
  type ActivityLogItem,
  type AuditLogItem,
  type SecurityAdminOverview,
  type SecuritySettings,
} from "@/lib/api";

type Tab =
  | "overview"
  | "rate-limit"
  | "recaptcha"
  | "cloudflare"
  | "helmet"
  | "blocks"
  | "audit"
  | "activity";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "rate-limit", label: "Rate limiting" },
  { id: "recaptcha", label: "reCAPTCHA" },
  { id: "cloudflare", label: "Cloudflare" },
  { id: "helmet", label: "Helmet" },
  { id: "blocks", label: "IP & country blocks" },
  { id: "audit", label: "Audit logs" },
  { id: "activity", label: "Activity" },
];

const BLOCK_COUNTRY_OPTIONS = [
  { code: "BD", label: "Bangladesh" },
  { code: "IN", label: "India" },
  { code: "PK", label: "Pakistan" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CN", label: "China" },
  { code: "RU", label: "Russia" },
  { code: "NG", label: "Nigeria" },
  { code: "BR", label: "Brazil" },
  { code: "DE", label: "Germany" },
];

const BLOCK_COUNTRY_SELECT_OPTIONS = BLOCK_COUNTRY_OPTIONS.map((country) => ({
  value: country.code,
  label: `${country.label} (${country.code})`,
}));

const BLOCK_FILTER_OPTIONS = [
  { value: "", label: "All blocks" },
  { value: "ip", label: "IP only" },
  { value: "country", label: "Country only" },
];

const AUDIT_PAGE_SIZE = 20;
const ACTIVITY_PAGE_SIZE = 20;

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type SecurityStatTone = "brand" | "success" | "amber" | "muted";

type SecurityOverviewStat = {
  key: string;
  tone: SecurityStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function SecurityOverviewStats({ items }: { items: SecurityOverviewStat[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-security-overview"
      aria-label="Security overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-security-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-security-overview-stat-icon admin-security-overview-stat-icon--${item.tone}`}
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

type SecuritySettingsSection =
  | "throttle"
  | "recaptcha"
  | "cloudflare"
  | "activity"
  | "helmet"
  | "audit";

function patchSettingsSection<K extends SecuritySettingsSection>(
  current: SecuritySettings,
  section: K,
  patch: Partial<SecuritySettings[K]>,
): SecuritySettings {
  return {
    ...current,
    [section]: { ...current[section], ...patch },
  };
}

function formatAuditEntity(log: AuditLogItem) {
  if (!log.entityType) return "—";
  return `${log.entityType}${log.entityId ? ` #${log.entityId.slice(-6)}` : ""}`;
}

function formatLogDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

function patchOverviewFromSettings(
  settings: SecuritySettings,
  prev: SecurityAdminOverview | null,
): SecurityAdminOverview | null {
  if (!prev) return prev;
  return {
    ...prev,
    rateLimit: {
      ...prev.rateLimit,
      enabled: settings.throttle.enabled,
      limit: settings.throttle.limit,
      ttlMs: settings.throttle.ttlMs,
    },
    recaptcha: {
      ...prev.recaptcha,
      enabled: settings.recaptcha.enabled,
      configured: settings.recaptcha.configured,
      minScore: settings.recaptcha.minScore,
    },
    cloudflare: {
      ...prev.cloudflare,
      enabled: settings.cloudflare.enabled,
      trustProxyHops: settings.cloudflare.trustProxyHops,
      requireHeaders: settings.cloudflare.requireHeaders,
    },
    helmet: {
      ...prev.helmet,
      enabled: settings.helmet.enabled,
    },
    audit: {
      ...prev.audit,
      enabled: settings.audit.enabled,
    },
    activity: {
      ...prev.activity,
      enabled: settings.activity.enabled,
      sampleRate: settings.activity.sampleRate,
    },
  };
}

function SecurityToggle({
  checked,
  onChange,
  label,
  compact,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 ${
        compact
          ? "rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2"
          : "rounded-xl border border-border/60 bg-white/[0.02] px-4 py-3"
      }`}
    >
      <span className="text-sm text-foreground-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full ${
          checked ? "bg-teal-500" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={inputCls}
      />
    </div>
  );
}

type LogRow = { id: string; cells: string[]; actions?: ReactNode };

const LogTable = memo(function LogTable({
  loading,
  empty,
  headers,
  rows,
  actionsHeader,
}: {
  loading: boolean;
  empty: string;
  headers: string[];
  rows: LogRow[];
  actionsHeader?: string;
}) {
  return (
    <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
      {loading ? (
        <div className="admin-products-table-empty">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="dashboard-pro-empty px-4 py-8">
          <p className="text-sm font-semibold text-foreground">{empty}</p>
        </div>
      ) : (
        <table className="panel-3d-table admin-security-table w-full text-sm">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
              {actionsHeader ? <th>{actionsHeader}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="text-foreground-muted">
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={
                      cellIndex === 1
                        ? "max-w-[200px] truncate font-mono text-xs"
                        : ""
                    }
                  >
                    {cell}
                  </td>
                ))}
                {actionsHeader ? (
                  <td className="whitespace-nowrap">{row.actions ?? "—"}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
});

export default function AdminSecurityPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<SecurityAdminOverview | null>(null);
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [accessBlocks, setAccessBlocks] = useState<AccessBlockItem[]>([]);
  const [blockIp, setBlockIp] = useState("");
  const [blockCountry, setBlockCountry] = useState("BD");
  const [blockReason, setBlockReason] = useState("");
  const [blockFilter, setBlockFilter] = useState<"" | AccessBlockType>("");
  const [auditFilter, setAuditFilter] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [activityUserId, setActivityUserId] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [coreLoading, setCoreLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  
  const refreshBusyRef = useRef(false);
  const auditFetchRef = useRef(false);
  const activityFetchRef = useRef(false);
  const blocksFetchRef = useRef(false);
  const secretKeyRef = useRef(secretKey);
  secretKeyRef.current = secretKey;
  const [auditReady, setAuditReady] = useState(false);
  const [activityReady, setActivityReady] = useState(false);
  const [blocksReady, setBlocksReady] = useState(false);

  const patchSettings = useCallback(
    <K extends SecuritySettingsSection>(
      section: K,
      patch: Partial<SecuritySettings[K]>,
    ) => {
      setSettings((current) =>
        current ? patchSettingsSection(current, section, patch) : current,
      );
    },
    [],
  );

  const loadCore = useCallback(async (silent = false) => {
    if (silent) {
      if (refreshBusyRef.current) return;
      refreshBusyRef.current = true;
      setRefreshing(true);
    } else {
      setCoreLoading(true);
    }
    try {
      const [overviewData, settingsData] = await Promise.all([
        getSecurityAdminOverview(),
        getSecuritySettings(),
      ]);
      setOverview(overviewData);
      setSettings(settingsData);
    } catch {
      if (!silent) {
        setOverview(null);
        setSettings(null);
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

  const loadAudit = useCallback(async (silent = false) => {
    if (auditFetchRef.current) return;
    auditFetchRef.current = true;
    if (!silent) setAuditLoading(true);
    try {
      const result = await listAuditLogs({
        action: auditSearch || undefined,
        page: auditPage,
        limit: AUDIT_PAGE_SIZE,
      });
      setAuditLogs(result.items);
      setAuditTotal(result.total);
      setAuditReady(true);
    } catch {
      if (!silent) {
        setAuditLogs([]);
        setAuditTotal(0);
      }
    } finally {
      auditFetchRef.current = false;
      if (!silent) setAuditLoading(false);
    }
  }, [auditSearch, auditPage]);

  const loadActivity = useCallback(async (silent = false) => {
    if (activityFetchRef.current) return;
    activityFetchRef.current = true;
    if (!silent) setActivityLoading(true);
    try {
      const result = await listActivityLogs({
        userId: activitySearch || undefined,
        page: activityPage,
        limit: ACTIVITY_PAGE_SIZE,
      });
      setActivityLogs(result.items);
      setActivityTotal(result.total);
      setActivityReady(true);
    } catch {
      if (!silent) {
        setActivityLogs([]);
        setActivityTotal(0);
      }
    } finally {
      activityFetchRef.current = false;
      if (!silent) setActivityLoading(false);
    }
  }, [activitySearch, activityPage]);

  const loadBlocks = useCallback(async (silent = false) => {
    if (blocksFetchRef.current) return;
    blocksFetchRef.current = true;
    if (!silent) setBlocksLoading(true);
    try {
      const result = await listAccessBlocks({
        type: blockFilter || undefined,
        limit: 100,
      });
      setAccessBlocks(result.items);
      setBlocksReady(true);
    } catch {
      if (!silent) setAccessBlocks([]);
    } finally {
      blocksFetchRef.current = false;
      if (!silent) setBlocksLoading(false);
    }
  }, [blockFilter]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (tab === "audit") void loadAudit();
  }, [tab, auditSearch, auditPage, loadAudit]);

  useEffect(() => {
    if (tab === "activity") void loadActivity();
  }, [tab, activitySearch, activityPage, loadActivity]);

  useEffect(() => {
    if (tab === "blocks") void loadBlocks();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshBlockCounts = useCallback(async () => {
    try {
      const overviewData = await getSecurityAdminOverview();
      setOverview(overviewData);
    } catch {
      /* keep current overview */
    }
  }, []);

  const addBlock = useCallback(
    async (type: AccessBlockType, value: string, reason?: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        adminToast(type === "ip" ? "Enter an IP address." : "Select a country.", false);
        return;
      }
      setBusy(true);
      hideAdminToast();
      try {
        await createAccessBlock({
          type,
          value: trimmed,
          reason: reason?.trim() || undefined,
        });
        adminToast(
          type === "ip" ? "IP blocked." : "Country blocked.",
          true,
        );
        if (type === "ip") setBlockIp("");
        await loadBlocks(true);
        await refreshBlockCounts();
      } catch (err) {
        adminToast(err instanceof Error ? err.message : "Block failed.", false);
      } finally {
        setBusy(false);
      }
    },
    [loadBlocks, refreshBlockCounts],
  );

  const unblockEntry = useCallback(
    async (id: string) => {
      setBusy(true);
      hideAdminToast();
      try {
        await removeAccessBlock(id);
        adminToast("Block removed.", true);
        await loadBlocks(true);
        await refreshBlockCounts();
      } catch (err) {
        adminToast(err instanceof Error ? err.message : "Unblock failed.", false);
      } finally {
        setBusy(false);
      }
    },
    [loadBlocks, refreshBlockCounts],
  );

  const save = useCallback(
    async (
      patch: Parameters<typeof updateSecuritySettings>[0],
      successMessage = "Settings saved.",
    ) => {
      setBusy(true);
      hideAdminToast();
      try {
        const next = await updateSecuritySettings(patch);
        setSettings(next);
        setOverview((current) => patchOverviewFromSettings(next, current));
        if (patch.recaptcha && secretKeyRef.current.trim()) setSecretKey("");
        adminToast(successMessage, true);
      } catch (err) {
        adminToast(err instanceof Error ? err.message : "Save failed.", false);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const saveAuditEnabled = useCallback(
    (enabled: boolean) => {
      void save({ audit: { enabled } }, "Audit setting updated.");
    },
    [save],
  );

  const auditRows = useMemo(
    () =>
      auditLogs.map((log) => ({
        id: log._id,
        cells: [
          log.action,
          log.actorType,
          formatAuditEntity(log),
          log.status ?? "—",
          log.ip ?? "—",
          formatLogDate(log.createdAt),
        ],
      })),
    [auditLogs],
  );

  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));

  useEffect(() => {
    if (auditPage > auditTotalPages) setAuditPage(auditTotalPages);
  }, [auditPage, auditTotalPages]);

  const activityTotalPages = Math.max(
    1,
    Math.ceil(activityTotal / ACTIVITY_PAGE_SIZE),
  );

  useEffect(() => {
    if (activityPage > activityTotalPages) setActivityPage(activityTotalPages);
  }, [activityPage, activityTotalPages]);

  const activityRows = useMemo(
    () =>
      activityLogs.map((log) => ({
        id: log._id,
        cells: [
          log.method,
          log.path,
          String(log.statusCode ?? "—"),
          log.country ?? "—",
          log.cfRay ?? "—",
          formatLogDate(log.createdAt),
        ],
        actions: (
          <div className="flex flex-wrap gap-1.5">
            {log.ip ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void addBlock("ip", log.ip!, "Blocked from activity log")
                }
                className="dashboard-pro-btn-ghost px-2 py-1 text-[11px] disabled:opacity-50"
              >
                Block IP
              </button>
            ) : null}
            {log.country && log.country.length === 2 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void addBlock(
                    "country",
                    log.country!,
                    "Blocked from activity log",
                  )
                }
                className="dashboard-pro-btn-ghost px-2 py-1 text-[11px] disabled:opacity-50"
              >
                Block country
              </button>
            ) : null}
          </div>
        ),
      })),
    [activityLogs, addBlock, busy],
  );

  const blockRows = useMemo(
    () =>
      accessBlocks.map((block) => ({
        id: block._id,
        cells: [
          block.type === "ip" ? "IP" : "Country",
          block.value,
          block.reason ?? "—",
          block.createdBy ?? "—",
          formatLogDate(block.createdAt),
        ],
        actions: (
          <button
            type="button"
            disabled={busy}
            onClick={() => void unblockEntry(block._id)}
            className="dashboard-pro-btn-ghost px-2 py-1 text-[11px] text-red-300 disabled:opacity-50"
          >
            Unblock
          </button>
        ),
      })),
    [accessBlocks, busy, unblockEntry],
  );

  const statsPending = coreLoading && !overview;
  const redisLive = overview?.optimization.redisThrottle ?? false;
  const samplePct = overview
    ? Math.round(overview.activity.sampleRate * 100)
    : 0;

  const securityOverviewStats = useMemo<SecurityOverviewStat[]>(
    () => [
      {
        key: "rate-limit",
        tone: overview?.rateLimit.enabled ? "success" : "muted",
        icon: <ZapIcon className="h-4 w-4" />,
        label: "Rate limit",
        value: loadingStat(
          statsPending,
          overview?.rateLimit.enabled ? "On" : "Off",
        ),
        meta: statsPending
          ? "…"
          : `${overview?.rateLimit.limit ?? 0} req / ${Math.round((overview?.rateLimit.ttlMs ?? 0) / 1000)}s`,
      },
      {
        key: "recaptcha",
        tone: overview?.recaptcha.configured ? "success" : "amber",
        icon: <KeyIcon className="h-4 w-4" />,
        label: "reCAPTCHA",
        value: loadingStat(
          statsPending,
          overview?.recaptcha.configured ? "Live" : "Sandbox",
        ),
        meta: statsPending
          ? "…"
          : overview?.recaptcha.enabled
            ? "Auth protected"
            : "Disabled",
      },
      {
        key: "audit",
        tone: "brand",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Audit (24h)",
        value: loadingStat(
          statsPending,
          (overview?.audit.last24h ?? 0).toLocaleString(),
        ),
        meta: statsPending
          ? "…"
          : `${overview?.audit.recaptchaFailures24h ?? 0} captcha fails`,
      },
      {
        key: "activity",
        tone: "brand",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Activity (24h)",
        value: loadingStat(
          statsPending,
          (overview?.activity.last24h ?? 0).toLocaleString(),
        ),
        meta: statsPending ? "…" : `${samplePct}% sampled`,
      },
      {
        key: "blocks",
        tone: (overview?.accessBlocks.total ?? 0) > 0 ? "amber" : "success",
        icon: <ShieldIcon className="h-4 w-4" />,
        label: "Access blocks",
        value: loadingStat(
          statsPending,
          String(overview?.accessBlocks.total ?? 0),
        ),
        meta: statsPending
          ? "…"
          : `${overview?.accessBlocks.ip ?? 0} IP · ${overview?.accessBlocks.country ?? 0} country`,
      },
    ],
    [overview, samplePct, statsPending],
  );

  return (
    <AdminPageLayout
      section="Settings"
      title="Security"
      description="Rate limiting, IP/country blocks, Helmet, reCAPTCHA, Cloudflare, audit and activity logging."
      icon={ShieldIcon}
      backHref="/admin/settings"
      backLabel="General"
      action={
        statsPending ? null : redisLive ? (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            Redis throttle
          </span>
        ) : (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            Memory fallback
          </span>
        )
      }
    >

      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<ShieldIcon className="h-4 w-4" />}
              title="Security overview"
              subtitle={
                statsPending
                  ? "Loading security settings…"
                  : `${overview?.audit.last24h ?? 0} audit events · ${overview?.activity.last24h ?? 0} activity events (24h)`
              }
              className="admin-security-catalog"
            >
              <SecurityOverviewStats items={securityOverviewStats} />

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                <span>
                  <span className="font-semibold text-foreground">Storage</span>{" "}
                  {statsPending ? "…" : (overview?.rateLimit.storage ?? "—")}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Cloudflare</span>{" "}
                  {statsPending
                    ? "…"
                    : overview?.cloudflare.enabled
                      ? "IP resolution on"
                      : "Off"}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Helmet</span>{" "}
                  {statsPending
                    ? "…"
                    : overview?.helmet.enabled
                      ? "Headers on"
                      : "Off"}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Blocks</span>{" "}
                  {statsPending
                    ? "…"
                    : `${overview?.accessBlocks.ip ?? 0} IP · ${overview?.accessBlocks.country ?? 0} country`}
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
                  <div className="admin-security-tabs">
                    {TABS.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`admin-security-tab${
                          tab === id ? " admin-security-tab--active" : ""
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </dd>
              </div>
            </AdminOrderListCard>

            <div className="admin-security-content min-w-0 space-y-5">
            {tab === "overview" && (
              <ProductFormOrderCard
                icon={<ShieldIcon className="h-4 w-4" />}
                title="Platform protection"
                subtitle="Protection and logging at a glance"
                className="admin-product-form-section"
              >
                {overview ? (
                  <>
                    <p className="text-sm text-foreground-muted">
                      Optimized for{" "}
                      <strong className="text-foreground">
                        {overview.optimization.estimatedMonthlyVisitors}
                      </strong>{" "}
                      monthly visitors. Rate limits use Redis for horizontal
                      scaling when available.
                    </p>
                    <p className="text-sm text-teal-300/90">
                      {overview.optimization.recommendation}
                    </p>
                    <div className="admin-security-info-grid">
                      <div className="admin-security-info-card">
                        <p className="admin-security-info-label">
                          Global rate limit
                        </p>
                        <p className="admin-security-info-value">
                          {overview.rateLimit.limit} req /{" "}
                          {Math.round(overview.rateLimit.ttlMs / 1000)}s per IP
                        </p>
                        <p className="admin-security-info-hint">
                          Storage: {overview.rateLimit.storage}
                        </p>
                      </div>
                      <div className="admin-security-info-card">
                        <p className="admin-security-info-label">
                          Activity sampling
                        </p>
                        <p className="admin-security-info-value">
                          {Math.round(overview.activity.sampleRate * 100)}% of
                          mutations
                        </p>
                        <p className="admin-security-info-hint">
                          Lower sample rate reduces DB load at scale
                        </p>
                      </div>
                      <div className="admin-security-info-card">
                        <p className="admin-security-info-label">
                          Audit logging
                        </p>
                        <p className="admin-security-info-value">
                          {overview.audit.enabled ? "Enabled" : "Disabled"} ·{" "}
                          {overview.audit.total.toLocaleString()} total
                        </p>
                        <p className="admin-security-info-hint">
                          {overview.audit.last24h.toLocaleString()} events in
                          last 24h
                        </p>
                      </div>
                      <div className="admin-security-info-card">
                        <p className="admin-security-info-label">
                          Helmet protections
                        </p>
                        <p className="admin-security-info-value">
                          {overview.helmet.enabled ? "Active" : "Off"}
                        </p>
                        <p className="admin-security-info-hint">
                          {overview.helmet.protections.slice(0, 3).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-subtle">
                    {coreLoading ? "Loading security overview…" : "Overview unavailable."}
                  </p>
                )}
              </ProductFormOrderCard>
            )}

            {tab === "rate-limit" && settings && (
              <ProductFormOrderCard
                icon={<ZapIcon className="h-4 w-4" />}
                title="Rate limiting"
                subtitle="Global request throttling per IP"
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Throttle settings</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-4">
                <SecurityToggle
                  label="Enable rate limiting"
                  checked={settings.throttle.enabled}
                  onChange={(enabled) => patchSettings("throttle", { enabled })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumField
                    label="Global limit (req/window)"
                    value={settings.throttle.limit}
                    onChange={(limit) => patchSettings("throttle", { limit })}
                    min={10}
                    max={10000}
                  />
                  <NumField
                    label="Window (ms)"
                    value={settings.throttle.ttlMs}
                    onChange={(ttlMs) => patchSettings("throttle", { ttlMs })}
                    min={1000}
                  />
                  <NumField
                    label="Block duration (ms)"
                    value={settings.throttle.blockMs}
                    onChange={(blockMs) => patchSettings("throttle", { blockMs })}
                    min={1000}
                  />
                  <NumField
                    label="Register limit"
                    value={settings.throttle.registerLimit}
                    onChange={(registerLimit) =>
                      patchSettings("throttle", { registerLimit })
                    }
                    min={1}
                    max={100}
                  />
                  <NumField
                    label="Login limit"
                    value={settings.throttle.loginLimit}
                    onChange={(loginLimit) =>
                      patchSettings("throttle", { loginLimit })
                    }
                    min={1}
                    max={100}
                  />
                  <NumField
                    label="OTP limit"
                    value={settings.throttle.otpLimit}
                    onChange={(otpLimit) => patchSettings("throttle", { otpLimit })}
                    min={1}
                    max={100}
                  />
                </div>
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Save</dt>
                  <dd className="admin-product-form-sidebar-fields">
                <button
                  type="button"
                  disabled={busy || coreLoading}
                  onClick={() => void save({ throttle: settings.throttle })}
                  className="btn-primary disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save rate limits"}
                </button>
                  </dd>
                </div>
              </ProductFormOrderCard>
            )}

            {tab === "recaptcha" && settings && (
              <ProductFormOrderCard
                icon={<KeyIcon className="h-4 w-4" />}
                title="reCAPTCHA"
                subtitle="Bot protection on auth endpoints"
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Visibility</dt>
                  <dd className="admin-product-form-sidebar-fields">
                <SecurityToggle
                  label="Enable reCAPTCHA on auth"
                  checked={settings.recaptcha.enabled}
                  onChange={(enabled) => patchSettings("recaptcha", { enabled })}
                />
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Credentials</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-4">
                <div>
                  <label className={labelCls}>Site key (public)</label>
                  <input
                    value={settings.recaptcha.siteKey ?? ""}
                    onChange={(event) =>
                      patchSettings("recaptcha", { siteKey: event.target.value })
                    }
                    className={inputCls}
                    placeholder="6Lc..."
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Secret key
                    {settings.recaptcha.secretFromEnv ? (
                      <span className="ml-2 normal-case text-amber-400">
                        (set via env)
                      </span>
                    ) : null}
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(event) => setSecretKey(event.target.value)}
                    disabled={settings.recaptcha.secretFromEnv}
                    className={`${inputCls} disabled:opacity-50`}
                    placeholder={
                      settings.recaptcha.hasSecret
                        ? "Leave blank to keep existing"
                        : "6Lc..."
                    }
                  />
                </div>
                <NumField
                  label="Min score (v3)"
                  value={settings.recaptcha.minScore}
                  onChange={(minScore) => patchSettings("recaptcha", { minScore })}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <p className="text-xs text-subtle">
                  Login, register, and OTP request send tokens automatically when
                  configured. Env RECAPTCHA_SECRET overrides dashboard secret.
                </p>
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Save</dt>
                  <dd className="admin-product-form-sidebar-fields">
                <button
                  type="button"
                  disabled={busy || coreLoading}
                  onClick={() =>
                    void save({
                      recaptcha: {
                        enabled: settings.recaptcha.enabled,
                        siteKey: settings.recaptcha.siteKey,
                        minScore: settings.recaptcha.minScore,
                        ...(secretKey.trim()
                          ? { secretKey: secretKey.trim() }
                          : {}),
                      },
                    })
                  }
                  className="btn-primary disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save reCAPTCHA"}
                </button>
                  </dd>
                </div>
              </ProductFormOrderCard>
            )}

            {tab === "cloudflare" && settings && (
              <ProductFormOrderCard
                icon={<ShieldIcon className="h-4 w-4" />}
                title="Cloudflare"
                subtitle="Real IP resolution and origin protection"
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Settings</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-4">
                <SecurityToggle
                  label="Cloudflare IP resolution"
                  checked={settings.cloudflare.enabled}
                  onChange={(enabled) => patchSettings("cloudflare", { enabled })}
                />
                <SecurityToggle
                  label="Require CF headers (block direct origin access)"
                  checked={settings.cloudflare.requireHeaders}
                  onChange={(requireHeaders) =>
                    patchSettings("cloudflare", { requireHeaders })
                  }
                />
                <NumField
                  label="Trust proxy hops"
                  value={settings.cloudflare.trustProxyHops}
                  onChange={(trustProxyHops) =>
                    patchSettings("cloudflare", { trustProxyHops })
                  }
                  min={0}
                  max={5}
                />
                <p className="text-xs text-subtle">
                  Uses cf-connecting-ip, cf-ray, and cf-ipcountry. Trust proxy
                  hops applies on API restart; require-headers applies
                  immediately.
                </p>
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Save</dt>
                  <dd className="admin-product-form-sidebar-fields">
                <button
                  type="button"
                  disabled={busy || coreLoading}
                  onClick={() => void save({ cloudflare: settings.cloudflare })}
                  className="btn-primary disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save Cloudflare"}
                </button>
                  </dd>
                </div>
              </ProductFormOrderCard>
            )}

            {tab === "helmet" && settings && (
              <ProductFormOrderCard
                icon={<ShieldIcon className="h-4 w-4" />}
                title="Helmet"
                subtitle="HTTP security headers on the API"
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Settings</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-4">
                <SecurityToggle
                  label="Helmet security headers"
                  checked={settings.helmet.enabled}
                  onChange={(enabled) => patchSettings("helmet", { enabled })}
                />
                <NumField
                  label="HSTS max age (seconds)"
                  value={settings.helmet.hstsMaxAgeSeconds}
                  onChange={(hstsMaxAgeSeconds) =>
                    patchSettings("helmet", { hstsMaxAgeSeconds })
                  }
                  min={0}
                />
                {overview ? (
                  <ul className="list-inside list-disc text-sm text-foreground-muted">
                    {overview.helmet.protections.map((protection) => (
                      <li key={protection}>{protection}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-subtle">
                  Helmet runs on the API at boot. Toggle and HSTS age persist for
                  documentation; restart API to apply HSTS changes.
                </p>
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Save</dt>
                  <dd className="admin-product-form-sidebar-fields">
                <button
                  type="button"
                  disabled={busy || coreLoading}
                  onClick={() => void save({ helmet: settings.helmet })}
                  className="btn-primary disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save Helmet prefs"}
                </button>
                  </dd>
                </div>
              </ProductFormOrderCard>
            )}

            {tab === "blocks" && (
              <>
                <ProductFormOrderCard
                  icon={<ShieldIcon className="h-4 w-4" />}
                  title="Block IP or country"
                  subtitle="Denied clients receive 403 before rate limiting"
                  className="admin-product-form-section"
                >
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Block IP</dt>
                    <dd className="admin-product-form-sidebar-fields space-y-3">
                      <div>
                        <label className={labelCls}>IP address</label>
                        <input
                          value={blockIp}
                          onChange={(event) => setBlockIp(event.target.value)}
                          placeholder="203.0.113.42"
                          className={inputCls}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busy || !blockIp.trim()}
                        onClick={() =>
                          void addBlock("ip", blockIp, blockReason)
                        }
                        className="btn-primary disabled:opacity-50"
                      >
                        Block IP
                      </button>
                    </dd>
                  </div>
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Block country</dt>
                    <dd className="admin-product-form-sidebar-fields space-y-3">
                      <div>
                        <label className={labelCls}>Country (ISO code)</label>
                        <AdminSelect
                          value={blockCountry}
                          onChange={setBlockCountry}
                          options={BLOCK_COUNTRY_SELECT_OPTIONS}
                          className="w-full"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void addBlock("country", blockCountry, blockReason)
                        }
                        className="btn-primary disabled:opacity-50"
                      >
                        Block country
                      </button>
                    </dd>
                  </div>
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Reason (optional)</dt>
                    <dd className="admin-product-form-sidebar-fields">
                      <input
                        value={blockReason}
                        onChange={(event) => setBlockReason(event.target.value)}
                        placeholder="Abuse, fraud, manual review…"
                        className={inputCls}
                      />
                    </dd>
                  </div>
                </ProductFormOrderCard>

                <AdminOrderListCard
                  icon={<ShieldIcon className="h-4 w-4" />}
                  title="Active blocks"
                  subtitle="Blocked IPs and countries"
                  className="admin-security-blocks-catalog"
                >
                  <div className="admin-products-filters-list">
                    <div className="admin-security-blocks-toolbar">
                      <div className="admin-security-blocks-toolbar-item">
                        <label htmlFor="security-blocks-filter" className="sr-only">
                          Filter
                        </label>
                        <AdminSelect
                          id="security-blocks-filter"
                          value={blockFilter}
                          onChange={(value) =>
                            setBlockFilter(value as "" | AccessBlockType)
                          }
                          options={BLOCK_FILTER_OPTIONS}
                          className="w-full"
                        />
                      </div>
                      <div className="admin-security-blocks-toolbar-item">
                        <button
                          type="button"
                          onClick={() => void loadBlocks()}
                          className="admin-security-blocks-toolbar-btn dashboard-pro-btn-ghost text-xs"
                        >
                          Apply
                        </button>
                      </div>
                      <div className="admin-security-blocks-toolbar-item">
                        <button
                          type="button"
                          onClick={() => void loadBlocks(true)}
                          className="admin-security-blocks-toolbar-btn dashboard-pro-btn-ghost text-xs"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>
                  <LogTable
                    loading={blocksLoading && !blocksReady}
                    empty="No active blocks."
                    headers={["Type", "Value", "Reason", "Added by", "Date"]}
                    actionsHeader="Actions"
                    rows={blockRows}
                  />
                </AdminOrderListCard>
              </>
            )}

            {tab === "audit" && (
              <AdminOrderListCard
                icon={<CheckIcon className="h-4 w-4" />}
                title="Audit logs"
                subtitle="Security and auth events"
                className="admin-security-audit-catalog"
              >
                <div className="admin-products-filters-list">
                  <div className="admin-products-filters-row">
                    <div className="admin-products-filter-field min-w-0 flex-1">
                      <label className={labelCls}>Filter by action</label>
                      <input
                        value={auditFilter}
                        onChange={(event) => setAuditFilter(event.target.value)}
                        placeholder="e.g. auth.login"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuditSearch(auditFilter.trim());
                          if (auditPage !== 1) setAuditPage(1);
                        }}
                        className="dashboard-pro-btn-ghost text-xs"
                      >
                        Search
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadAudit(true)}
                        className="dashboard-pro-btn-ghost text-xs"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                  {settings ? (
                    <SecurityToggle
                      compact
                      label="Audit logging"
                      checked={settings.audit.enabled}
                      onChange={saveAuditEnabled}
                    />
                  ) : null}
                </div>
                <LogTable
                  loading={auditLoading && !auditReady}
                  empty="No audit logs."
                  headers={["Action", "Actor", "Entity", "Status", "IP", "Date"]}
                  rows={auditRows}
                />
                {!auditLoading && auditTotal > AUDIT_PAGE_SIZE ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 px-4 py-3 text-sm">
                    <p className="text-subtle">
                      Page {auditPage} of {auditTotalPages} ·{" "}
                      {auditTotal.toLocaleString()} events
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={auditPage <= 1}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={auditPage >= auditTotalPages}
                        onClick={() =>
                          setAuditPage((p) => Math.min(auditTotalPages, p + 1))
                        }
                        className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </AdminOrderListCard>
            )}

            {tab === "activity" && settings && (
              <>
                <ProductFormOrderCard
                  icon={<PulseIcon className="h-4 w-4" />}
                  title="Activity tracking"
                  subtitle="Sample rate and retention for request logs"
                  className="admin-product-form-section"
                >
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Tracking settings</dt>
                    <dd className="admin-product-form-sidebar-fields space-y-4">
                  <SecurityToggle
                    label="Activity tracking"
                    checked={settings.activity.enabled}
                    onChange={(enabled) => patchSettings("activity", { enabled })}
                  />
                  <NumField
                    label="Sample rate (0.01–1)"
                    value={settings.activity.sampleRate}
                    onChange={(sampleRate) =>
                      patchSettings("activity", { sampleRate })
                    }
                    min={0.01}
                    max={1}
                    step={0.05}
                  />
                  <NumField
                    label="Retention (days)"
                    value={settings.activity.retentionDays}
                    onChange={(retentionDays) =>
                      patchSettings("activity", { retentionDays })
                    }
                    min={7}
                    max={365}
                  />
                    </dd>
                  </div>
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Save</dt>
                    <dd className="admin-product-form-sidebar-fields">
                  <button
                    type="button"
                    disabled={busy || coreLoading}
                    onClick={() => void save({ activity: settings.activity })}
                    className="btn-primary disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Save activity settings"}
                  </button>
                    </dd>
                  </div>
                </ProductFormOrderCard>
                <AdminOrderListCard
                  icon={<PulseIcon className="h-4 w-4" />}
                  title="Activity logs"
                  subtitle="Recent request activity"
                  className="admin-security-activity-catalog"
                >
                  <div className="admin-products-filters-list">
                    <div className="admin-products-filters-row">
                      <div className="admin-products-filter-field min-w-0 flex-1">
                        <label className={labelCls}>Filter by user ID</label>
                        <input
                          value={activityUserId}
                          onChange={(event) => setActivityUserId(event.target.value)}
                          placeholder="User ID…"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActivitySearch(activityUserId.trim());
                            if (activityPage !== 1) setActivityPage(1);
                          }}
                          className="dashboard-pro-btn-ghost text-xs"
                        >
                          Search
                        </button>
                        <button
                          type="button"
                          onClick={() => void loadActivity(true)}
                          className="dashboard-pro-btn-ghost text-xs"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>
                  <LogTable
                    loading={activityLoading && !activityReady}
                    empty="No activity logs."
                    headers={[
                      "Method",
                      "Path",
                      "Status",
                      "Country",
                      "CF Ray",
                      "Date",
                    ]}
                    actionsHeader="Block"
                    rows={activityRows}
                  />
                  {!activityLoading && activityTotal > ACTIVITY_PAGE_SIZE ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-strong/40 px-4 py-3 text-sm">
                      <p className="text-subtle">
                        Page {activityPage} of {activityTotalPages} ·{" "}
                        {activityTotal.toLocaleString()} events
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={activityPage <= 1}
                          onClick={() =>
                            setActivityPage((p) => Math.max(1, p - 1))
                          }
                          className="panel-3d-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={activityPage >= activityTotalPages}
                          onClick={() =>
                            setActivityPage((p) =>
                              Math.min(activityTotalPages, p + 1),
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
              </>
            )}
            </div>
          </>
        }
        sidebar={
          <ProductFormOrderCard
            className="admin-product-form-section admin-security-sidebar"
            icon={<ShieldIcon className="h-4 w-4" />}
            title="Setup guide"
            subtitle="Pipeline, traffic, and permissions."
          >
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Security pipeline</dt>
              <dd className="text-sm text-foreground-muted">
                Cloudflare → Real IP middleware → Rate limit → Helmet headers →
                reCAPTCHA (auth) → Activity + Audit logs.
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>High traffic</dt>
              <dd className="text-sm text-foreground-muted">
                For 800K+ visitors: keep Redis running, use Cloudflare caching
                for static assets, and lower activity sample rate if DB writes
                spike.
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>reCAPTCHA</dt>
              <dd className="text-sm text-foreground-muted">
                Set site key in dashboard or env. Secret can live in RECAPTCHA_SECRET
                env var for production.
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>IP & country blocks</dt>
              <dd className="text-sm text-foreground-muted">
                Block abusive IPs or entire countries from the API and storefront.
                Admin users bypass blocks so you can always manage rules. Use
                Activity logs for one-click block actions.
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Roles</dt>
              <dd className="text-sm text-foreground-muted">
                Grant manage_security_settings permission under{" "}
                <Link
                  href="/admin/settings/roles"
                  className="text-accent hover:underline"
                >
                  Settings → Roles
                </Link>{" "}
                for staff who can edit these controls.
              </dd>
            </div>
          </ProductFormOrderCard>
        }
      />
    </AdminPageLayout>
  );
}
