"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AdminQuickAddSelect } from "@/components/admin/AdminQuickAddSelect";
import {
  GridIcon,
  LinkIcon,
  MenuIcon,
  PulseIcon,
} from "@/components/admin/icons";
import {
  adminGetCategories,
  getCustomerPanelAdminSettings,
  updateCustomerPanelSettings,
  type Category,
  type SiteFooterColumn,
  type SiteMenuLink,
  type SiteMenusConfig,
} from "@/lib/api";
import { invalidatePanelConfig } from "@/lib/customer-panel";
import {
  DEFAULT_SITE_MENUS,
  DEFAULT_HEADER_OTHERS_ITEMS,
  normalizeSiteMenus,
} from "@/lib/site-menus";
import { categoryPath } from "@/lib/seo";

const inputCls = "admin-input w-full";

type Tab = "header" | "others" | "footer";

type EditableHeaderLink = SiteMenuLink & { id: string };
type EditableFooterItem = SiteMenuLink & { id: string };
type EditableFooterColumn = {
  id: string;
  title: string;
  items: EditableFooterItem[];
};

const PAGE_PRESETS: SiteMenuLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/products" },
  { label: "Contact us", href: "/support" },
];

const OTHERS_PRESETS: SiteMenuLink[] = DEFAULT_HEADER_OTHERS_ITEMS;

function categoryMenuLink(category: Category): SiteMenuLink | null {
  const slug = category.slug?.trim();
  if (!slug || category.isActive === false) return null;
  return {
    label: category.name,
    href: categoryPath(slug),
  };
}

function flattenCategoryMenuLinks(nodes: Category[]): SiteMenuLink[] {
  const out: SiteMenuLink[] = [];
  for (const node of nodes) {
    const link = categoryMenuLink(node);
    if (link) out.push(link);
    if (node.children?.length) {
      out.push(...flattenCategoryMenuLinks(node.children));
    }
  }
  return out;
}

