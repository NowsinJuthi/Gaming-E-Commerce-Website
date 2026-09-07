"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { EmailBrandingPanel } from "@/components/admin/email/EmailBrandingPanel";
import { EmailSettingsNav } from "@/components/admin/email/EmailSettingsNav";
import { AdminOrderListCard } from "@/components/admin/admin-order-page-shell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  CustomDesignBadge,
  RecipientBadge,
  StatusPill,
} from "@/components/admin/email/EmailTemplateUi";
import {
  ArrowRightIcon,
  CheckIcon,
  LayersIcon,
  MailIcon,
  PulseIcon,
  SearchIcon,
} from "@/components/admin/icons";
import {
  getEmailAdminSettings,
  getEmailTemplates,
  updateEmailTemplate,
  type EmailTemplateItem,
  type EmailTemplateStats,
} from "@/lib/api";
import { getOrderTemplateSendMeta } from "@/lib/email-template-send-meta";

type CategoryFilter = EmailTemplateItem["category"] | "all";
type StatusFilter = "all" | "enabled" | "disabled";

const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  ...CATEGORY_ORDER.map((cat) => ({
    value: cat,
    label: CATEGORY_META[cat].title,
  })),
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];

type TemplateStatTone = "brand" | "success" | "amber" | "muted";

