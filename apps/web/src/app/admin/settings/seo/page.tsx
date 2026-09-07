"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AdminSeoSerpPreview } from "@/components/admin/AdminSeoSerpPreview";
import {
  CheckIcon,
  LayersIcon,
  PulseIcon,
  SearchIcon,
  ShieldIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  getRobotsState,
  getSeoAnalyzer,
  getSeoSettings,
  getSitemapStatus,
  regenerateSitemap,
  saveRobots,
  updateSeoSettings,
  validateRobots,
  type RobotsState,
  type RobotsValidation,
  type SeoAnalyzerReport,
  type SeoSettings,
  type SitemapStatus,
  type StaticPageSeoEntry,
} from "@/lib/api";
import {
  HOMEPAGE_SEO_PATH,
  mergeStaticPages,
} from "@/lib/static-page-seo";

type TabId =
  | "global"
  | "pages"
  | "social"
  | "schema"
  | "sitemap"
  | "robots"
  | "analyzer";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "global", label: "Global" },
  { id: "pages", label: "Pages" },
  { id: "social", label: "Social" },
  { id: "schema", label: "Schema" },
  { id: "sitemap", label: "Sitemap" },
  { id: "robots", label: "Robots.txt" },
  { id: "analyzer", label: "Analyzer" },
];

const EDITABLE_TABS = new Set<TabId>([
  "global",
  "pages",
  "social",
  "schema",
]);

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type SeoStatTone = "brand" | "success" | "amber" | "muted";

