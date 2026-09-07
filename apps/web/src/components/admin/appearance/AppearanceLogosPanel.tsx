"use client";

import { adminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AppearanceActions } from "@/components/admin/appearance/AppearanceActions";
import { useAppearanceSettings } from "@/components/admin/appearance/AppearanceProvider";
import {
  CheckIcon,
  LayersIcon,
  StoreIcon,
  UserIcon,
} from "@/components/admin/icons";
import { FaviconUploadField } from "@/components/admin/FaviconUploadField";
import { AdminFaviconMark } from "@/components/admin/AdminFaviconMark";
import { LogoUploadField } from "@/components/admin/LogoUploadField";
import { SiteLogo } from "@/components/SiteLogo";
import { headerBgCssVar, unifySiteLogos, type SiteAppearance } from "@/lib/site-appearance";
import { publicAdminFaviconHref } from "@/lib/admin-favicon";
import { applyAdminFavicon } from "@/stores/admin-favicon-store";
import {
  getSsrSafeResolvedTheme,
  resolveTheme,
  type ResolvedTheme,
} from "@/lib/theme";
import { useThemeStore } from "@/stores/theme-store";

type LogoUrlKey = "logoUrlLight" | "logoUrlDark";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function loadingStat(ready: boolean, value: string) {
  return ready ? value : "…";
}

function overviewStatClass(tone: "brand" | "success" | "amber" | "muted") {
  return [
    "customer-dashboard-overview-stat",
    `customer-dashboard-overview-stat--${tone}`,
    "cursor-default",
  ].join(" ");
}

function LogoOverviewStatCopy({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
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

function siteLogoCount(appearance: SiteAppearance) {
  return [appearance.logoUrlLight, appearance.logoUrlDark].filter((v) =>
    v.trim(),
  ).length;
}

function useLiveResolvedTheme(): ResolvedTheme {
  const preference = useThemeStore((s) => s.theme);
  const hydrated = useThemeStore((s) => s.hydrated);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!hydrated || preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTick((n) => n + 1);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, hydrated]);

  if (!hydrated) return getSsrSafeResolvedTheme(preference);
  return resolveTheme(preference);
}

const HeaderLogoPreview = memo(function HeaderLogoPreview({
  appearance,
}: {
  appearance: SiteAppearance;
}) {
  const resolved = useLiveResolvedTheme();
  const isLight = resolved === "light";
  const palette = isLight ? appearance.light : appearance.dark;

  return (
    <div
      data-theme={isLight ? "light" : "dark"}
      className="admin-logos-preview rounded-xl border border-border bg-header p-4 backdrop-blur-md"
      style={{
        ["--header-bg" as string]: headerBgCssVar(palette.bg),
        color: isLight ? "#0f172a" : "#e2e8f0",
        borderColor: palette.muted,
      }}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-70">
        Header preview · {isLight ? "light mode" : "dark mode"}
      </p>
      <SiteLogo
        href={null}
        showWave={false}
        override={{
          logoUrlLight: appearance.logoUrlLight,
          logoUrlDark: appearance.logoUrlDark,
          logoAlt: appearance.logoAlt,
          siteName: appearance.siteName,
        }}
      />
    </div>
  );
});

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

const LogoSlotEditor = memo(function LogoSlotEditor({
  title,
  hint,
  urlKey,
  variant,
  url,
  onUpload,
}: {
  title: string;
  hint: string;
  urlKey: LogoUrlKey;
  variant: "light" | "dark";
  url: string;
  onUpload: (key: LogoUrlKey, url: string) => void;
}) {
  return (
    <div className="admin-logos-slot space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-foreground-muted">{hint}</p>
      </div>
      <LogoUploadField
        label={title.toLowerCase()}
        variant={variant}
        onUploaded={(nextUrl) => onUpload(urlKey, nextUrl)}
      />
      {url.trim() ? (
        <p className="truncate text-[11px] text-subtle" title={url}>
          Active: {url}
        </p>
      ) : (
        <p className="text-[11px] text-subtle">No logo uploaded yet</p>
      )}
    </div>
  );
});

