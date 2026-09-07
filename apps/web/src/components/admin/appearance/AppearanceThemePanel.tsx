"use client";

import Link from "next/link";
import { memo, useCallback, useState, type ReactNode } from "react";
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
  SunIcon,
  TagIcon,
  ZapIcon,
} from "@/components/admin/icons";
import { SiteLogo } from "@/components/SiteLogo";
import { ACCENT_COLORS, THEME_MODES } from "@/lib/theme";
import {
  DEFAULT_SITE_APPEARANCE,
  type PaletteColors,
  type SiteAppearance,
} from "@/lib/site-appearance";

type Tab = "theme" | "brand" | "light" | "dark" | "preview";

type PaletteKey = keyof PaletteColors;
type PaletteMode = "light" | "dark";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "theme", label: "Default theme" },
  { id: "brand", label: "Accent & brand" },
  { id: "light", label: "Light palette" },
  { id: "dark", label: "Dark palette" },
  { id: "preview", label: "Live preview" },
];

const DEFAULT_THEME_OPTIONS = (["system", "light", "dark"] as const)
  .map((id) => THEME_MODES.find((mode) => mode.id === id))
  .filter((mode): mode is (typeof THEME_MODES)[number] => Boolean(mode));

const PALETTE_FIELDS: Array<{ key: PaletteKey; label: string; hint: string }> = [
  { key: "bg", label: "Page background", hint: "Main site background" },
  { key: "elevated", label: "Cards & panels", hint: "Header, cards, inputs" },
  { key: "muted", label: "Muted surfaces", hint: "Hover states, side areas" },
];

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

