"use client";

import {
  ACCENT_COLORS,
  THEME_MODES,
  THEME_PREVIEW_GRADIENT,
} from "@/lib/theme";
import { toast } from "@/stores/toast-store";
import { useThemeStore } from "@/stores/theme-store";
import {
  accountPanelClass,
  accountSectionStackClass,
  type AccountSectionProps,
} from "@/components/account/account-section-layout";

export function AppearanceSection({ embedded = false }: AccountSectionProps) {
  const theme = useThemeStore((s) => s.theme);
  const accent = useThemeStore((s) => s.accent);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setAccent = useThemeStore((s) => s.setAccent);

  const sectionTitle = embedded
    ? "text-sm font-semibold text-foreground"
    : "text-lg font-semibold text-foreground";
  const sectionDesc = embedded
    ? "mt-1 text-xs text-foreground-muted"
    : "mt-1 text-sm text-foreground-muted";

  return (
    <div className={accountSectionStackClass(embedded)}>
      <div className={accountPanelClass(embedded)}>
        <h2 className={sectionTitle}>Theme</h2>
        <p className={sectionDesc}>
          Choose a visual style. Your preference is saved on this device.
        </p>
        <div className="mt-4 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {THEME_MODES.map((mode) => {
            const selected = theme === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  if (selected) return;
                  setTheme(mode.id);
                  toast(`${mode.label} theme applied`, "success", 2500);
                }}
                aria-pressed={selected}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-accent bg-accent-muted/40 ring-2 ring-accent"
                    : "border-border bg-elevated hover:border-border-strong"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {mode.label}
                  </span>
                  {selected && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">
                      Active
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-foreground-muted">
                  {mode.description}
                </p>
                <div
                  className="mt-3 h-8 rounded-lg"
                  aria-hidden
                  data-theme-preview={mode.id}
                  style={{ background: THEME_PREVIEW_GRADIENT[mode.id] }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className={accountPanelClass(embedded)}>
        <h2 className={sectionTitle}>Accent color</h2>
        <p className={sectionDesc}>
          Personalize buttons, links, and highlights across the platform.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {ACCENT_COLORS.map((c) => {
            const selected = accent === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (selected) return;
                  setAccent(c.id);
                  toast(`Accent set to ${c.label}`, "success", 2500);
                }}
                aria-pressed={selected}
                aria-label={`${c.label} accent${selected ? ", selected" : ""}`}
                className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 transition ${
                  selected
                    ? "border-accent ring-2 ring-accent"
                    : "border-border bg-elevated hover:border-border-strong"
                }`}
              >
                <span
                  className="h-5 w-5 rounded-full ring-2 ring-border"
                  style={{ backgroundColor: c.swatch }}
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={accountPanelClass(embedded)}>
        <h3 className={sectionTitle}>Preview</h3>
        <p className={sectionDesc}>
          Sample components with your current theme settings.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" tabIndex={-1} className="btn-primary">
            Primary action
          </button>
          <button type="button" tabIndex={-1} className="btn-secondary">
            Secondary
          </button>
          <button type="button" tabIndex={-1} className="btn-ghost">
            Ghost
          </button>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-elevated p-4">
          <p className="text-sm font-medium text-foreground">Premium card</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Gaming marketplace styling with consistent elevation and borders.
          </p>
        </div>
      </div>
    </div>
  );
}