type TemplateLibraryStat = {
  key: string;
  tone: TemplateStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function TemplateLibraryOverviewStats({
  items,
}: {
  items: TemplateLibraryStat[];
}) {
  return (
    <section
      className="customer-dashboard-overview-section admin-email-overview"
      aria-label="Template library overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-email-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-email-overview-stat-icon admin-email-overview-stat-icon--${item.tone}`}
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

type Props = {
  showBranding?: boolean;
  showNav?: boolean;
};

export function EmailTemplateLibrary({
  showBranding = true,
  showNav = false,
}: Props) {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [stats, setStats] = useState<EmailTemplateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [emailGates, setEmailGates] = useState<{
    orderCustomerEmailsEnabled: boolean;
    adminOrderAlertEmailsEnabled: boolean;
  } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [res, settings] = await Promise.all([
        getEmailTemplates(),
        getEmailAdminSettings().catch(() => null),
      ]);
      setTemplates(res.templates);
      setStats(res.stats);
      if (settings) {
        setEmailGates({
          orderCustomerEmailsEnabled:
            settings.settings.orderCustomerEmailsEnabled,
          adminOrderAlertEmailsEnabled:
            settings.settings.adminOrderAlertEmailsEnabled,
        });
      }
    } catch {
      adminToast("Failed to load email templates.", false);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) {
        return false;
      }
      if (statusFilter === "enabled" && !t.enabled) return false;
      if (statusFilter === "disabled" && t.enabled) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [templates, query, categoryFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<EmailTemplateItem["category"], EmailTemplateItem[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const t of filtered) {
      map.get(t.category)?.push(t);
    }
    return map;
  }, [filtered]);

  const visibleCount = filtered.length;
  const filtersActive =
    query.trim().length > 0 ||
    categoryFilter !== "all" ||
    statusFilter !== "all";

  const templateLibraryStats = useMemo<TemplateLibraryStat[]>(
    () =>
      stats
        ? [
            {
              key: "total",
              tone: "brand",
              icon: <MailIcon className="h-4 w-4" />,
              label: "Total",
              value: stats.total.toLocaleString(),
              meta: "All templates",
            },
            {
              key: "enabled",
              tone: "success",
              icon: <CheckIcon className="h-4 w-4" />,
              label: "Enabled",
              value: stats.enabled.toLocaleString(),
              meta: "Enabled in library",
            },
            {
              key: "disabled",
              tone: stats.disabled > 0 ? "amber" : "muted",
              icon: <PulseIcon className="h-4 w-4" />,
              label: "Disabled",
              value: stats.disabled.toLocaleString(),
              meta: "Skipped at send time",
            },
            {
              key: "categories",
              tone: "brand",
              icon: <LayersIcon className="h-4 w-4" />,
              label: "Categories",
              value: stats.categories.toLocaleString(),
              meta: "Orders · Account · System",
            },
          ]
        : [],
    [stats],
  );

  async function patchTemplate(
    id: string,
    patch: Partial<Pick<EmailTemplateItem, "subject" | "enabled">>,
  ) {
    hideAdminToast();
    try {
      const updated = await updateEmailTemplate(id, patch);
      setTemplates((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, ...updated } : t,
        );
        setStats((s) =>
          s
            ? {
                ...s,
                enabled: next.filter((t) => t.enabled).length,
                disabled: next.filter((t) => !t.enabled).length,
              }
            : s,
        );
        return next;
      });
      adminToast("Template updated.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed.", false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        {showBranding ? <EmailBrandingPanel onSaved={() => void load(true)} /> : null}
        <LibrarySkeleton showNav={showNav} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showBranding ? <EmailBrandingPanel onSaved={() => void load(true)} /> : null}

      <AdminOrderListCard
        icon={<MailIcon className="h-4 w-4" />}
        title="Template library"
        subtitle={
          filtersActive
            ? `${visibleCount} of ${templates.length} templates shown`
            : `${templates.length} template${templates.length === 1 ? "" : "s"} in library`
        }
        className="admin-email-catalog admin-email-template-library"
      >
        {stats ? (
          <TemplateLibraryOverviewStats items={templateLibraryStats} />
        ) : null}

        {emailGates &&
        (!emailGates.orderCustomerEmailsEnabled ||
          !emailGates.adminOrderAlertEmailsEnabled) ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-medium text-amber-50">Global email switches</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-100/90">
              {!emailGates.orderCustomerEmailsEnabled ? (
                <li>
                  Customer order emails are <strong>OFF</strong> in Email
                  settings — all customer order templates are skipped.
                </li>
              ) : null}
              {!emailGates.adminOrderAlertEmailsEnabled ? (
                <li>
                  Admin order alert emails are <strong>OFF</strong> — New Order
                  template will not send even if enabled here.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <div className="admin-email-summary flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
          <span>
            <span className="font-semibold text-foreground">In view</span>{" "}
            {visibleCount.toLocaleString()}
          </span>
          <span>
            <span className="font-semibold text-foreground">Orders</span>{" "}
            {(grouped.get("orders") ?? []).length}
          </span>
          <span>
            <span className="font-semibold text-foreground">Account</span>{" "}
            {(grouped.get("account") ?? []).length}
          </span>
          <span>
            <span className="font-semibold text-foreground">System</span>{" "}
            {(grouped.get("system") ?? []).length}
          </span>
        </div>

        <div className="flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {showNav ? (
          <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
            <dt>Sections</dt>
            <dd>
              <EmailSettingsNav />
            </dd>
          </div>
        ) : null}

        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Filters</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="admin-products-filters-list">
              <div className="admin-products-filters-row">
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="email-templates-search" className="admin-products-filter-label">
                    <SearchIcon className="admin-order-view-detail-icon" aria-hidden />
                    Search
                  </label>
                  <input
                    id="email-templates-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Template name, subject, or ID…"
                    className="admin-input w-full"
                  />
                </div>
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="email-templates-category" className="admin-products-filter-label">
                    Category
                  </label>
                  <AdminSelect
                    id="email-templates-category"
                    value={categoryFilter}
                    onChange={(v) => setCategoryFilter(v as CategoryFilter)}
                    className="w-full"
                    options={CATEGORY_FILTER_OPTIONS}
                  />
                </div>
                <div className="admin-products-filter-field min-w-0">
                  <label htmlFor="email-templates-status" className="admin-products-filter-label">
                    Status
                  </label>
                  <AdminSelect
                    id="email-templates-status"
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as StatusFilter)}
                    className="w-full"
                    options={STATUS_FILTER_OPTIONS}
                  />
                </div>
              </div>
            </div>
          </dd>
        </div>
      </AdminOrderListCard>

      <div className="admin-email-templates-content min-w-0 space-y-5">
        {visibleCount === 0 ? (
          <AdminOrderListCard
            icon={<MailIcon className="h-4 w-4" />}
            title="No templates found"
            subtitle={
              filtersActive
                ? "Try a different search term or filter."
                : "No email templates are available."
            }
            className="admin-email-templates-empty-catalog"
          >
            <div className="dashboard-pro-empty px-4 py-8">
              <span className="dashboard-pro-empty-icon" aria-hidden>
                <MailIcon className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {filtersActive ? "No templates match your filters" : "No templates yet"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-foreground-muted">
                {filtersActive
                  ? "Clear filters or search for a different template name."
                  : "Templates will appear here once configured."}
              </p>
            </div>
          </AdminOrderListCard>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const items = grouped.get(category) ?? [];
            if (items.length === 0) return null;
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <AdminOrderListCard
                key={category}
                icon={<Icon className="h-4 w-4" />}
                title={meta.title}
                subtitle={`${items.length} template${items.length === 1 ? "" : "s"} · ${meta.description}`}
                className="admin-email-templates-category-catalog"
              >
                <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                  <table className="panel-3d-table admin-email-templates-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Template</th>
                        <th>Recipient</th>
                        <th>Subject</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((template) => (
                        <TemplateTableRow
                          key={template.id}
                          template={template}
                          onSubjectChange={(subject) =>
                            patchTemplate(template.id, { subject })
                          }
                          onToggleEnabled={(enabled) =>
                            patchTemplate(template.id, { enabled })
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </AdminOrderListCard>
            );
          })
        )}
      </div>
    </div>
  );
}