type SeoOverviewStat = {
  key: string;
  tone: SeoStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function SeoOverviewStats({ items }: { items: SeoOverviewStat[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-seo-overview"
      aria-label="SEO overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-seo-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-seo-overview-stat-icon admin-seo-overview-stat-icon--${item.tone}`}
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

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function buildSitemapPreviewUrl(canonicalDomain?: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const canonical = (canonicalDomain ?? "").replace(/\/$/, "");
  if (site) return `${site}/sitemap.xml`;
  if (canonical) return `${canonical}/sitemap.xml`;
  return "";
}

function resolveSitemapStatus(
  settings: SeoSettings | null,
  remote: SitemapStatus | null,
): SitemapStatus | null {
  const previewUrl = buildSitemapPreviewUrl(settings?.global.canonicalDomain);
  if (remote) {
    return {
      ...remote,
      sitemapUrl: remote.sitemapUrl || previewUrl,
    };
  }
  if (!settings) return null;
  return {
    lastGeneratedAt: settings.sitemap.lastGeneratedAt ?? null,
    urlCount: settings.sitemap.urlCount ?? 0,
    status: settings.sitemap.status ?? "idle",
    sitemapUrl: previewUrl,
  };
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}

function countSchemaTypes(schema: SeoSettings["schema"]) {
  return [schema.organization, schema.website, schema.product, schema.faq].filter(
    Boolean,
  ).length;
}

function csv(arr: string[]) {
  return arr.join(", ");
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type TabProps = {
  settings: SeoSettings;
  patch: (updater: (s: SeoSettings) => SeoSettings) => void;
};

const Field = memo(function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-subtle">{hint}</p> : null}
    </div>
  );
});

const SeoToggle = memo(function SeoToggle({
  label,
  hint,
  checked,
  onChange,
  compact,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={`admin-seo-toggle${compact ? " admin-seo-toggle--compact" : ""}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-foreground-muted">{hint}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full ${
          checked ? "bg-teal-500" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
});

const SerpPreview = memo(function SerpPreview({
  title,
  description,
  url,
  ogImage,
}: {
  title: string;
  description: string;
  url: string;
  ogImage?: string;
}) {
  const host = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="space-y-3">
      <AdminSeoSerpPreview
        url={host || "uniqbd.com"}
        title={title || "Page title"}
        description={description}
        label="Google preview"
      />
      {ogImage ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Social card
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ogImage}
            alt="OG preview"
            className="mt-2 aspect-[1.91/1] w-full rounded-lg object-cover"
          />
        </div>
      ) : null}
    </div>
  );
});

const GlobalTab = memo(function GlobalTab({ settings, patch }: TabProps) {
  const g = settings.global;
  const set = <K extends keyof SeoSettings["global"]>(
    key: K,
    value: SeoSettings["global"][K],
  ) => patch((s) => ({ ...s, global: { ...s.global, [key]: value } }));

  return (
    <ProductFormOrderCard
      icon={<SearchIcon className="h-4 w-4" />}
      title="Global SEO"
      subtitle="Default site title, description, indexing rules, and analytics IDs."
      className="admin-product-form-section admin-seo-section"
    >
        <div className="admin-seo-section-body space-y-4">
          <Field label="Website title">
            <input
              value={g.siteTitle}
              onChange={(e) => set("siteTitle", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field
            label="Website description"
            hint={`${g.siteDescription.length} chars (aim ≤ 160)`}
          >
            <textarea
              rows={3}
              value={g.siteDescription}
              onChange={(e) => set("siteDescription", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Keywords" hint="Comma separated">
            <input
              value={csv(g.keywords)}
              onChange={(e) => set("keywords", parseCsv(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Canonical domain" hint="e.g. https://uniqbd.com">
            <input
              value={g.canonicalDomain}
              onChange={(e) => set("canonicalDomain", e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="admin-seo-form-grid">
            <SeoToggle
              label="Allow indexing"
              hint="Sets index directive for the storefront"
              checked={g.robotsIndex}
              onChange={(v) => set("robotsIndex", v)}
              compact
            />
            <SeoToggle
              label="Follow links"
              hint="Sets follow directive for crawlers"
              checked={g.robotsFollow}
              onChange={(v) => set("robotsFollow", v)}
              compact
            />
          </div>
          <div className="admin-seo-inset space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
              Verification &amp; analytics
            </p>
            <div className="admin-seo-form-grid">
              <Field
                label="Google verification code"
                hint="Paste the code only or the full <meta> tag — both work"
              >
                <input
                  value={g.googleVerification}
                  onChange={(e) => set("googleVerification", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field
                label="Bing verification code"
                hint="Paste the code only or the full <meta> tag — both work"
              >
                <input
                  value={g.bingVerification}
                  onChange={(e) => set("bingVerification", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Google Analytics ID" hint="G-XXXXXXX">
                <input
                  value={g.googleAnalyticsId}
                  onChange={(e) => set("googleAnalyticsId", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Google Tag Manager ID" hint="GTM-XXXXXX">
                <input
                  value={g.gtmId}
                  onChange={(e) => set("gtmId", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Facebook Pixel ID">
                <input
                  value={g.facebookPixelId}
                  onChange={(e) => set("facebookPixelId", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </div>
      </ProductFormOrderCard>
  );
});

const PagesTab = memo(function PagesTab({
  settings,
  patch,
  selectedPath,
  onSelectPath,
}: TabProps & {
  selectedPath: string;
  onSelectPath: (path: string) => void;
}) {
  const pages = settings.staticPages;
  const isHomepage = selectedPath === HOMEPAGE_SEO_PATH;
  const activeIndex = pages.findIndex((page) => page.path === selectedPath);
  const active = !isHomepage && activeIndex >= 0 ? pages[activeIndex] : null;
  const homepage = settings.homepage;

  const setHomepage = <K extends keyof SeoSettings["homepage"]>(
    key: K,
    value: SeoSettings["homepage"][K],
  ) => {
    patch((state) => ({
      ...state,
      homepage: { ...state.homepage, [key]: value },
    }));
  };

  const setPage = <K extends keyof StaticPageSeoEntry>(
    key: K,
    value: StaticPageSeoEntry[K],
  ) => {
    if (activeIndex < 0) return;
    patch((state) => ({
      ...state,
      staticPages: state.staticPages.map((page, index) =>
        index === activeIndex ? { ...page, [key]: value } : page,
      ),
    }));
  };

  return (
    <div className="space-y-5">
      <ProductFormOrderCard
        icon={<LayersIcon className="h-4 w-4" />}
        title="Static pages"
        subtitle="Manage SEO for marketing and storefront pages"
        className="admin-product-form-section admin-seo-section"
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectPath(HOMEPAGE_SEO_PATH)}
            className={`dashboard-pro-quick-link${
              isHomepage ? " ring-1 ring-brand/50" : ""
            }`}
          >
            Homepage
          </button>
          {pages.map((page) => (
            <button
              key={page.path}
              type="button"
              onClick={() => onSelectPath(page.path)}
              className={`dashboard-pro-quick-link${
                page.path === selectedPath ? " ring-1 ring-brand/50" : ""
              }`}
            >
              {page.label}
            </button>
          ))}
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        icon={<SearchIcon className="h-4 w-4" />}
        title={isHomepage ? "Homepage SEO" : `${active?.label ?? "Page"} SEO`}
        subtitle={isHomepage ? HOMEPAGE_SEO_PATH : (active?.path ?? "")}
        className="admin-product-form-section admin-seo-section"
      >
        <div className="admin-seo-section-body space-y-4">
          {isHomepage ? (
            <>
              <Field label="SEO title">
                <input
                  value={homepage.title}
                  onChange={(e) => setHomepage("title", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Meta description">
                <textarea
                  rows={3}
                  value={homepage.description}
                  onChange={(e) => setHomepage("description", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Keywords" hint="Comma separated">
                <input
                  value={csv(homepage.keywords)}
                  onChange={(e) => setHomepage("keywords", parseCsv(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <div className="admin-seo-form-grid">
                <Field label="Open Graph title">
                  <input
                    value={homepage.ogTitle}
                    onChange={(e) => setHomepage("ogTitle", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Open Graph image URL">
                  <input
                    value={homepage.ogImage}
                    onChange={(e) => setHomepage("ogImage", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Open Graph description">
                <textarea
                  rows={2}
                  value={homepage.ogDescription}
                  onChange={(e) => setHomepage("ogDescription", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </>
          ) : active ? (
            <>
              <Field label="SEO title">
                <input
                  value={active.title}
                  onChange={(e) => setPage("title", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Meta description">
                <textarea
                  rows={3}
                  value={active.description}
                  onChange={(e) => setPage("description", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Keywords" hint="Comma separated">
                <input
                  value={csv(active.keywords)}
                  onChange={(e) => setPage("keywords", parseCsv(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <div className="admin-seo-form-grid">
                <Field label="Open Graph title">
                  <input
                    value={active.ogTitle}
                    onChange={(e) => setPage("ogTitle", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Open Graph image URL">
                  <input
                    value={active.ogImage}
                    onChange={(e) => setPage("ogImage", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Open Graph description">
                <textarea
                  rows={2}
                  value={active.ogDescription}
                  onChange={(e) => setPage("ogDescription", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <SeoToggle
                label="No index"
                hint="Hide this page from search engines"
                checked={active.noIndex}
                onChange={(value) => setPage("noIndex", value)}
              />
            </>
          ) : (
            <p className="text-sm text-subtle">Select a page to edit its SEO.</p>
          )}
        </div>
      </ProductFormOrderCard>
    </div>
  );
});

const SocialTab = memo(function SocialTab({ settings, patch }: TabProps) {
  const s = settings.social;
  const set = <K extends keyof SeoSettings["social"]>(
    key: K,
    value: SeoSettings["social"][K],
  ) => patch((st) => ({ ...st, social: { ...st.social, [key]: value } }));

  const fields: Array<[keyof SeoSettings["social"], string]> = [
    ["facebook", "Facebook URL"],
    ["instagram", "Instagram URL"],
    ["youtube", "YouTube URL"],
    ["twitter", "Twitter / X URL"],
    ["discord", "Discord URL"],
  ];

  return (
    <ProductFormOrderCard
      icon={<PulseIcon className="h-4 w-4" />}
      title="Social profiles"
      subtitle="Used in Organization schema sameAs links for richer search results."
      className="admin-product-form-section admin-seo-section"
    >
      <div className="admin-seo-section-body space-y-4">
        {fields.map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              value={s[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder="https://"
              className={inputCls}
            />
          </Field>
        ))}
      </div>
    </ProductFormOrderCard>
  );
});

const SchemaTab = memo(function SchemaTab({ settings, patch }: TabProps) {
  const sc = settings.schema;
  const set = <K extends keyof SeoSettings["schema"]>(
    key: K,
    value: SeoSettings["schema"][K],
  ) => patch((s) => ({ ...s, schema: { ...s.schema, [key]: value } }));

  const setFaq = (i: number, field: "question" | "answer", value: string) =>
    patch((s) => ({
      ...s,
      schema: {
        ...s.schema,
        faqItems: s.schema.faqItems.map((f, idx) =>
          idx === i ? { ...f, [field]: value } : f,
        ),
      },
    }));

  const addFaq = () =>
    patch((s) => ({
      ...s,
      schema: {
        ...s.schema,
        faqItems: [...s.schema.faqItems, { question: "", answer: "" }],
      },
    }));

  const removeFaq = (i: number) =>
    patch((s) => ({
      ...s,
      schema: {
        ...s.schema,
        faqItems: s.schema.faqItems.filter((_, idx) => idx !== i),
      },
    }));

  return (
    <ProductFormOrderCard
      icon={<ShieldIcon className="h-4 w-4" />}
      title="Structured data"
      subtitle="JSON-LD schema toggles and optional FAQ entries."
      className="admin-product-form-section admin-seo-section"
    >
      <div className="admin-seo-section-body space-y-4">
        <div className="admin-seo-form-grid">
          <SeoToggle
            label="Organization schema"
            checked={sc.organization}
            onChange={(v) => set("organization", v)}
            compact
          />
          <SeoToggle
            label="Website schema"
            hint="Includes sitelinks search box"
            checked={sc.website}
            onChange={(v) => set("website", v)}
            compact
          />
          <SeoToggle
            label="Product schema"
            checked={sc.product}
            onChange={(v) => set("product", v)}
            compact
          />
          <SeoToggle
            label="FAQ schema"
            checked={sc.faq}
            onChange={(v) => set("faq", v)}
            compact
          />
        </div>

        {sc.faq ? (
          <div className="admin-seo-inset space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground">FAQ items</h4>
              <button
                type="button"
                onClick={addFaq}
                className="dashboard-pro-btn-ghost text-xs"
              >
                + Add item
              </button>
            </div>
            {sc.faqItems.length === 0 ? (
              <p className="text-xs text-subtle">No FAQ items yet.</p>
            ) : (
              sc.faqItems.map((f, i) => (
                <div
                  key={`faq-${i}-${f.question.slice(0, 12)}`}
                  className="space-y-2 border-t border-border/40 pt-3 first:border-t-0 first:pt-0"
                >
                  <input
                    value={f.question}
                    onChange={(e) => setFaq(i, "question", e.target.value)}
                    placeholder="Question"
                    className={inputCls}
                  />
                  <textarea
                    rows={2}
                    value={f.answer}
                    onChange={(e) => setFaq(i, "answer", e.target.value)}
                    placeholder="Answer"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => removeFaq(i)}
                    className="text-xs text-rose-300 hover:text-rose-200"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}

        <SeoToggle
          label="Auto-generate product SEO"
          hint="Build meta title and description from product name and summary"
          checked={settings.autoGenerateProductSeo}
          onChange={(v) => patch((s) => ({ ...s, autoGenerateProductSeo: v }))}
        />
      </div>
    </ProductFormOrderCard>
  );
});

const SitemapTab = memo(function SitemapTab({
  status,
  canonicalUrl,
  onStatusChange,
  onToast,
  onRefresh,
  refreshing,
}: {
  status: SitemapStatus | null;
  canonicalUrl?: string;
  onStatusChange: (next: SitemapStatus) => void;
  onToast: (msg: string, error?: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const regen = useCallback(async () => {
    setBusy(true);
    try {
      const next = await regenerateSitemap();
      onStatusChange(next);
      onToast("Sitemap regenerated.");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Regenerate failed.", true);
    } finally {
      setBusy(false);
    }
  }, [onStatusChange, onToast]);

  const canonical = (canonicalUrl ?? "").replace(/\/$/, "");
  const previewUrl = status?.sitemapUrl ?? "";
  const showCanonicalLink =
    Boolean(canonical) &&
    Boolean(previewUrl) &&
    !previewUrl.startsWith(`${canonical}/sitemap.xml`);

  return (
    <ProductFormOrderCard
      icon={<LayersIcon className="h-4 w-4" />}
      title="XML sitemap"
      subtitle="Public sitemap for search engines and storefront discovery."
      className="admin-product-form-section admin-seo-section"
    >
      <div className="admin-seo-section-body space-y-4">
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Status</dt>
          <dd className="capitalize text-sm font-medium text-foreground">
            {refreshing ? "Refreshing…" : (status?.status ?? "—")}
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>URLs</dt>
          <dd className="text-sm font-medium text-foreground">
            {refreshing ? "…" : status ? status.urlCount.toLocaleString() : "—"}
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Last generated</dt>
          <dd className="text-sm text-foreground-muted">
            {formatDate(status?.lastGeneratedAt)}
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Sitemap URL</dt>
          <dd className="space-y-2">
            {previewUrl ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-teal-300 hover:underline"
              >
                {previewUrl}
              </a>
            ) : (
              <span className="text-sm text-foreground-muted">
                Set a canonical domain in Global settings to show the public URL.
              </span>
            )}
            {showCanonicalLink ? (
              <a
                href={`${canonical}/sitemap.xml`}
                target="_blank"
                rel="noreferrer"
                className="block break-all font-mono text-xs text-foreground-muted hover:text-teal-300 hover:underline"
              >
                Production: {canonical}/sitemap.xml
              </a>
            ) : null}
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Actions</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void regen()}
                disabled={busy || refreshing}
                className="btn-primary disabled:opacity-50"
              >
                {busy ? "Regenerating…" : "Regenerate sitemap"}
              </button>
              <button
                type="button"
                onClick={onRefresh}
                disabled={busy || refreshing}
                className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
              >
                {refreshing ? "Refreshing…" : "Refresh stats"}
              </button>
            </div>
            <p className="mt-2 text-xs text-foreground-muted">
              URL count is computed live from products, categories, brands, blog
              posts, and static pages. Regenerate records a fresh timestamp for the
              dashboard.
            </p>
          </dd>
        </div>
      </div>
    </ProductFormOrderCard>
  );
});

const RobotsTab = memo(function RobotsTab({
  onToast,
}: {
  onToast: (msg: string, error?: boolean) => void;
}) {
  const [state, setState] = useState<RobotsState | null>(null);
  const [content, setContent] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [validation, setValidation] = useState<RobotsValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const contentRef = useRef(content);
  const useCustomRef = useRef(useCustom);
  const onToastRef = useRef(onToast);
  contentRef.current = content;
  useCustomRef.current = useCustom;
  onToastRef.current = onToast;

  const loadRobots = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await getRobotsState();
      setState(s);
      setUseCustom(s.useCustom);
      setContent(s.content || s.generated);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load robots.txt.";
      setLoadError(msg);
      onToastRef.current(msg, true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRobots();
  }, [loadRobots]);

  const onValidate = useCallback(async () => {
    try {
      setValidation(await validateRobots(contentRef.current));
    } catch {
      onToastRef.current("Validation failed.", true);
    }
  }, []);

  const onPublish = useCallback(async () => {
    setBusy(true);
    try {
      const res = await saveRobots(contentRef.current, useCustomRef.current);
      setValidation(res.validation);
      onToastRef.current(
        res.validation.valid
          ? "robots.txt saved and published."
          : "Saved, but validation found errors.",
        !res.validation.valid,
      );
    } catch (err) {
      onToastRef.current(
        err instanceof Error ? err.message : "Save failed.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }, []);

  if (loading) {
    return (
      <ProductFormOrderCard
        title="robots.txt editor"
        subtitle="Loading robots.txt…"
        className="admin-seo-empty text-center text-sm text-subtle"
      >
        Loading robots.txt…
      </ProductFormOrderCard>
    );
  }

  if (loadError && !state) {
    return (
      <ProductFormOrderCard
        title="robots.txt editor"
        subtitle="Could not load robots.txt"
        className="admin-seo-empty space-y-3 text-center text-sm text-subtle"
      >
        <p className="text-rose-300">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadRobots()}
          className="dashboard-pro-btn-ghost text-xs"
        >
          Retry
        </button>
      </ProductFormOrderCard>
    );
  }

  return (
    <ProductFormOrderCard
      icon={<ShieldIcon className="h-4 w-4" />}
      title="robots.txt editor"
      subtitle="Serve custom rules or fall back to auto-generated defaults."
      className="admin-product-form-section admin-seo-section"
    >
      <div className="admin-seo-section-body space-y-4">
        <SeoToggle
          label="Serve custom robots.txt"
          checked={useCustom}
          onChange={setUseCustom}
        />
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Rules</dt>
          <dd className="admin-product-form-sidebar-fields">
            <textarea
              rows={16}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
            />
          </dd>
        </div>
        {validation ? (
          <div className="space-y-1 text-xs">
            {validation.errors.map((e, i) => (
              <p key={`err-${i}`} className="text-rose-300">
                ✗ {e}
              </p>
            ))}
            {validation.warnings.map((w, i) => (
              <p key={`warn-${i}`} className="text-amber-300">
                ⚠ {w}
              </p>
            ))}
            {validation.valid && validation.warnings.length === 0 ? (
              <p className="text-emerald-300">✓ Valid robots.txt</p>
            ) : null}
          </div>
        ) : null}
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Actions</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onPublish()}
                disabled={busy}
                className="btn-primary disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save & publish"}
              </button>
              <button
                type="button"
                onClick={() => void onValidate()}
                className="dashboard-pro-btn-ghost text-xs"
              >
                Validate
              </button>
              {state ? (
                <button
                  type="button"
                  onClick={() => setContent(state.generated)}
                  className="dashboard-pro-btn-ghost text-xs"
                >
                  Load generated
                </button>
              ) : null}
            </div>
          </dd>
        </div>
      </div>
    </ProductFormOrderCard>
  );
});

const IssueCard = memo(function IssueCard({
  title,
  count,
  samples,
}: {
  title: string;
  count: number;
  samples: string[];
}) {
  const ok = count === 0;
  return (
    <div className="dashboard-pro-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <span
          className={`dashboard-pro-status${
            ok ? " dashboard-pro-status--green" : " dashboard-pro-status--amber"
          }`}
        >
          {count}
        </span>
      </div>
      {!ok && samples.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-foreground-muted">
          {samples.slice(0, 5).map((s, i) => (
            <li key={`${title}-${i}-${s.slice(0, 24)}`} className="truncate">
              · {s}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});

const AnalyzerTab = memo(function AnalyzerTab({
  report,
  busy,
  error,
  onRun,
}: {
  report: SeoAnalyzerReport | null;
  busy: boolean;
  error: string | null;
  onRun: () => void;
}) {
  const issueCards = useMemo(
    () =>
      report
        ? ANALYZER_ISSUES.map(({ key, title, samples }) => ({
            key,
            title,
            count: report.issues[key].count,
            samples: samples(report),
          }))
        : [],
    [report],
  );

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Health score</dt>
        <dd>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="dashboard-pro-card flex h-24 w-24 flex-col items-center justify-center p-2">
                <span
                  className={`text-3xl font-bold ${
                    report ? scoreTone(report.score) : "text-subtle"
                  }`}
                >
                  {busy && !report ? "…" : report ? report.score : "—"}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-subtle">
                  Health
                </span>
              </div>
              {report ? (
                <p className="text-xs text-foreground-muted">
                  Scanned {report.totals.products} products · {report.totals.categories}{" "}
                  categories · {report.totals.brands} brands
                  <br />
                  Last run {formatDate(report.generatedAt)}
                </p>
              ) : (
                <p className="text-xs text-foreground-muted">
                  {busy
                    ? "Scanning products, categories, and brands…"
                    : "Run an audit to score catalog SEO coverage."}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onRun}
              disabled={busy}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? "Analyzing…" : report ? "Re-run analysis" : "Run analysis"}
            </button>
          </div>
        </dd>
      </div>

      {issueCards.length > 0 ? (
        <div className="admin-seo-issue-grid">
          {issueCards.map((issue) => (
            <IssueCard
              key={issue.key}
              title={issue.title}
              count={issue.count}
              samples={issue.samples}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});

const ANALYZER_ISSUES: Array<{
  key: keyof SeoAnalyzerReport["issues"];
  title: string;
  samples: (report: SeoAnalyzerReport) => string[];
}> = [
  {
    key: "missingMetaTitle",
    title: "Missing meta titles",
    samples: (report) =>
      report.issues.missingMetaTitle.samples.map((s) => s.title || s.slug),
  },
  {
    key: "missingMetaDescription",
    title: "Missing meta descriptions",
    samples: (report) =>
      report.issues.missingMetaDescription.samples.map((s) => s.title || s.slug),
  },
  {
    key: "missingCanonical",
    title: "Missing canonical URLs",
    samples: (report) =>
      report.issues.missingCanonical.samples.map((s) => s.title || s.slug),
  },
  {
    key: "missingAltTags",
    title: "Missing image alt tags",
    samples: (report) =>
      report.issues.missingAltTags.samples.map((s) => s.title || s.slug),
  },
  {
    key: "duplicateTitles",
    title: "Duplicate titles",
    samples: (report) =>
      report.issues.duplicateTitles.groups.map((g) => `${g.value} (×${g.count})`),
  },
  {
    key: "duplicateDescriptions",
    title: "Duplicate descriptions",
    samples: (report) =>
      report.issues.duplicateDescriptions.groups.map(
        (g) => `${g.value} (×${g.count})`,
      ),
  },
];

export default function AdminSeoPage() {
  const [tab, setTab] = useState<TabId>("global");
  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [analyzer, setAnalyzer] = useState<SeoAnalyzerReport | null>(null);
  const [sitemap, setSitemap] = useState<SitemapStatus | null>(null);
  const [sitemapRefreshing, setSitemapRefreshing] = useState(false);
  const [sitemapError, setSitemapError] = useState<string | null>(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzerBusy, setAnalyzerBusy] = useState(false);
  const [analyzerError, setAnalyzerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStaticPagePath, setSelectedStaticPagePath] = useState(
    HOMEPAGE_SEO_PATH,
  );

  const refreshBusyRef = useRef(false);
  const analyzerPrimedRef = useRef(false);

  const loadAnalyzer = useCallback(async (silent = false) => {
    setAnalyzerBusy(true);
    if (!silent) setAnalyzerError(null);
    try {
      const report = await getSeoAnalyzer();
      setAnalyzer(report);
      setAnalyzerError(null);
      if (!silent) {
        adminToast("SEO analysis complete.", true);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Analyzer failed.";
      setAnalyzerError(message);
      if (!silent) {
        adminToast(message, false);
      }
    } finally {
      setAnalyzerBusy(false);
    }
  }, []);

  const loadSitemap = useCallback(async (silent = false) => {
    if (!silent) setSitemapRefreshing(true);
    try {
      const sitemapData = await getSitemapStatus();
      setSitemap(sitemapData);
      setSitemapError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load sitemap status.";
      setSitemapError(message);
      if (!silent) {
        adminToast(message, false);
      }
    } finally {
      if (!silent) setSitemapRefreshing(false);
    }
  }, []);

  const loadCore = useCallback(async (silent = false, withAnalyzer = false) => {
    if (silent) {
      if (refreshBusyRef.current) return;
      refreshBusyRef.current = true;
      setRefreshing(true);
    } else {
      setCoreLoading(true);
      setLoadError(null);
    }
    try {
      const settingsData = await getSeoSettings();
      setSettings({
        ...settingsData,
        staticPages: mergeStaticPages(settingsData.staticPages),
      });
      await loadSitemap(true);
      if (withAnalyzer) await loadAnalyzer(true);
    } catch (err) {
      if (!silent) {
        setSettings(null);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load SEO settings.",
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
  }, [loadAnalyzer, loadSitemap]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (!settings || analyzerPrimedRef.current) return;
    analyzerPrimedRef.current = true;
    void loadAnalyzer(true);
  }, [settings, loadAnalyzer]);

  useEffect(() => {
    if (tab !== "analyzer" || analyzer || analyzerBusy) return;
    void loadAnalyzer(true);
  }, [tab, analyzer, analyzerBusy, loadAnalyzer]);

  useEffect(() => {
    if (tab !== "sitemap") return;
    void loadSitemap(true);
  }, [tab, loadSitemap]);

  const patch = useCallback((updater: (s: SeoSettings) => SeoSettings) => {
    setSettings((s) => (s ? updater(s) : s));
  }, []);

  const onSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    hideAdminToast();
    try {
      const saved = await updateSeoSettings({
        global: settings.global,
        homepage: settings.homepage,
        staticPages: settings.staticPages,
        social: settings.social,
        schema: settings.schema,
        autoGenerateProductSeo: settings.autoGenerateProductSeo,
      });
      setSettings({
        ...saved,
        staticPages: mergeStaticPages(saved.staticPages),
      });
      adminToast("SEO settings saved.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed.", false);
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const showToast = useCallback((msg: string, error = false) => {
    adminToast(msg, !error);
  }, []);

  const runAnalyzer = useCallback(async () => {
    await loadAnalyzer(false);
  }, [loadAnalyzer]);

  const statsPending = coreLoading && !settings;
  const effectiveSitemap = useMemo(
    () => resolveSitemapStatus(settings, sitemap),
    [settings, sitemap],
  );
  const schemaCount = settings ? countSchemaTypes(settings.schema) : 0;
  const urlCount = effectiveSitemap?.urlCount ?? 0;
  const healthScore = analyzer
    ? String(analyzer.score)
    : analyzerBusy
      ? "…"
      : "—";
  const indexLabel = settings?.global.robotsIndex ? "Allowed" : "Blocked";

  const seoOverviewStats = useMemo<SeoOverviewStat[]>(() => {
    const score = analyzer?.score;
    const healthTone: SeoStatTone =
      score === undefined
        ? "muted"
        : score >= 80
          ? "success"
          : score >= 50
            ? "amber"
            : "amber";

    return [
      {
        key: "health",
        tone: healthTone,
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Health score",
        value: loadingStat(statsPending, healthScore),
        meta: "Catalog SEO audit",
      },
      {
        key: "indexing",
        tone: settings?.global.robotsIndex ? "success" : "amber",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Indexing",
        value: loadingStat(statsPending, indexLabel),
        meta: statsPending
          ? "…"
          : settings?.global.robotsFollow
            ? "Follow enabled"
            : "No follow",
      },
      {
        key: "sitemap",
        tone: "brand",
        icon: <LayersIcon className="h-4 w-4" />,
        label: "Sitemap URLs",
        value: loadingStat(statsPending, urlCount.toLocaleString()),
        meta: statsPending
          ? "…"
          : effectiveSitemap?.status ?? "—",
      },
      {
        key: "schema",
        tone: schemaCount >= 4 ? "success" : schemaCount > 0 ? "brand" : "muted",
        icon: <ZapIcon className="h-4 w-4" />,
        label: "Schema",
        value: loadingStat(statsPending, `${schemaCount}/4`),
        meta: statsPending
          ? "…"
          : settings?.autoGenerateProductSeo
            ? "Auto product SEO on"
            : "Manual product SEO",
      },
    ];
  }, [
    analyzer?.score,
    effectiveSitemap?.status,
    healthScore,
    indexLabel,
    schemaCount,
    settings,
    statsPending,
    urlCount,
  ]);

  const sidebarIssueCount = useMemo(() => {
    if (analyzerBusy && !analyzer) return "…";
    if (!analyzer) return "—";
    return (
      analyzer.issues.missingMetaTitle.count +
      analyzer.issues.missingMetaDescription.count +
      analyzer.issues.missingCanonical.count
    ).toLocaleString();
  }, [analyzer, analyzerBusy]);

  const openAnalyzerTab = useCallback(() => {
    setTab("analyzer");
  }, []);

  const serpPreview = useMemo(() => {
    if (!settings) return null;
    if (tab === "pages") {
      if (selectedStaticPagePath === HOMEPAGE_SEO_PATH) {
        return {
          title: settings.homepage.title || settings.global.siteTitle,
          description:
            settings.homepage.description || settings.global.siteDescription,
          url: settings.global.canonicalDomain,
          ogImage: settings.homepage.ogImage || undefined,
        };
      }
      const page = settings.staticPages.find(
        (item) => item.path === selectedStaticPagePath,
      );
      if (page) {
        const base = settings.global.canonicalDomain.replace(/\/$/, "");
        return {
          title: page.title || settings.global.siteTitle,
          description: page.description || settings.global.siteDescription,
          url: `${base}${page.path.startsWith("/") ? page.path : `/${page.path}`}`,
          ogImage: page.ogImage || undefined,
        };
      }
    }
    return {
      title: settings.global.siteTitle,
      description: settings.global.siteDescription,
      url: settings.global.canonicalDomain,
      ogImage: tab === "global" ? undefined : settings.homepage.ogImage || undefined,
    };
  }, [settings, tab, selectedStaticPagePath]);

  return (
    <AdminPageLayout
      section="Settings"
      title="SEO Management"
      description="Global meta, static pages, schema, sitemap, robots.txt, and catalog analyzer."
      icon={SearchIcon}
      backHref="/admin/settings"
      backLabel="General"
      action={
        statsPending ? null : settings?.global.robotsIndex &&
          settings.global.canonicalDomain ? (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            Indexable
          </span>
        ) : (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            Review setup
          </span>
        )
      }
    >

      {loadError && !settings ? (
        <ProductFormOrderCard
          title="Could not load SEO settings"
          subtitle={loadError}
          className="admin-seo-empty space-y-3"
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
          <AdminOrderTwoColumnLayout
            main={
              <>
                <AdminOrderListCard
                  icon={<SearchIcon className="h-4 w-4" />}
                  title="SEO overview"
                  subtitle={
                    statsPending
                      ? "Loading SEO settings…"
                      : `Health ${healthScore} · ${indexLabel} · ${urlCount.toLocaleString()} sitemap URLs`
                  }
                  className="admin-seo-catalog"
                >
                  <SeoOverviewStats items={seoOverviewStats} />

                  <div className="admin-seo-summary flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                    <span>
                      <span className="font-semibold text-foreground">Domain</span>{" "}
                      {statsPending
                        ? "…"
                        : settings?.global.canonicalDomain || "Not set"}
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">Updated</span>{" "}
                      {statsPending ? "…" : formatDate(settings?.updatedAt)}
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">Sitemap</span>{" "}
                      {statsPending ? "…" : formatDate(effectiveSitemap?.lastGeneratedAt)}
                    </span>
                    {sitemapError ? (
                      <span className="text-amber-300">{sitemapError}</span>
                    ) : null}
                    <span>
                      <span className="font-semibold text-foreground">Issues</span>{" "}
                      {sidebarIssueCount}
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => void loadCore(true, true)}
                      disabled={coreLoading || refreshing}
                      className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                    >
                      {refreshing || coreLoading ? "Refreshing…" : "Refresh"}
                    </button>
                    {effectiveSitemap?.sitemapUrl ? (
                      <a
                        href={effectiveSitemap.sitemapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="dashboard-pro-btn-ghost text-xs"
                      >
                        View sitemap
                      </a>
                    ) : null}
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

                <div className="admin-seo-content min-w-0 space-y-5">
                  {settings && tab === "global" ? (
                    <GlobalTab settings={settings} patch={patch} />
                  ) : null}
                  {settings && tab === "pages" ? (
                    <PagesTab
                      settings={settings}
                      patch={patch}
                      selectedPath={selectedStaticPagePath}
                      onSelectPath={setSelectedStaticPagePath}
                    />
                  ) : null}
                  {settings && tab === "social" ? (
                    <SocialTab settings={settings} patch={patch} />
                  ) : null}
                  {settings && tab === "schema" ? (
                    <SchemaTab settings={settings} patch={patch} />
                  ) : null}
                  {tab === "sitemap" ? (
                    <SitemapTab
                      status={effectiveSitemap}
                      canonicalUrl={settings?.global.canonicalDomain}
                      onStatusChange={setSitemap}
                      onToast={showToast}
                      onRefresh={() => void loadSitemap(false)}
                      refreshing={sitemapRefreshing}
                    />
                  ) : null}
                  {tab === "robots" ? <RobotsTab onToast={showToast} /> : null}
                  {tab === "analyzer" ? (
                    <ProductFormOrderCard
                      icon={<PulseIcon className="h-4 w-4" />}
                      title="SEO analyzer"
                      subtitle="Catalog coverage audit and issue breakdown."
                      className="admin-product-form-section admin-seo-analyzer-catalog"
                    >
                      <AnalyzerTab
                        report={analyzer}
                        busy={analyzerBusy}
                        error={analyzerError}
                        onRun={() => void runAnalyzer()}
                      />
                    </ProductFormOrderCard>
                  ) : null}

                  {settings && EDITABLE_TABS.has(tab) ? (
                    <ProductFormOrderCard
                      title="Save SEO settings"
                      subtitle="Changes apply to the storefront after saving."
                      className="admin-product-form-section admin-seo-save"
                    >
                      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                        <dt>Apply changes</dt>
                        <dd className="admin-product-form-sidebar-fields">
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => void onSave()}
                              disabled={saving}
                              className="btn-primary disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save changes"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void loadCore()}
                              disabled={saving || coreLoading}
                              className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                            >
                              Reload
                            </button>
                          </div>
                        </dd>
                      </div>
                    </ProductFormOrderCard>
                  ) : null}
                </div>
              </>
            }
            sidebar={
              <ProductFormOrderCard
                icon={<SearchIcon className="h-4 w-4" />}
                title="SEO guide"
                subtitle="Search pipeline, preview, and best practices."
                className="admin-product-form-section admin-seo-help"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Search pipeline</dt>
                  <dd className="text-sm text-foreground-muted">
                    Admin settings → storefront meta tags → sitemap &amp; robots →
                    search engine crawl.
                  </dd>
                </div>
                {serpPreview ? (
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Preview</dt>
                    <dd>
                      <SerpPreview
                        title={serpPreview.title}
                        description={serpPreview.description}
                        url={serpPreview.url}
                        ogImage={serpPreview.ogImage}
                      />
                    </dd>
                  </div>
                ) : null}
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Analyzer</dt>
                  <dd>
                    <button
                      type="button"
                      onClick={openAnalyzerTab}
                      className="admin-seo-sidebar-analyzer w-full rounded-lg text-left transition hover:opacity-90"
                    >
                      <div className="admin-seo-sidebar-stats grid grid-cols-2 gap-2">
                        <div className="admin-seo-sidebar-stat">
                          <p className="text-[10px] uppercase text-subtle">Issues</p>
                          <p className="mt-1 text-base font-bold text-amber-300">
                            {sidebarIssueCount}
                          </p>
                        </div>
                        <div className="admin-seo-sidebar-stat">
                          <p className="text-[10px] uppercase text-subtle">Health</p>
                          <p className="mt-1 text-base font-bold text-teal-300">
                            {analyzerBusy && !analyzer
                              ? "…"
                              : analyzer
                                ? analyzer.score
                                : "—"}
                          </p>
                        </div>
                      </div>
                      <span className="dashboard-pro-quick-link mt-2 inline-flex text-xs">
                        Open analyzer
                      </span>
                    </button>
                    {analyzerError && !analyzer ? (
                      <p className="mt-2 text-xs text-red-300">{analyzerError}</p>
                    ) : null}
                    {analyzerBusy && !analyzer ? (
                      <p className="mt-2 text-xs text-subtle">Scanning catalog…</p>
                    ) : null}
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Best practices</dt>
                  <dd className="text-sm text-foreground-muted">
                    <ul className="list-inside list-disc space-y-1">
                      <li>Keep meta descriptions under 160 characters.</li>
                      <li>Set a canonical HTTPS domain before going live.</li>
                      <li>Regenerate sitemap after bulk product imports.</li>
                    </ul>
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Related</dt>
                  <dd className="admin-product-form-sidebar-fields">
                    <p className="text-sm text-foreground-muted">
                      Product-level SEO is edited on each product form. Enable
                      auto-generate in the Schema tab for faster catalog coverage.
                    </p>
                    <Link
                      href="/admin/products"
                      prefetch={false}
                      className="dashboard-pro-quick-link mt-3 inline-flex text-xs"
                    >
                      Manage products
                    </Link>
                  </dd>
                </div>
              </ProductFormOrderCard>
            }
          />
        </>
      )}
    </AdminPageLayout>
  );
}