const PlacementPreview = memo(function PlacementPreview({
  id,
  label,
  placement,
  paletteBg,
  paletteBorder,
  fg,
  appearance,
}: {
  id: "light" | "dark";
  label: string;
  placement: "header" | "footer" | "admin";
  paletteBg: string;
  paletteBorder: string;
  fg: string;
  appearance: SiteAppearance;
}) {
  const isFooter = placement === "footer";
  const isAdmin = placement === "admin";

  return (
    <div
      data-theme={id}
      className={`admin-logos-preview rounded-xl border p-4 ${
        isFooter && id === "dark"
          ? "site-footer-logo border-border/60 [&_.text-foreground]:!text-white"
          : isAdmin
            ? "border-border"
            : "border-border bg-header backdrop-blur-md"
      }`}
      style={{
        ...(isAdmin
          ? { backgroundColor: "#0b1120" }
          : isFooter && id === "dark"
            ? { backgroundColor: paletteBg }
            : { ["--header-bg" as string]: headerBgCssVar(paletteBg) }),
        color: fg,
        borderColor: paletteBorder,
      }}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <SiteLogo
        href={null}
        showWave={isFooter}
        size={isAdmin ? "compact" : "default"}
        override={{
          logoUrlLight: appearance.logoUrlLight,
          logoUrlDark: appearance.logoUrlDark,
          logoAlt: appearance.logoAlt,
          siteName: appearance.siteName,
          previewTheme: id,
        }}
      />
    </div>
  );
});