const FOOTER_PRESETS: SiteFooterColumn[] = [
  {
    title: "Footer Menu",
    items: [
      { label: "Product Requests", href: "/request-product" },
      { label: "All products", href: "/products" },
      { label: "Gaming", href: "/products?type=topup" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Sign in", href: "/login" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
];

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toEditableHeader(links: SiteMenuLink[]): EditableHeaderLink[] {
  return links.map((item) => ({ ...item, id: newId("header") }));
}

function toEditableFooter(columns: SiteFooterColumn[]): EditableFooterColumn[] {
  return columns.map((column) => ({
    id: newId("column"),
    title: column.title,
    items: column.items.map((item) => ({ ...item, id: newId("footer") })),
  }));
}

function toPayload(
  header: EditableHeaderLink[],
  headerOthers: EditableHeaderLink[],
  footer: EditableFooterColumn[],
): SiteMenusConfig {
  return {
    header: header
      .map(({ label, href }) => ({ label: label.trim(), href: href.trim() }))
      .filter((item) => item.label && item.href),
    headerOthers: headerOthers
      .map(({ label, href }) => ({ label: label.trim(), href: href.trim() }))
      .filter((item) => item.label && item.href),
    footer: footer
      .map((column) => ({
        title: column.title.trim(),
        items: column.items
          .map(({ label, href }) => ({ label: label.trim(), href: href.trim() }))
          .filter((item) => item.label && item.href),
      }))
      .filter((column) => column.title && column.items.length > 0),
  };
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  const current = copy[index];
  const adjacent = copy[nextIndex];
  if (current === undefined || adjacent === undefined) return items;
  copy[index] = adjacent;
  copy[nextIndex] = current;
  return copy;
}

function moveItemToIndex<T>(items: T[], index: number, targetIndex: number): T[] {
  if (
    targetIndex < 0 ||
    targetIndex >= items.length ||
    targetIndex === index
  ) {
    return items;
  }
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  if (item === undefined) return items;
  copy.splice(targetIndex, 0, item);
  return copy;
}

function overviewStatClass(tone: "brand" | "success" | "amber" | "muted") {
  return [
    "customer-dashboard-overview-stat",
    `customer-dashboard-overview-stat--${tone}`,
    "cursor-default",
  ].join(" ");
}

function MenuOverviewStatCopy({
  label,
  value,
  meta,
}: {
  label: string;
  value: string | number;
  meta: string;
}) {
  return (
    <div className="customer-dashboard-overview-stat-copy min-w-0">
      <span className="customer-dashboard-overview-stat-label">{label}</span>
      <span className="customer-dashboard-overview-stat-value">{value}</span>
      <p className="customer-dashboard-overview-stat-meta">{meta}</p>
    </div>
  );
}

function RowActions({
  canMoveUp,
  canMoveDown,
  canMoveFirst = false,
  canMoveLast = false,
  onMoveUp,
  onMoveDown,
  onMoveFirst,
  onMoveLast,
  onDuplicate,
  onDelete,
  deleteLabel = "Remove",
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  canMoveFirst?: boolean;
  canMoveLast?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveFirst?: () => void;
  onMoveLast?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {canMoveFirst || onMoveFirst ? (
        <button
          type="button"
          disabled={!canMoveFirst}
          onClick={onMoveFirst}
          className="admin-site-menus-icon-btn"
          aria-label="Move to first"
          title="Move to first"
        >
          ⇈
        </button>
      ) : null}
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={onMoveUp}
        className="admin-site-menus-icon-btn"
        aria-label="Move up"
        title="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={!canMoveDown}
        onClick={onMoveDown}
        className="admin-site-menus-icon-btn"
        aria-label="Move down"
        title="Move down"
      >
        ↓
      </button>
      {canMoveLast || onMoveLast ? (
        <button
          type="button"
          disabled={!canMoveLast}
          onClick={onMoveLast}
          className="admin-site-menus-icon-btn"
          aria-label="Move to last"
          title="Move to last"
        >
          ⇊
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDuplicate}
        className="admin-site-menus-icon-btn"
        aria-label="Duplicate"
        title="Duplicate"
      >
        ⧉
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="admin-site-menus-icon-btn admin-site-menus-icon-btn--danger"
        aria-label={deleteLabel}
        title={deleteLabel}
      >
        ✕
      </button>
    </div>
  );
}

export default function AdminSiteMenusPage() {
  const [tab, setTab] = useState<Tab>("header");
  const [headerLinks, setHeaderLinks] = useState<EditableHeaderLink[]>([]);
  const [othersLinks, setOthersLinks] = useState<EditableHeaderLink[]>([]);
  const [footerColumns, setFooterColumns] = useState<EditableFooterColumn[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const categoryQuickLinks = useMemo(
    () => flattenCategoryMenuLinks(categories),
    [categories],
  );

  const headerHrefSet = useMemo(
    () => new Set(headerLinks.map((item) => item.href.trim().toLowerCase())),
    [headerLinks],
  );

  const othersHrefSet = useMemo(
    () => new Set(othersLinks.map((item) => item.href.trim().toLowerCase())),
    [othersLinks],
  );

  const headerQuickAddGroups = useMemo(
    () => [
      { label: "Pages", items: PAGE_PRESETS.map((preset, index) => ({
        value: `page:${index}`,
        label: preset.label,
      })) },
      ...(categoryQuickLinks.length > 0
        ? [{
            label: "Categories",
            items: categoryQuickLinks.map((preset, index) => ({
              value: `cat:${index}`,
              label: preset.label,
            })),
          }]
        : []),
    ],
    [categoryQuickLinks],
  );

  const othersQuickAddGroups = useMemo(
    () => [
      {
        label: "Pages",
        items: OTHERS_PRESETS.map((preset, index) => ({
          value: String(index),
          label: preset.label,
        })),
      },
    ],
    [],
  );

  const footerQuickAddGroups = useMemo(
    () => [
      {
        label: "Columns",
        items: FOOTER_PRESETS.map((preset, index) => ({
          value: String(index),
          label: preset.title,
        })),
      },
    ],
    [],
  );

  function pickHeaderQuickAdd(value: string) {
    if (value.startsWith("page:")) {
      const preset = PAGE_PRESETS[Number(value.slice(5))];
      if (preset) addHeaderLink(preset);
      return;
    }
    if (value.startsWith("cat:")) {
      const preset = categoryQuickLinks[Number(value.slice(4))];
      if (preset) addHeaderLink(preset);
    }
  }

  function pickOthersQuickAdd(value: string) {
    const preset = OTHERS_PRESETS[Number(value)];
    if (preset) addOthersLink(preset);
  }

  function pickFooterQuickAdd(value: string) {
    const preset = FOOTER_PRESETS[Number(value)];
    if (preset) addFooterColumn(preset);
  }

  const stats = useMemo(() => {
    const validHeader = headerLinks.filter(
      (item) => item.label.trim() && item.href.trim(),
    ).length;
    const validOthers = othersLinks.filter(
      (item) => item.label.trim() && item.href.trim(),
    ).length;
    const validFooterLinks = footerColumns.reduce(
      (sum, column) =>
        sum +
        column.items.filter((item) => item.label.trim() && item.href.trim())
          .length,
      0,
    );
    return {
      headerCount: validHeader,
      othersCount: validOthers,
      footerColumns: footerColumns.filter((column) => column.title.trim()).length,
      footerLinks: validFooterLinks,
    };
  }, [headerLinks, othersLinks, footerColumns]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getCustomerPanelAdminSettings(),
      adminGetCategories().catch(() => [] as Category[]),
    ])
      .then(([data, categoryTree]) => {
        if (cancelled) return;
        const menus = normalizeSiteMenus(data.siteMenus);
        setHeaderLinks(toEditableHeader(menus.header));
        setOthersLinks(toEditableHeader(menus.headerOthers));
        setFooterColumns(toEditableFooter(menus.footer));
        setCategories(categoryTree);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load menus");
          setHeaderLinks(toEditableHeader(DEFAULT_SITE_MENUS.header));
          setOthersLinks(toEditableHeader(DEFAULT_SITE_MENUS.headerOthers));
          setFooterColumns(toEditableFooter(DEFAULT_SITE_MENUS.footer));
          setCategories([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    hideAdminToast();
    const payload = toPayload(headerLinks, othersLinks, footerColumns);
    if (payload.header.length === 0) {
      setError("Add at least one header menu link.");
      setTab("header");
      return;
    }
    if (payload.footer.length === 0) {
      setError("Add at least one footer column with links.");
      setTab("footer");
      return;
    }
    setSaving(true);
    try {
      const result = await updateCustomerPanelSettings({ siteMenus: payload });
      const menus = normalizeSiteMenus(
        (result as { siteMenus?: SiteMenusConfig }).siteMenus ?? payload,
      );
      setHeaderLinks(toEditableHeader(menus.header));
      setOthersLinks(toEditableHeader(menus.headerOthers));
      setFooterColumns(toEditableFooter(menus.footer));
      invalidatePanelConfig();
      adminToast("Menus saved. Refresh the storefront to see changes.", true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    if (!confirm("Reset header, Others, and footer menus to default links?")) return;
    setHeaderLinks(toEditableHeader(DEFAULT_SITE_MENUS.header));
    setOthersLinks(toEditableHeader(DEFAULT_SITE_MENUS.headerOthers));
    setFooterColumns(toEditableFooter(DEFAULT_SITE_MENUS.footer));
    setError(null);
    hideAdminToast();
  }

  function addOthersLink(preset?: SiteMenuLink) {
    const href = preset?.href?.trim() ?? "";
    if (href && othersHrefSet.has(href.toLowerCase())) {
      setError(`"${preset?.label ?? href}" is already in the Others menu.`);
      return;
    }
    setOthersLinks((items) => [
      ...items,
      {
        id: newId("others"),
        label: preset?.label ?? "",
        href: preset?.href ?? "",
      },
    ]);
  }

  function addHeaderLink(preset?: SiteMenuLink) {
    const href = preset?.href?.trim() ?? "";
    if (href && headerHrefSet.has(href.toLowerCase())) {
      setError(`"${preset?.label ?? href}" is already in the header menu.`);
      return;
    }
    setHeaderLinks((items) => [
      ...items,
      {
        id: newId("header"),
        label: preset?.label ?? "",
        href: preset?.href ?? "",
      },
    ]);
  }

  function addFooterColumn(preset?: SiteFooterColumn) {
    setFooterColumns((columns) => [
      ...columns,
      {
        id: newId("column"),
        title: preset?.title ?? "",
        items: (preset?.items ?? [{ label: "", href: "" }]).map((item) => ({
          ...item,
          id: newId("footer"),
        })),
      },
    ]);
  }

  return (
    <AdminPageLayout
      section="Settings"
      title="Header & footer menus"
      description="Manage storefront header links, Others dropdown, and footer navigation."
      icon={LinkIcon}
      backHref="/admin/settings"
      backLabel="Settings"
      loading={loading}
      loadingText="Loading menus…"
    >
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSave} className="space-y-5">
        <AdminOrderTwoColumnLayout
          main={
            <>
              <AdminOrderListCard
                icon={<LinkIcon className="h-4 w-4" />}
                title="Menus overview"
                subtitle="Header and footer navigation at a glance"
                className="admin-site-menus-catalog"
              >
                <section
                  className="customer-dashboard-overview-section admin-site-menus-overview"
                  aria-label="Menus overview"
                >
                  <div className="customer-dashboard-overview-stats">
                    <div className={overviewStatClass("brand")}>
                      <span
                        className="customer-dashboard-overview-stat-glow"
                        aria-hidden
                      />
                      <span
                        className="customer-dashboard-overview-stat-icon"
                        aria-hidden
                      >
                        <LinkIcon className="h-4 w-4" />
                      </span>
                      <MenuOverviewStatCopy
                        label="Header links"
                        value={stats.headerCount}
                        meta="Top navigation bar"
                      />
                    </div>

                    <div className={overviewStatClass("amber")}>
                      <span
                        className="customer-dashboard-overview-stat-glow"
                        aria-hidden
                      />
                      <span
                        className="customer-dashboard-overview-stat-icon"
                        aria-hidden
                      >
                        <GridIcon className="h-4 w-4" />
                      </span>
                      <MenuOverviewStatCopy
                        label="Footer columns"
                        value={stats.footerColumns}
                        meta="Grouped link sections"
                      />
                    </div>

                    <div className={overviewStatClass("amber")}>
                      <span
                        className="customer-dashboard-overview-stat-glow"
                        aria-hidden
                      />
                      <span
                        className="customer-dashboard-overview-stat-icon"
                        aria-hidden
                      >
                        <MenuIcon className="h-4 w-4" />
                      </span>
                      <MenuOverviewStatCopy
                        label="Footer links"
                        value={stats.footerLinks}
                        meta="Links across all columns"
                      />
                    </div>

                    <div className={overviewStatClass("success")}>
                      <span
                        className="customer-dashboard-overview-stat-glow"
                        aria-hidden
                      />
                      <span
                        className="customer-dashboard-overview-stat-icon"
                        aria-hidden
                      >
                        <MenuIcon className="h-4 w-4" />
                      </span>
                      <MenuOverviewStatCopy
                        label="Others links"
                        value={stats.othersCount}
                        meta="Header Others dropdown"
                      />
                    </div>

                    <div className={overviewStatClass("success")}>
                      <span
                        className="customer-dashboard-overview-stat-glow"
                        aria-hidden
                      />
                      <span
                        className="customer-dashboard-overview-stat-icon"
                        aria-hidden
                      >
                        <PulseIcon className="h-4 w-4" />
                      </span>
                      <MenuOverviewStatCopy
                        label="Total links"
                        value={stats.headerCount + stats.othersCount + stats.footerLinks}
                        meta="Header + Others + footer"
                      />
                    </div>
                  </div>
                </section>

                <div className="admin-site-menus-toolbar">
                  <p className="admin-site-menus-toolbar-stat">
                    <span className="admin-site-menus-toolbar-label">
                      Categories
                    </span>
                    <span className="text-foreground">
                      {categoryQuickLinks.length}
                    </span>
                  </p>

                  <p className="admin-site-menus-toolbar-stat">
                    <span className="admin-site-menus-toolbar-label">
                      Active tab
                    </span>
                    <span className="text-foreground">
                      {tab === "header"
                        ? "Header menu"
                        : tab === "others"
                          ? "Others menu"
                          : "Footer menu"}
                    </span>
                  </p>

                  <div className="admin-site-menus-toolbar-group">
                    <span className="admin-site-menus-toolbar-label">
                      Sections
                    </span>
                    <div className="admin-notifications-tabs admin-site-menus-toolbar-tabs">
                      <button
                        type="button"
                        onClick={() => setTab("header")}
                        className={`admin-notifications-tab${
                          tab === "header" ? " admin-notifications-tab--active" : ""
                        }`}
                      >
                        Header menu
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("others")}
                        className={`admin-notifications-tab${
                          tab === "others" ? " admin-notifications-tab--active" : ""
                        }`}
                      >
                        Others menu
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("footer")}
                        className={`admin-notifications-tab${
                          tab === "footer" ? " admin-notifications-tab--active" : ""
                        }`}
                      >
                        Footer menu
                      </button>
                    </div>
                  </div>

                  <div className="admin-site-menus-toolbar-group admin-site-menus-toolbar-actions">
                    <span className="admin-site-menus-toolbar-label">Actions</span>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {tab === "header" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => addHeaderLink()}
                            className="dashboard-pro-btn-ghost text-xs"
                          >
                            + Add link
                          </button>
                          <AdminQuickAddSelect
                            placeholder="Quick add…"
                            groups={headerQuickAddGroups}
                            onPick={pickHeaderQuickAdd}
                            className="admin-site-menus-quick-add"
                          />
                        </>
                      ) : tab === "others" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => addOthersLink()}
                            className="dashboard-pro-btn-ghost text-xs"
                          >
                            + Add link
                          </button>
                          <AdminQuickAddSelect
                            placeholder="Quick add…"
                            groups={othersQuickAddGroups}
                            onPick={pickOthersQuickAdd}
                            className="admin-site-menus-quick-add"
                          />
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => addFooterColumn()}
                            className="dashboard-pro-btn-ghost text-xs"
                          >
                            + Add column
                          </button>
                          <AdminQuickAddSelect
                            placeholder="Quick add column…"
                            groups={footerQuickAddGroups}
                            onPick={pickFooterQuickAdd}
                            className="admin-site-menus-quick-add"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </AdminOrderListCard>

              <div className="admin-site-menus-content min-w-0 space-y-5">
                {tab === "header" ? (
                  <AdminOrderListCard
                    icon={<LinkIcon className="h-4 w-4" />}
                    title="Header links"
                    subtitle="Order matters — use ⇈ ⇊ for first/last, ↑ ↓ for one step"
                    className="admin-site-menus-header-catalog"
                  >
                    {categoryQuickLinks.length > 0 ? (
                      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                        <dt>Quick add categories</dt>
                        <dd>
                          <div className="flex flex-wrap gap-2">
                            {categoryQuickLinks.map((cat) => {
                              const added = headerHrefSet.has(cat.href.toLowerCase());
                              return (
                                <button
                                  key={cat.href}
                                  type="button"
                                  disabled={added}
                                  onClick={() => addHeaderLink(cat)}
                                  className="dashboard-pro-quick-link disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {added ? "✓ " : "+ "}
                                  {cat.label}
                                </button>
                              );
                            })}
                          </div>
                        </dd>
                      </div>
                    ) : (
                      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                        <dt>Categories</dt>
                        <dd className="text-xs text-subtle">
                          No catalog categories yet.{" "}
                          <Link
                            href="/admin/products/categories"
                            className="font-semibold text-brand underline"
                          >
                            Create categories
                          </Link>{" "}
                          to add them here.
                        </dd>
                      </div>
                    )}
                    {headerLinks.length === 0 ? (
                      <div className="dashboard-pro-empty px-4 py-8">
                        <p className="text-sm font-medium text-foreground">No header links yet</p>
                        <p className="mt-1 text-xs text-subtle">
                          Add a link or pick one from Quick add.
                        </p>
                        <button
                          type="button"
                          onClick={() => addHeaderLink()}
                          className="btn-primary btn-primary-sm mt-4"
                        >
                          + Add first link
                        </button>
                      </div>
                    ) : (
                      <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                        <table className="panel-3d-table admin-site-menus-table w-full text-sm">
                          <thead>
                            <tr>
                              <th className="w-10">#</th>
                              <th>Label</th>
                              <th>URL</th>
                              <th className="admin-site-menus-table-sticky-actions w-[220px] text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {headerLinks.map((item, index) => (
                              <tr key={item.id}>
                                <td className="text-subtle">{index + 1}</td>
                                <td>
                                  <input
                                    value={item.label}
                                    onChange={(e) =>
                                      setHeaderLinks((items) =>
                                        items.map((row, i) =>
                                          i === index
                                            ? { ...row, label: e.target.value }
                                            : row,
                                        ),
                                      )
                                    }
                                    placeholder="Shop"
                                    className={inputCls}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={item.href}
                                    onChange={(e) =>
                                      setHeaderLinks((items) =>
                                        items.map((row, i) =>
                                          i === index
                                            ? { ...row, href: e.target.value }
                                            : row,
                                        ),
                                      )
                                    }
                                    placeholder="/products"
                                    className={inputCls}
                                  />
                                </td>
                                <td className="admin-site-menus-table-sticky-actions">
                                  <RowActions
                                    canMoveFirst={index > 0}
                                    canMoveLast={index < headerLinks.length - 1}
                                    canMoveUp={index > 0}
                                    canMoveDown={index < headerLinks.length - 1}
                                    onMoveFirst={() =>
                                      setHeaderLinks((items) =>
                                        moveItemToIndex(items, index, 0),
                                      )
                                    }
                                    onMoveLast={() =>
                                      setHeaderLinks((items) =>
                                        moveItemToIndex(items, index, items.length - 1),
                                      )
                                    }
                                    onMoveUp={() =>
                                      setHeaderLinks((items) => moveItem(items, index, -1))
                                    }
                                    onMoveDown={() =>
                                      setHeaderLinks((items) => moveItem(items, index, 1))
                                    }
                                    onDuplicate={() =>
                                      setHeaderLinks((items) => {
                                        const copy = [...items];
                                        copy.splice(index + 1, 0, {
                                          ...item,
                                          id: newId("header"),
                                        });
                                        return copy;
                                      })
                                    }
                                    onDelete={() => {
                                      if (headerLinks.length === 1) {
                                        setError("Keep at least one header link.");
                                        return;
                                      }
                                      setHeaderLinks((items) =>
                                        items.filter((_, i) => i !== index),
                                      );
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </AdminOrderListCard>
                ) : tab === "others" ? (
                  <AdminOrderListCard
                    icon={<MenuIcon className="h-4 w-4" />}
                    title="Others menu links"
                    subtitle="Shown in the header Others dropdown — order matters"
                    className="admin-site-menus-header-catalog"
                  >
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Quick add pages</dt>
                      <dd>
                        <div className="flex flex-wrap gap-2">
                          {OTHERS_PRESETS.map((preset) => {
                            const added = othersHrefSet.has(preset.href.toLowerCase());
                            return (
                              <button
                                key={preset.href}
                                type="button"
                                disabled={added}
                                onClick={() => addOthersLink(preset)}
                                className="dashboard-pro-quick-link disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {added ? "✓ " : "+ "}
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </dd>
                    </div>
                    {othersLinks.length === 0 ? (
                      <div className="dashboard-pro-empty px-4 py-8">
                        <p className="text-sm font-medium text-foreground">
                          No Others links yet
                        </p>
                        <p className="mt-1 text-xs text-subtle">
                          Add links here to show the Others dropdown in the header.
                          Leave empty to hide it.
                        </p>
                        <button
                          type="button"
                          onClick={() => addOthersLink()}
                          className="btn-primary btn-primary-sm mt-4"
                        >
                          + Add first link
                        </button>
                      </div>
                    ) : (
                      <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                        <table className="panel-3d-table admin-site-menus-table w-full text-sm">
                          <thead>
                            <tr>
                              <th className="w-10">#</th>
                              <th>Label</th>
                              <th>URL</th>
                              <th className="admin-site-menus-table-sticky-actions w-[220px] text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {othersLinks.map((item, index) => (
                              <tr key={item.id}>
                                <td className="text-subtle">{index + 1}</td>
                                <td>
                                  <input
                                    value={item.label}
                                    onChange={(e) =>
                                      setOthersLinks((items) =>
                                        items.map((row, i) =>
                                          i === index
                                            ? { ...row, label: e.target.value }
                                            : row,
                                        ),
                                      )
                                    }
                                    placeholder="Blog"
                                    className={inputCls}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={item.href}
                                    onChange={(e) =>
                                      setOthersLinks((items) =>
                                        items.map((row, i) =>
                                          i === index
                                            ? { ...row, href: e.target.value }
                                            : row,
                                        ),
                                      )
                                    }
                                    placeholder="/blog"
                                    className={inputCls}
                                  />
                                </td>
                                <td className="admin-site-menus-table-sticky-actions">
                                  <RowActions
                                    canMoveFirst={index > 0}
                                    canMoveLast={index < othersLinks.length - 1}
                                    canMoveUp={index > 0}
                                    canMoveDown={index < othersLinks.length - 1}
                                    onMoveFirst={() =>
                                      setOthersLinks((items) =>
                                        moveItemToIndex(items, index, 0),
                                      )
                                    }
                                    onMoveLast={() =>
                                      setOthersLinks((items) =>
                                        moveItemToIndex(items, index, items.length - 1),
                                      )
                                    }
                                    onMoveUp={() =>
                                      setOthersLinks((items) => moveItem(items, index, -1))
                                    }
                                    onMoveDown={() =>
                                      setOthersLinks((items) => moveItem(items, index, 1))
                                    }
                                    onDuplicate={() =>
                                      setOthersLinks((items) => {
                                        const copy = [...items];
                                        copy.splice(index + 1, 0, {
                                          ...item,
                                          id: newId("others"),
                                        });
                                        return copy;
                                      })
                                    }
                                    onDelete={() => {
                                      setOthersLinks((items) =>
                                        items.filter((_, i) => i !== index),
                                      );
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </AdminOrderListCard>
                ) : (
                  <div className="space-y-5">
                    {footerColumns.length === 0 ? (
                      <AdminOrderListCard
                        icon={<LinkIcon className="h-4 w-4" />}
                        title="No footer columns yet"
                        subtitle="Add a column group like Footer Menu, Account, or Support"
                        className="admin-site-menus-footer-catalog"
                      >
                        <div className="dashboard-pro-empty px-4 py-8">
                          <button
                            type="button"
                            onClick={() => addFooterColumn()}
                            className="btn-primary btn-primary-sm"
                          >
                            + Add first column
                          </button>
                        </div>
                      </AdminOrderListCard>
                    ) : null}

                    {footerColumns.map((column, columnIndex) => (
                      <AdminOrderListCard
                        key={column.id}
                        icon={<LinkIcon className="h-4 w-4" />}
                        title={column.title.trim() || `Column ${columnIndex + 1}`}
                        subtitle={`${column.items.length} link${column.items.length === 1 ? "" : "s"}`}
                        className="admin-site-menus-footer-catalog"
                      >
                        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                          <dt>Column title</dt>
                          <dd className="admin-product-form-sidebar-fields">
                            <input
                              id={`column-title-${column.id}`}
                              value={column.title}
                              onChange={(e) =>
                                setFooterColumns((columns) =>
                                  columns.map((row, i) =>
                                    i === columnIndex
                                      ? { ...row, title: e.target.value }
                                      : row,
                                  ),
                                )
                              }
                              placeholder="Footer Menu"
                              className={inputCls}
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={columnIndex === 0}
                                onClick={() =>
                                  setFooterColumns((columns) =>
                                    moveItem(columns, columnIndex, -1),
                                  )
                                }
                                className="dashboard-pro-btn-ghost text-xs"
                              >
                                Move column up
                              </button>
                              <button
                                type="button"
                                disabled={columnIndex === footerColumns.length - 1}
                                onClick={() =>
                                  setFooterColumns((columns) =>
                                    moveItem(columns, columnIndex, 1),
                                  )
                                }
                                className="dashboard-pro-btn-ghost text-xs"
                              >
                                Move column down
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (footerColumns.length === 1) {
                                    setError("Keep at least one footer column.");
                                    return;
                                  }
                                  if (
                                    !confirm(
                                      `Remove footer column "${column.title || "Untitled"}"?`,
                                    )
                                  ) {
                                    return;
                                  }
                                  setFooterColumns((columns) =>
                                    columns.filter((_, i) => i !== columnIndex),
                                  );
                                }}
                                className="dashboard-pro-btn-ghost text-xs text-rose-400"
                              >
                                Remove column
                              </button>
                            </div>
                          </dd>
                        </div>

                        <div className="admin-products-table-wrap panel-3d-table-wrap overflow-x-auto">
                          <table className="panel-3d-table admin-site-menus-table w-full text-sm">
                            <thead>
                              <tr>
                                <th className="w-10">#</th>
                                <th>Label</th>
                                <th>URL</th>
                                <th className="admin-site-menus-table-sticky-actions w-[220px] text-right">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {column.items.map((item, itemIndex) => (
                                <tr key={item.id}>
                                  <td className="text-subtle">{itemIndex + 1}</td>
                                  <td>
                                    <input
                                      value={item.label}
                                      onChange={(e) =>
                                        setFooterColumns((columns) =>
                                          columns.map((row, i) =>
                                            i === columnIndex
                                              ? {
                                                  ...row,
                                                  items: row.items.map((link, j) =>
                                                    j === itemIndex
                                                      ? { ...link, label: e.target.value }
                                                      : link,
                                                  ),
                                                }
                                              : row,
                                          ),
                                        )
                                      }
                                      placeholder="Link label"
                                      className={inputCls}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      value={item.href}
                                      onChange={(e) =>
                                        setFooterColumns((columns) =>
                                          columns.map((row, i) =>
                                            i === columnIndex
                                              ? {
                                                  ...row,
                                                  items: row.items.map((link, j) =>
                                                    j === itemIndex
                                                      ? { ...link, href: e.target.value }
                                                      : link,
                                                  ),
                                                }
                                              : row,
                                          ),
                                        )
                                      }
                                      placeholder="/products"
                                      className={inputCls}
                                    />
                                  </td>
                                  <td className="admin-site-menus-table-sticky-actions">
                                    <RowActions
                                      canMoveFirst={itemIndex > 0}
                                      canMoveLast={itemIndex < column.items.length - 1}
                                      canMoveUp={itemIndex > 0}
                                      canMoveDown={itemIndex < column.items.length - 1}
                                      onMoveFirst={() =>
                                        setFooterColumns((columns) =>
                                          columns.map((row, i) =>
                                            i === columnIndex
                                              ? {
                                                  ...row,
                                                  items: moveItemToIndex(row.items, itemIndex, 0),
                                                }
                                              : row,
                                          ),
                                        )
                                      }
                                      onMoveLast={() =>
                                        setFooterColumns((columns) =>
                                          columns.map((row, i) =>
                                            i === columnIndex
                                              ? {
                                                  ...row,
                                                  items: moveItemToIndex(
                                                    row.items,
                                                    itemIndex,
                                                    row.items.length - 1,
                                                  ),
                                                }
                                              : row,
                                          ),
                                        )
                                      }
                                      onMoveUp={() =>
                                        setFooterColumns((columns) =>
                                          columns.map((row, i) =>
                                            i === columnIndex
                                              ? {
                                                  ...row,
                                                  items: moveItem(row.items, itemIndex, -1),
                                                }
                                              : row,
                                          ),
                                        )
                                      }
                                      onMoveDown={() =>
                                        setFooterColumns((columns) =>
                                          columns.map((row, i) =>
                                            i === columnIndex
                                              ? {
                                                  ...row,
                                                  items: moveItem(row.items, itemIndex, 1),
                                                }
                                              : row,
                                          ),
                                        )
                                      }
                                      onDuplicate={() =>
                                        setFooterColumns((columns) =>
                                          columns.map((row, i) => {
                                            if (i !== columnIndex) return row;
                                            const items = [...row.items];
                                            items.splice(itemIndex + 1, 0, {
                                              ...item,
                                              id: newId("footer"),
                                            });
                                            return { ...row, items };
                                          }),
                                        )
                                      }
                                      onDelete={() =>
                                        setFooterColumns((columns) =>
                                          columns.map((row, i) =>
                                            i === columnIndex
                                              ? {
                                                  ...row,
                                                  items: row.items.filter(
                                                    (_, j) => j !== itemIndex,
                                                  ),
                                                }
                                              : row,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                          <dt>Add link</dt>
                          <dd className="admin-product-form-sidebar-fields">
                            <button
                              type="button"
                              onClick={() =>
                                setFooterColumns((columns) =>
                                  columns.map((row, i) =>
                                    i === columnIndex
                                      ? {
                                          ...row,
                                          items: [
                                            ...row.items,
                                            { id: newId("footer"), label: "", href: "" },
                                          ],
                                        }
                                      : row,
                                  ),
                                )
                              }
                              className="dashboard-pro-btn-ghost text-xs"
                            >
                              + Add link to this column
                            </button>
                          </dd>
                        </div>
                      </AdminOrderListCard>
                    ))}
                  </div>
                )}

                <section
                  className="admin-appearance-actions-bar admin-site-menus-save"
                  aria-label="Save menus"
                >
                  <div className="admin-appearance-actions-copy min-w-0">
                    <span className="admin-appearance-actions-title">Save menus</span>
                    <span className="admin-appearance-actions-subtitle">
                      Publish header, Others dropdown, and footer navigation
                    </span>
                  </div>

                  <span className="admin-appearance-actions-publish">Publish</span>

                  <div className="admin-appearance-actions-buttons">
                    <button
                      type="button"
                      onClick={resetDefaults}
                      className="dashboard-pro-btn-ghost px-4 py-2 text-sm"
                    >
                      Reset defaults
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary btn-primary-sm disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save menus"}
                    </button>
                  </div>
                </section>
              </div>
            </>
          }
          sidebar={
            <>
              <ProductFormOrderCard
                title="Tips"
                subtitle="Paths, external links, and ordering"
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Guidelines</dt>
                  <dd className="text-xs text-foreground-muted">
                    <ul className="space-y-2">
                      <li>
                        Use site paths like <code className="text-brand">/products</code>
                      </li>
                      <li>
                        External links work too:{" "}
                        <code className="text-brand">https://…</code>
                      </li>
                      <li>Reorder with ⇈ first, ⇊ last, or ↑ ↓ one step</li>
                      <li>
                        <Link href="/" target="_blank" className="text-brand hover:underline">
                          Open storefront
                        </Link>{" "}
                        after save to verify
                      </li>
                    </ul>
                  </dd>
                </div>
              </ProductFormOrderCard>

              <ProductFormOrderCard
                icon={<LinkIcon className="h-4 w-4" />}
                title="Live preview"
                subtitle="How links will appear on the storefront"
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Header</dt>
                  <dd>
                    <div className="flex flex-wrap gap-2">
                      {headerLinks
                        .filter((item) => item.label.trim())
                        .map((item) => (
                          <span
                            key={item.id}
                            className="rounded-full border border-border/60 bg-elevated px-3 py-1 text-xs font-medium text-foreground"
                          >
                            {item.label.trim()}
                          </span>
                        ))}
                    </div>
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Others</dt>
                  <dd>
                    <div className="flex flex-wrap gap-2">
                      {othersLinks.filter((item) => item.label.trim()).length > 0 ? (
                        othersLinks
                          .filter((item) => item.label.trim())
                          .map((item) => (
                            <span
                              key={item.id}
                              className="rounded-full border border-border/60 bg-elevated px-3 py-1 text-xs font-medium text-foreground"
                            >
                              {item.label.trim()}
                            </span>
                          ))
                      ) : (
                        <span className="text-xs text-subtle">Hidden (no links)</span>
                      )}
                    </div>
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Footer</dt>
                  <dd>
                    <div className="space-y-3">
                      {footerColumns
                        .filter((column) => column.title.trim())
                        .map((column) => (
                          <div key={column.id}>
                            <p className="text-xs font-semibold text-brand">
                              {column.title.trim()}
                            </p>
                            <ul className="mt-1 space-y-1">
                              {column.items
                                .filter((item) => item.label.trim())
                                .map((item) => (
                                  <li key={item.id} className="text-xs text-foreground-muted">
                                    {item.label.trim()}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ))}
                    </div>
                  </dd>
                </div>
              </ProductFormOrderCard>
            </>
          }
        />
      </form>
    </AdminPageLayout>
  );
}