function ThemeOverviewStatCopy({
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

function accentLabel(accent: SiteAppearance["accent"]) {
  return ACCENT_COLORS.find((item) => item.id === accent)?.label ?? accent;
}

function countCustomPaletteColors(appearance: SiteAppearance) {
  let count = 0;
  for (const mode of ["light", "dark"] as const) {
    for (const key of ["bg", "elevated", "muted"] as const) {
      if (appearance[mode][key] !== DEFAULT_SITE_APPEARANCE[mode][key]) {
        count += 1;
      }
    }
  }
  return count;
}

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

const ColorField = memo(function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="admin-theme-color-field">
      <Field label={label} hint={hint}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="admin-theme-color-swatch h-10 w-12 cursor-pointer rounded-lg border border-border bg-elevated p-1"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} font-mono uppercase`}
            pattern="^#[0-9A-Fa-f]{6}$"
            maxLength={7}
          />
        </div>
      </Field>
    </div>
  );
});

const ThemePreviewPanel = memo(function ThemePreviewPanel({
  dark,
  brandColor,
  logoUrlLight,
  logoUrlDark,
  logoAlt,
  siteName,
}: {
  dark: PaletteColors;
  brandColor: string;
  logoUrlLight: string;
  logoUrlDark: string;
  logoAlt: string;
  siteName: string;
}) {
  return (
    <div
      className="admin-theme-preview overflow-hidden rounded-xl border"
      style={{ backgroundColor: dark.bg, color: "#e2e8f0" }}
    >
      <div
        className="border-b px-5 py-3"
        style={{
          backgroundColor: dark.elevated,
          borderColor: dark.muted,
        }}
      >
        <SiteLogo
          href={null}
          size="compact"
          showWave={false}
          override={{
            logoUrlLight,
            logoUrlDark,
            logoAlt,
            siteName,
            previewTheme: "dark",
          }}
        />
        <span className="ml-3 text-sm opacity-70">Live preview (dark)</span>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: dark.elevated,
            borderColor: dark.muted,
          }}
        >
          <p className="text-sm font-medium">Product card</p>
          <p className="mt-1 text-xs opacity-70">Sample elevated surface</p>
        </div>
        <button
          type="button"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: brandColor }}
        >
          Buy now
        </button>
      </div>
    </div>
  );
});

const PaletteTab = memo(function PaletteTab({
  mode,
  palette,
  onPaletteChange,
}: {
  mode: PaletteMode;
  palette: PaletteColors;
  onPaletteChange: (
    mode: PaletteMode,
    key: PaletteKey,
    value: string,
  ) => void;
}) {
  const title = mode === "light" ? "Light mode palette" : "Dark mode palette";
  const subtitle =
    mode === "light"
      ? "Backgrounds and surfaces for the light storefront theme."
      : "Backgrounds and surfaces for the dark storefront theme.";

  return (
    <ProductFormOrderCard
      icon={<LayersIcon className="h-4 w-4" />}
      title={title}
      subtitle={subtitle}
      className="admin-product-form-section admin-theme-section"
    >
      <div className="admin-theme-section-body">
        <div className="admin-theme-form-grid">
          {PALETTE_FIELDS.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              hint={field.hint}
              value={palette[field.key]}
              onChange={(value) => onPaletteChange(mode, field.key, value)}
            />
          ))}
        </div>
      </div>
    </ProductFormOrderCard>
  );
});

export function AppearanceThemePanel() {
  const { appearance, setAppearance, updatePalette, ready } =
    useAppearanceSettings();
  const [tab, setTab] = useState<Tab>("theme");

  const customPaletteCount = countCustomPaletteColors(appearance);

  const setDefaultTheme = useCallback(
    (defaultTheme: SiteAppearance["defaultTheme"]) => {
      setAppearance((cur) => ({ ...cur, defaultTheme }));
    },
    [setAppearance],
  );

  const setAccent = useCallback(
    (accent: SiteAppearance["accent"]) => {
      setAppearance((cur) => ({ ...cur, accent }));
    },
    [setAppearance],
  );

  const setBrandColor = useCallback(
    (brandColor: string) => {
      setAppearance((cur) => ({ ...cur, brandColor }));
    },
    [setAppearance],
  );

  const onPaletteChange = updatePalette;

  return (
    <>
      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<SunIcon className="h-4 w-4" />}
              title="Theme overview"
              subtitle={
                ready
                  ? `${appearance.defaultTheme} default · brand ${appearance.brandColor.toUpperCase()}`
                  : "Loading theme settings…"
              }
              className="admin-theme-catalog"
            >
              <section
                className="customer-dashboard-overview-section admin-theme-overview"
                aria-label="Theme overview"
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
                      <SunIcon className="h-4 w-4" />
                    </span>
                    <ThemeOverviewStatCopy
                      label="Default theme"
                      value={loadingStat(ready, appearance.defaultTheme)}
                      meta="New visitor preference"
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
                      <TagIcon className="h-4 w-4" />
                    </span>
                    <ThemeOverviewStatCopy
                      label="Accent"
                      value={loadingStat(ready, accentLabel(appearance.accent))}
                      meta="Links and highlights"
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
                      <ZapIcon className="h-4 w-4" />
                    </span>
                    <ThemeOverviewStatCopy
                      label="Brand"
                      value={loadingStat(ready, appearance.brandColor.toUpperCase())}
                      meta="CTAs and logo accent"
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
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <ThemeOverviewStatCopy
                      label="Palette"
                      value={loadingStat(ready, `${customPaletteCount}/6`)}
                      meta="Custom surface colors"
                    />
                  </div>
                </div>
              </section>

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

            {tab === "theme" ? (
              <ProductFormOrderCard
                icon={<SunIcon className="h-4 w-4" />}
                title="Default theme"
                subtitle="New visitors see this theme until they change it on their device."
                className="admin-product-form-section admin-theme-section"
              >
                <div className="admin-theme-section-body">
                  <div className="admin-theme-choice-grid">
                    {DEFAULT_THEME_OPTIONS.map((mode) => {
                      const active = appearance.defaultTheme === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setDefaultTheme(mode.id)}
                          className={`admin-theme-choice${
                            active ? " admin-theme-choice--active" : ""
                          }`}
                        >
                          <span className="font-semibold">
                            {mode.label}
                            {mode.id === "system" ? " · Default" : ""}
                          </span>
                          <p className="mt-0.5 text-xs text-foreground-muted">
                            {mode.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </ProductFormOrderCard>
            ) : null}

            {tab === "theme" ? <AppearanceActions /> : null}

            <div className="admin-theme-content min-w-0">
            {tab === "brand" ? (
              <ProductFormOrderCard
                icon={<TagIcon className="h-4 w-4" />}
                title="Accent & brand colors"
                subtitle="Platform accent for links and highlights, plus brand color for CTAs and logo accents."
                className="admin-product-form-section admin-theme-section"
              >
                <div className="admin-theme-section-body space-y-6">
                  <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                      Accent color
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_COLORS.map((color) => {
                        const active = appearance.accent === color.id;
                        return (
                          <button
                            key={color.id}
                            type="button"
                            onClick={() => setAccent(color.id)}
                            className={`admin-theme-accent-btn${
                              active ? " admin-theme-accent-btn--active" : ""
                            }`}
                          >
                            <span
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: color.swatch }}
                            />
                            {color.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <ColorField
                    label="Brand color"
                    hint="Used for UniQbd logo accent and storefront CTAs"
                    value={appearance.brandColor}
                    onChange={setBrandColor}
                  />
                </div>
              </ProductFormOrderCard>
            ) : null}

            {tab === "light" ? (
              <PaletteTab
                mode="light"
                palette={appearance.light}
                onPaletteChange={onPaletteChange}
              />
            ) : null}

            {tab === "dark" ? (
              <PaletteTab
                mode="dark"
                palette={appearance.dark}
                onPaletteChange={onPaletteChange}
              />
            ) : null}

            {tab === "preview" ? (
              <ProductFormOrderCard
                icon={<LayersIcon className="h-4 w-4" />}
                title="Live preview"
                subtitle="Sample dark storefront header, card, and CTA using your current palette and brand color."
                className="admin-product-form-section admin-theme-section"
              >
                <div className="admin-theme-section-body">
                  <ThemePreviewPanel
                    dark={appearance.dark}
                    brandColor={appearance.brandColor}
                    logoUrlLight={appearance.logoUrlLight}
                    logoUrlDark={appearance.logoUrlDark}
                    logoAlt={appearance.logoAlt}
                    siteName={appearance.siteName}
                  />
                </div>
              </ProductFormOrderCard>
            ) : null}
            </div>

            {tab !== "theme" ? <AppearanceActions /> : null}
          </>
        }
        sidebar={
          <ProductFormOrderCard
            icon={<LayersIcon className="h-4 w-4" />}
            title="Theme guide"
            subtitle="Default theme, accents, palette colors, and preview tips."
            className="admin-product-form-section admin-theme-help"
          >
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Theme pipeline</dt>
              <dd className="text-sm text-foreground-muted">
                Pick default theme, accent, brand, and palette colors, preview the
                result, then save once at the bottom. Changes apply to all visitors
                after save.
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Palette stats</dt>
              <dd>
                <div className="admin-theme-sidebar-stats grid grid-cols-2 gap-2">
                  <div className="admin-theme-sidebar-stat">
                    <p className="text-[10px] uppercase text-subtle">Modes</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      Light / Dark
                    </p>
                  </div>
                  <div className="admin-theme-sidebar-stat">
                    <p className="text-[10px] uppercase text-subtle">Accents</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {ACCENT_COLORS.length} presets
                    </p>
                  </div>
                </div>
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Tips</dt>
              <dd className="text-sm text-foreground-muted">
                <ul className="list-inside list-disc space-y-1">
                  <li>Keep light and dark palettes distinct for contrast</li>
                  <li>Brand color should pass WCAG on dark backgrounds</li>
                  <li>Use System default to respect visitor OS preference</li>
                </ul>
              </dd>
            </div>
            <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
              <dt>Related</dt>
              <dd className="admin-product-form-sidebar-fields">
                <p className="text-sm text-foreground-muted">
                  Site logos and text identity are managed separately under Logos.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/admin/settings/appearance/logos"
                    prefetch={false}
                    className="dashboard-pro-quick-link text-xs"
                  >
                    Logos
                  </Link>
                  <Link
                    href="/"
                    prefetch={false}
                    className="dashboard-pro-quick-link text-xs"
                  >
                    View storefront
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