export function AppearanceLogosPanel() {
  const { appearance, setAppearance, ready, saveAppearance } =
    useAppearanceSettings();

  const siteCount = siteLogoCount(appearance);
  const usingTextLogo = siteCount === 0;

  const handleLogoUpload = useCallback(
    async (key: LogoUrlKey, url: string) => {
      const next = unifySiteLogos({ ...appearance, [key]: url });
      try {
        await saveAppearance(next);
        adminToast(
          `${key === "logoUrlLight" ? "Light" : "Dark"} logo saved — header, footer, and admin updated automatically.`,
          true,
        );
      } catch {
        setAppearance(next);
      }
    },
    [appearance, saveAppearance, setAppearance],
  );

  const handleFaviconUpload = useCallback(
    async (url: string) => {
      applyAdminFavicon(url);
      const next = { ...appearance, adminFaviconUrl: url };
      try {
        await saveAppearance(next);
        adminToast("Admin dashboard favicon saved.", true);
      } catch {
        setAppearance(next);
      }
    },
    [appearance, saveAppearance, setAppearance],
  );

  const clearFavicon = useCallback(async () => {
    applyAdminFavicon("");
    const next = { ...appearance, adminFaviconUrl: "" };
    try {
      await saveAppearance(next);
      adminToast("Admin favicon cleared — using default.", true);
    } catch {
      setAppearance(next);
    }
  }, [appearance, saveAppearance, setAppearance]);

  const patchIdentity = useCallback(
    (key: "logoAlt" | "siteName", value: string) => {
      setAppearance((cur) => ({ ...cur, [key]: value }));
    },
    [setAppearance],
  );

  const faviconPreviewSrc = publicAdminFaviconHref(appearance.adminFaviconUrl);

  return (
    <>
      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<StoreIcon className="h-4 w-4" />}
              title="Site logos"
              subtitle={
                ready
                  ? "Upload one light and one dark logo — all placements use these automatically."
                  : "Loading logo settings…"
              }
              className="admin-logos-catalog"
            >
              <section
                className="customer-dashboard-overview-section admin-logos-overview"
                aria-label="Site logo overview"
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
                      <StoreIcon className="h-4 w-4" />
                    </span>
                    <LogoOverviewStatCopy
                      label="Light logo"
                      value={loadingStat(
                        ready,
                        appearance.logoUrlLight.trim() ? "Set" : "Empty",
                      )}
                      meta="Header, footer, admin (light theme)"
                    />
                  </div>

                  <div className={overviewStatClass("muted")}>
                    <span
                      className="customer-dashboard-overview-stat-glow"
                      aria-hidden
                    />
                    <span
                      className="customer-dashboard-overview-stat-icon"
                      aria-hidden
                    >
                      <LayersIcon className="h-4 w-4" />
                    </span>
                    <LogoOverviewStatCopy
                      label="Dark logo"
                      value={loadingStat(
                        ready,
                        appearance.logoUrlDark.trim() ? "Set" : "Empty",
                      )}
                      meta="Header, footer, admin (dark theme)"
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
                      <AdminFaviconMark
                        bare
                        adminFaviconUrl={appearance.adminFaviconUrl}
                        markClassName="h-4 w-4"
                      />
                    </span>
                    <LogoOverviewStatCopy
                      label="Admin favicon"
                      value={loadingStat(
                        ready,
                        appearance.adminFaviconUrl.trim() ? "Set" : "Default",
                      )}
                      meta="Browser tab icon for /admin"
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
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <LogoOverviewStatCopy
                      label="Fallback"
                      value={loadingStat(
                        ready,
                        usingTextLogo ? "Text logo" : "Image",
                      )}
                      meta={usingTextLogo ? "Uses site name" : "PNG / SVG logos"}
                    />
                  </div>
                </div>
              </section>
            </AdminOrderListCard>

            <ProductFormOrderCard
              icon={<StoreIcon className="h-4 w-4" />}
              title="Upload logos"
              subtitle="Only two logos: one for light mode and one for dark mode. Both apply automatically to the site header, footer, and admin panel."
              className="admin-product-form-section admin-logos-section"
            >
              <div className="admin-logos-section-body space-y-5">
                <div className="admin-logos-form-grid">
                  <LogoSlotEditor
                    title="Light mode logo"
                    hint="Used in header, footer, and admin when the site is in light mode."
                    urlKey="logoUrlLight"
                    variant="light"
                    url={appearance.logoUrlLight}
                    onUpload={handleLogoUpload}
                  />
                  <LogoSlotEditor
                    title="Dark mode logo"
                    hint="Used in header, footer, and admin when the site is in dark mode."
                    urlKey="logoUrlDark"
                    variant="dark"
                    url={appearance.logoUrlDark}
                    onUpload={handleLogoUpload}
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
                    Preview (same logos everywhere)
                  </p>
                  <div className="admin-logos-form-grid">
                    <PlacementPreview
                      id="light"
                      label="Light mode · header · footer · admin"
                      placement="header"
                      paletteBg={appearance.light.bg}
                      paletteBorder={appearance.light.muted}
                      fg="#0f172a"
                      appearance={appearance}
                    />
                    <PlacementPreview
                      id="dark"
                      label="Dark mode · header · footer · admin"
                      placement="header"
                      paletteBg={appearance.dark.bg}
                      paletteBorder={appearance.dark.muted}
                      fg="#e2e8f0"
                      appearance={appearance}
                    />
                  </div>
                </div>
              </div>
            </ProductFormOrderCard>

            <ProductFormOrderCard
              icon={
                <AdminFaviconMark
                  adminFaviconUrl={appearance.adminFaviconUrl}
                />
              }
              title="Admin dashboard favicon"
              subtitle="Browser tab icon shown on all /admin pages. The storefront favicon is unchanged."
              className="admin-product-form-section admin-logos-section"
            >
              <div className="admin-logos-section-body space-y-4">
                <div className="admin-logos-slot space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Upload favicon
                      </p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        Upload a 32×32 PNG or an ICO file for the sharpest
                        result. Applies to the admin tab immediately.
                      </p>
                    </div>
                    {appearance.adminFaviconUrl.trim() ? (
                      <button
                        type="button"
                        onClick={() => void clearFavicon()}
                        className="dashboard-pro-btn-ghost shrink-0 px-2 py-1 text-[11px]"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <FaviconUploadField onUploaded={handleFaviconUpload} />
                  {appearance.adminFaviconUrl.trim() ? (
                    <p className="truncate text-[11px] text-subtle" title={appearance.adminFaviconUrl}>
                      Active: {appearance.adminFaviconUrl}
                    </p>
                  ) : (
                    <p className="text-[11px] text-subtle">
                      No custom favicon — using default /icon
                    </p>
                  )}
                </div>
                <div className="admin-logos-preview rounded-xl border border-border bg-elevated p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">
                    Tab preview
                  </p>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={appearance.adminFaviconUrl || "default"}
                      src={faviconPreviewSrc}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded object-contain"
                    />
                    <span className="truncate text-sm text-foreground-muted">
                      Administration Dashboard · Admin
                    </span>
                  </div>
                </div>
              </div>
            </ProductFormOrderCard>

            <ProductFormOrderCard
              icon={<UserIcon className="h-4 w-4" />}
              title="Brand identity"
              subtitle="Accessibility and fallback text when image logos are not configured."
              className="admin-product-form-section admin-logos-section"
            >
              <div className="admin-logos-section-body space-y-4">
                <Field
                  label="Alt text"
                  hint="Used by screen readers and when images fail to load."
                >
                  <input
                    type="text"
                    value={appearance.logoAlt}
                    onChange={(e) => patchIdentity("logoAlt", e.target.value)}
                    placeholder="UniQbd"
                    className={inputCls}
                    maxLength={120}
                  />
                </Field>
                <Field
                  label="Site name (text logo)"
                  hint="First letter stays neutral; the rest uses your brand accent."
                >
                  <input
                    type="text"
                    value={appearance.siteName}
                    onChange={(e) => patchIdentity("siteName", e.target.value)}
                    placeholder="UniQbd"
                    className={inputCls}
                    maxLength={60}
                  />
                </Field>
                <HeaderLogoPreview appearance={appearance} />
              </div>
            </ProductFormOrderCard>

            <AppearanceActions />
          </>
        }
        sidebar={
          <ProductFormOrderCard
            icon={<StoreIcon className="h-4 w-4" />}
            title="Logos guide"
            subtitle="Upload formats, recommendations, and related settings."
            className="admin-product-form-section admin-logos-help"
          >
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Unified logos</dt>
              <dd className="text-sm text-foreground-muted">
                Upload only a light and a dark logo. They automatically appear in
                the storefront header, footer, and admin top bar. Email header logo
                is still configured separately under Email branding.
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Admin favicon</dt>
              <dd className="text-sm text-foreground-muted">
                Upload a separate favicon for the administration dashboard browser
                tab. Storefront visitors still use the default site icon unless
                changed under SEO settings.
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Upload limits</dt>
              <dd>
                <div className="admin-logos-sidebar-stats grid grid-cols-2 gap-2">
                  <div className="admin-logos-sidebar-stat">
                    <p className="text-[10px] uppercase text-subtle">Formats</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      PNG, SVG, WebP
                    </p>
                  </div>
                  <div className="admin-logos-sidebar-stat">
                    <p className="text-[10px] uppercase text-subtle">Max size</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">5 MB</p>
                  </div>
                </div>
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Recommended</dt>
              <dd className="text-sm text-foreground-muted">
                <ul className="list-inside list-disc space-y-1">
                  <li>Transparent PNG or SVG (not JPEG renamed to PNG)</li>
                  <li>Separate light and dark variants for contrast</li>
                  <li>Short alt text with your store name</li>
                </ul>
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Related</dt>
              <dd className="admin-product-form-sidebar-fields">
                <div className="mt-1 flex flex-wrap gap-2">
                  <Link
                    href="/admin/settings/appearance/theme"
                    prefetch={false}
                    className="dashboard-pro-quick-link text-xs"
                  >
                    Theme &amp; colors
                  </Link>
                  <Link
                    href="/admin/settings/email/templates/branding"
                    prefetch={false}
                    className="dashboard-pro-quick-link text-xs"
                  >
                    Email branding
                  </Link>
                </div>
              </dd>
            </div>
          </ProductFormOrderCard>
        }
      />
    </>
  );
}
