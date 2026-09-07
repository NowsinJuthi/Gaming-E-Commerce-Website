"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useEffect, useState } from "react";
import { EmailBrandingSection } from "@/components/admin/email/EmailBrandingSection";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  getCustomerPanelConfig,
  getEmailAdminSettings,
  updateEmailAdminSettings,
  type EmailLogoSource,
  type EmailSettingsView,
} from "@/lib/api";
import { resolveStoredEmailLogoSource } from "@/lib/email-template-preview";
import type { SiteAppearance } from "@/lib/site-appearance";

const EMPTY: Pick<
  EmailSettingsView,
  "fromName" | "emailLogoSource" | "logoUrl" | "footerText" | "primaryColor"
> = {
  fromName: "",
  emailLogoSource: "system",
  logoUrl: "",
  footerText: "",
  primaryColor: "#26BFB0",
};

const EMPTY_APPEARANCE: Pick<
  SiteAppearance,
  "logoUrlLight" | "logoUrlDark" | "defaultTheme"
> = {
  logoUrlLight: "",
  logoUrlDark: "",
  defaultTheme: "dark",
};

type Props = {
  onSaved?: () => void;
};

export function EmailBrandingPanel({ onSaved }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [appearance, setAppearance] = useState(EMPTY_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    let active = true;
    Promise.all([getEmailAdminSettings(), getCustomerPanelConfig()])
      .then(([emailRes, panelConfig]) => {
        if (!active) return;
        setForm({
          fromName: emailRes.settings.fromName,
          emailLogoSource: resolveStoredEmailLogoSource(emailRes.settings),
          logoUrl: emailRes.settings.logoUrl,
          footerText: emailRes.settings.footerText,
          primaryColor: emailRes.settings.primaryColor || "#26BFB0",
        });
        setAppearance({
          logoUrlLight: panelConfig.appearance.logoUrlLight,
          logoUrlDark: panelConfig.appearance.logoUrlDark,
          defaultTheme: panelConfig.appearance.defaultTheme,
        });
      })
      .catch(() =>
        adminToast("Failed to load email header logo.", false),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function onChange(
    patch: Partial<
      Pick<
        EmailSettingsView,
        "emailLogoSource" | "logoUrl" | "footerText" | "primaryColor"
      >
    >,
  ) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function onSave() {
    setSaving(true);
    hideAdminToast();
    try {
      const res = await updateEmailAdminSettings({
        emailLogoSource: form.emailLogoSource as EmailLogoSource,
        logoUrl: form.logoUrl,
        footerText: form.footerText,
        primaryColor: form.primaryColor,
      });
      setForm({
        fromName: res.settings.fromName,
        emailLogoSource: resolveStoredEmailLogoSource(res.settings),
        logoUrl: res.settings.logoUrl,
        footerText: res.settings.footerText,
        primaryColor: res.settings.primaryColor || "#26BFB0",
      });
      adminToast("Email Header Logo saved.", true);
      onSaved?.();
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed.", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductFormOrderCard
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10.5" r="1.5" />
          <path d="M21 15l-5-5L5 19" />
        </svg>
      }
      title="Email header logo"
      subtitle="Header logo, footer text, and accent color for every transactional email template."
      className="admin-product-form-section"
    >
      {loading ? (
        <div className="dashboard-pro-empty py-8">
          <p className="text-sm text-subtle">Loading header logo…</p>
        </div>
      ) : (
        <>
          <EmailBrandingSection
            value={{
              emailLogoSource: form.emailLogoSource,
              logoUrl: form.logoUrl,
              footerText: form.footerText,
              primaryColor: form.primaryColor,
              fromName: form.fromName,
            }}
            appearance={appearance}
            onChange={onChange}
          />

          <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
            <dt>Save</dt>
            <dd className="admin-product-form-sidebar-fields">
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save header logo"}
              </button>
            </dd>
          </div>
        </>
      )}
    </ProductFormOrderCard>
  );
}
