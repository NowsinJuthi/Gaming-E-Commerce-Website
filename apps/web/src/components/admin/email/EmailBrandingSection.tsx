"use client";

import { LogoUploadField } from "@/components/admin/LogoUploadField";
import type { EmailLogoSource } from "@/lib/api";
import {
  resolveEmailLogoSrc,
  resolveStoredEmailLogoSource,
} from "@/lib/email-template-preview";
import { SITE_COPYRIGHT } from "@/lib/seo";
import type { SiteAppearance } from "@/lib/site-appearance";

type EmailBrandingFields = {
  emailLogoSource: EmailLogoSource;
  logoUrl: string;
  footerText: string;
  primaryColor: string;
  fromName: string;
};

type Props = {
  value: EmailBrandingFields;
  appearance: Pick<
    SiteAppearance,
    "logoUrlLight" | "logoUrlDark" | "defaultTheme"
  >;
  onChange: (patch: Partial<EmailBrandingFields>) => void;
};

const LOGO_SOURCE_OPTIONS: Array<{
  id: Exclude<EmailLogoSource, "custom">;
  label: string;
  description: string;
}> = [
  {
    id: "light",
    label: "Light",
    description: "Site logo for light theme",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Site logo for dark theme",
  },
  {
    id: "system",
    label: "System",
    description: "Follows your default site theme",
  },
];

export function EmailBrandingSection({
  value,
  appearance,
  onChange,
}: Props) {
  const accent = value.primaryColor.trim() || "#26BFB0";
  const storeName = value.fromName.trim() || "UniQbd";
  const logoSource = resolveStoredEmailLogoSource(value);
  const logoSrc = resolveEmailLogoSrc(
    { emailLogoSource: logoSource, logoUrl: value.logoUrl },
    appearance,
  );
  const isCustom = logoSource === "custom";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <Field label="Header logo source">
            <div className="grid gap-2 sm:grid-cols-3">
              {LOGO_SOURCE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChange({ emailLogoSource: option.id })}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    logoSource === option.id
                      ? "border-teal-500/50 bg-teal-500/10 text-teal-600 dark:text-teal-300"
                      : "border-border bg-elevated text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="font-semibold">{option.label}</span>
                  <p className="mt-0.5 text-xs text-foreground-muted">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
            {!isCustom ? (
              <button
                type="button"
                onClick={() => onChange({ emailLogoSource: "custom" })}
                className="mt-2 text-xs font-medium text-teal-600 hover:underline dark:text-teal-300"
              >
                Upload a dedicated email logo instead
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onChange({ emailLogoSource: "system", logoUrl: "" })
                }
                className="mt-2 text-xs font-medium text-teal-600 hover:underline dark:text-teal-300"
              >
                Use site logo (Light / Dark / System)
              </button>
            )}
          </Field>

          {isCustom ? (
            <>
              <LogoUploadField
                label="email header"
                variant="email"
                onUploaded={(url) =>
                  onChange({ emailLogoSource: "custom", logoUrl: url })
                }
              />
              <Field label="Header logo URL">
                <input
                  value={value.logoUrl}
                  onChange={(e) =>
                    onChange({
                      emailLogoSource: "custom",
                      logoUrl: e.target.value,
                    })
                  }
                  placeholder="/logo/uniqbd-logo-dark.png or https://…"
                  className="admin-input w-full font-mono text-xs"
                />
              </Field>
              {value.logoUrl.trim() ? (
                <button
                  type="button"
                  onClick={() => onChange({ logoUrl: "" })}
                  className="panel-3d-btn-ghost panel-3d-btn-sm"
                >
                  Remove custom logo
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-foreground-muted">
              Using{" "}
              <span className="font-medium text-foreground">
                {LOGO_SOURCE_OPTIONS.find((o) => o.id === logoSource)?.label}
              </span>{" "}
              logo from Appearance settings
              {logoSrc ? "" : " — no logo configured yet"}.
            </p>
          )}

          <p className="text-xs text-foreground-muted">
            Shown at the top of every transactional email. Leave empty to use
            your store name as text instead of an image.
          </p>
        </div>

        <EmailHeaderPreview
          accent={accent}
          storeName={storeName}
          logoSrc={logoSrc}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Footer text">
          <textarea
            rows={3}
            value={value.footerText}
            onChange={(e) => onChange({ footerText: e.target.value })}
            placeholder={SITE_COPYRIGHT}
            className="admin-input w-full text-sm"
          />
        </Field>
        <Field label="Brand accent color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accent}
              onChange={(e) => onChange({ primaryColor: e.target.value })}
              className="h-10 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
            />
            <input
              value={value.primaryColor}
              onChange={(e) => onChange({ primaryColor: e.target.value })}
              placeholder="#26BFB0"
              className="admin-input w-full font-mono text-sm"
            />
          </div>
        </Field>
      </div>
    </div>
  );
}

function EmailHeaderPreview({
  accent,
  storeName,
  logoSrc,
}: {
  accent: string;
  storeName: string;
  logoSrc: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a101a]">
      <p className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
        Header preview
      </p>
      <div
        className="px-4 py-6 text-center"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, #0d4f4a 52%, #071018 100%)`,
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
          Official store
        </p>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={storeName}
            className="mx-auto mt-2 h-9 max-w-full object-contain"
          />
        ) : (
          <p className="mt-2 text-xl font-extrabold text-white">{storeName}</p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="admin-filter-label">{label}</label>
      {children}
    </div>
  );
}