const TemplateTableRow = memo(function TemplateTableRow({
  template,
  onSubjectChange,
  onToggleEnabled,
}: {
  template: EmailTemplateItem;
  onSubjectChange: (subject: string) => void;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSubject(template.subject);
    setDirty(false);
  }, [template.subject]);

  return (
    <tr className="text-foreground-muted">
      <td>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{template.label}</p>
            <CustomDesignBadge template={template} />
            <TemplateSendMetaBadge templateId={template.id} />
          </div>
          <p className="mt-0.5 max-w-md text-xs text-subtle">{template.description}</p>
          {getOrderTemplateSendMeta(template.id)?.hint ? (
            <p className="mt-1 max-w-md text-[10px] text-amber-200/80">
              {getOrderTemplateSendMeta(template.id)?.hint}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[10px] text-teal-300/80">{template.id}</p>
        </div>
      </td>
      <td>
        <RecipientBadge recipient={template.recipient} />
      </td>
      <td className="min-w-[14rem]">
        <div className="space-y-1">
          {dirty ? (
            <span className="text-[10px] font-medium text-amber-300">Unsaved</span>
          ) : null}
          <input
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setDirty(e.target.value !== template.subject);
            }}
            onBlur={() => {
              if (subject !== template.subject) {
                onSubjectChange(subject);
                setDirty(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="admin-input w-full font-mono text-xs"
          />
        </div>
      </td>
      <td>
        <div className="flex flex-col items-start gap-2">
          <StatusPill enabled={template.enabled} />
          <button
            type="button"
            role="switch"
            aria-checked={template.enabled}
            aria-label={`Toggle ${template.label}`}
            onClick={() => onToggleEnabled(!template.enabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              template.enabled ? "bg-teal-500" : "bg-white/10"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                template.enabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </td>
      <td className="text-right">
        <Link
          href={`/admin/settings/email/templates/${encodeURIComponent(template.id)}`}
          className="dashboard-pro-btn-ghost inline-flex items-center gap-1.5 text-xs"
        >
          Customize
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
});

function TemplateSendMetaBadge({ templateId }: { templateId: string }) {
  const meta = getOrderTemplateSendMeta(templateId);
  if (!meta) return null;
  if (!meta.wired) {
    return (
      <span className="dashboard-pro-status dashboard-pro-status--muted text-[10px]">
        Not wired
      </span>
    );
  }
  if (!meta.hint) return null;
  return (
    <span
      className="dashboard-pro-status dashboard-pro-status--amber text-[10px]"
      title={meta.hint}
    >
      Note
    </span>
  );
}

function LibrarySkeleton({ showNav }: { showNav: boolean }) {
  return (
    <>
      <AdminOrderListCard
        icon={<MailIcon className="h-4 w-4" />}
        title="Template library"
        subtitle="Loading templates…"
        className="admin-email-catalog admin-email-template-library"
      >
        <section
          className="customer-dashboard-overview-section admin-email-overview"
          aria-hidden
        >
          <dl className="customer-dashboard-overview-stats">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="customer-dashboard-overview-stat customer-dashboard-overview-stat--muted admin-email-overview-stat h-[5.25rem] animate-pulse bg-white/[0.03]"
              />
            ))}
          </dl>
        </section>
        {showNav ? (
          <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
            <dt>Sections</dt>
            <dd>
              <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-white/[0.04]" />
            </dd>
          </div>
        ) : null}
      </AdminOrderListCard>
      <div className="dashboard-pro-card h-64 animate-pulse bg-white/[0.02]" />
    </>
  );
}
