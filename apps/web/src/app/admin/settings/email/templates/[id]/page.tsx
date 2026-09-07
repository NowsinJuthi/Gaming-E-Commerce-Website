"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmailTemplateLivePreview } from "@/components/admin/email/EmailTemplateLivePreview";
import { EmailSettingsNav } from "@/components/admin/email/EmailSettingsNav";
import { EmailSetupGuide } from "@/components/admin/email/EmailSetupGuide";
import {
  EMAIL_PLACEHOLDERS,
  PlaceholderChip,
  RecipientBadge,
  StatusPill,
  ToggleSwitch,
} from "@/components/admin/email/EmailTemplateUi";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import {
  AdminOrderListCard,
  AdminOrderPageIntro,
  EMAIL_QUICK_LINKS,
  SETTINGS_QUICK_LINKS,
} from "@/components/admin/admin-order-page-shell";
import { ArrowLeftIcon, MailIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  getEmailAdminSettings,
  getCustomerPanelConfig,
  getEmailTemplate,
  resetEmailTemplate,
  updateEmailTemplate,
  type EmailSettingsView,
  type EmailTemplateItem,
} from "@/lib/api";
import {
  DEFAULT_EMAIL_PREVIEW_BRANDING,
  resolveEmailBranding,
} from "@/lib/email-template-preview";
import type { SiteAppearance } from "@/lib/site-appearance";

type EditorTab = "content" | "button" | "settings";

export default function EmailTemplateCustomizePage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);

  const [form, setForm] = useState<EmailTemplateItem | null>(null);
  const [savedForm, setSavedForm] = useState<EmailTemplateItem | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsView | null>(
    null,
  );
  const [appearance, setAppearance] = useState<
    Pick<SiteAppearance, "logoUrlLight" | "logoUrlDark" | "defaultTheme">
  >({
    logoUrlLight: "",
    logoUrlDark: "",
    defaultTheme: "dark",
  });
  const [tab, setTab] = useState<EditorTab>("content");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
    const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getEmailTemplate(id),
      getEmailAdminSettings(),
      getCustomerPanelConfig(),
    ])
      .then(([template, emailRes, panelConfig]) => {
        if (!active) return;
        setForm(template);
        setSavedForm(template);
        setEmailSettings(emailRes.settings);
        setAppearance({
          logoUrlLight: panelConfig.appearance.logoUrlLight,
          logoUrlDark: panelConfig.appearance.logoUrlDark,
          defaultTheme: panelConfig.appearance.defaultTheme,
        });
      })
      .catch(() =>
        adminToast("Template not found.", false),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const branding = useMemo(() => {
    if (!emailSettings) return DEFAULT_EMAIL_PREVIEW_BRANDING;
    return resolveEmailBranding(emailSettings, appearance);
  }, [emailSettings, appearance]);

  const isDirty = useMemo(() => {
    if (!form || !savedForm) return false;
    return (
      form.subject !== savedForm.subject ||
      form.heading !== savedForm.heading ||
      form.bodyText !== savedForm.bodyText ||
      form.buttonLabel !== savedForm.buttonLabel ||
      form.buttonUrl !== savedForm.buttonUrl ||
      form.enabled !== savedForm.enabled
    );
  }, [form, savedForm]);

  function set<K extends keyof EmailTemplateItem>(
    key: K,
    value: EmailTemplateItem[K],
  ) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function insertPlaceholder(token: string) {
    if (!form || tab !== "content") return;
    const el = bodyRef.current;
    if (!el) {
      set("bodyText", `${form.bodyText}${form.bodyText ? "\n" : ""}${token}`);
      return;
    }
    const start = el.selectionStart ?? form.bodyText.length;
    const end = el.selectionEnd ?? form.bodyText.length;
    const next =
      form.bodyText.slice(0, start) + token + form.bodyText.slice(end);
    set("bodyText", next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function onSave() {
    if (!form) return;
    setSaving(true);
    hideAdminToast();
    try {
      const updated = await updateEmailTemplate(form.id, {
        subject: form.subject,
        heading: form.heading,
        bodyText: form.bodyText,
        buttonLabel: form.buttonLabel,
        buttonUrl: form.buttonUrl,
        enabled: form.enabled,
      });
      setForm(updated);
      setSavedForm(updated);
      adminToast("Template saved successfully.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed.", false);
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    if (!form) return;
    setResetting(true);
    hideAdminToast();
    try {
      const updated = await resetEmailTemplate(form.id);
      setForm(updated);
      setSavedForm(updated);
      adminToast("Template restored to defaults.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Reset failed.", false);
    } finally {
      setResetting(false);
    }
  }

  return (
    <AdminPageLayout
      section="Settings"
      title={form?.label ?? "Customize template"}
      description="Design professional transactional emails with live preview"
      icon={MailIcon}
    >
      <div className="mb-4 space-y-5">
        <AdminOrderPageIntro
          icon={<MailIcon className="h-4 w-4" />}
          title={form?.label ?? "Customize template"}
          subtitle={
            form?.description ??
            "Design professional transactional emails with live preview."
          }
          quickLinks={[...SETTINGS_QUICK_LINKS.slice(0, 3), ...EMAIL_QUICK_LINKS]}
          quickNavLabel="Settings shortcuts"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/settings/email/templates"
            className="inline-flex items-center gap-2 text-sm text-teal-300 hover:text-teal-200"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Template library
          </Link>
          {isDirty ? (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/20">
              Unsaved changes
            </span>
          ) : null}
        </div>
      </div>

      {loading || !form ? (
        <ProductFormOrderCard
          title="Loading editor"
          subtitle={loading ? "Loading editor…" : "Template not found."}
        >
          <p className="text-sm text-subtle">
            {loading ? "Loading editor…" : "Template not found."}
          </p>
        </ProductFormOrderCard>
      ) : (
        <div className="space-y-5">
              <AdminOrderListCard
                icon={<MailIcon className="h-4 w-4" />}
                title="Email sections"
                subtitle="Navigate between SMTP, templates, and branding."
                className="admin-email-catalog"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Sections</dt>
                  <dd>
                    <EmailSettingsNav />
                  </dd>
                </div>
              </AdminOrderListCard>

              <ProductFormOrderCard
                icon={<MailIcon className="h-4 w-4" />}
                title={form.label}
                subtitle={form.description}
                className="admin-product-form-section overflow-hidden"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <RecipientBadge recipient={form.recipient} />
                  <span className="dashboard-pro-status">{form.category}</span>
                  <StatusPill enabled={form.enabled} />
                </div>
              }
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Editor sections</dt>
                <dd>
                  <div className="admin-notifications-tabs" role="tablist">
                    {(
                      [
                        ["content", "Content"],
                        ["button", "Call to action"],
                        ["settings", "Delivery"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={`admin-notifications-tab${
                          tab === key ? " admin-notifications-tab--active" : ""
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </dd>
              </div>

              <div className="space-y-4 pt-2">
                {tab === "content" && (
                  <>
                    <Field label="Subject line">
                      <input
                        value={form.subject}
                        onChange={(e) => set("subject", e.target.value)}
                        className="admin-input w-full font-mono text-sm"
                      />
                    </Field>
                    <Field
                      label="Email heading"
                      hint="Leave empty to keep the premium built-in HTML layout."
                    >
                      <input
                        value={form.heading}
                        onChange={(e) => set("heading", e.target.value)}
                        placeholder="Order cancelled"
                        className="admin-input w-full"
                      />
                    </Field>
                    <Field
                      label="Body copy"
                      hint="Use blank lines between paragraphs. Click a placeholder below to insert."
                    >
                      <textarea
                        ref={bodyRef}
                        rows={9}
                        value={form.bodyText}
                        onChange={(e) => set("bodyText", e.target.value)}
                        placeholder="Write your message…"
                        className="admin-input w-full font-mono text-sm leading-relaxed"
                      />
                    </Field>
                    <div>
                      <p className="admin-filter-label">Insert placeholder</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {EMAIL_PLACEHOLDERS.map((p) => (
                          <PlaceholderChip
                            key={p}
                            value={p}
                            onClick={() => insertPlaceholder(p)}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {tab === "button" && (
                  <>
                    <Field
                      label="Button label"
                      hint="Optional CTA shown below the message."
                    >
                      <input
                        value={form.buttonLabel}
                        onChange={(e) => set("buttonLabel", e.target.value)}
                        placeholder="View order"
                        className="admin-input w-full"
                      />
                    </Field>
                    <Field
                      label="Button URL"
                      hint="Relative paths or full URLs. Supports placeholders."
                    >
                      <input
                        value={form.buttonUrl}
                        onChange={(e) => set("buttonUrl", e.target.value)}
                        placeholder="/orders/{{order_id}}"
                        className="admin-input w-full font-mono text-sm"
                      />
                    </Field>
                  </>
                )}

                {tab === "settings" && (
                  <>
                    <ToggleSwitch
                      checked={form.enabled}
                      onChange={(v) => set("enabled", v)}
                      label="Template delivery"
                      hint={
                        form.enabled
                          ? "This email will be sent when triggered"
                          : "Delivery is skipped until re-enabled"
                      }
                    />
                    <div className="rounded-xl border border-border/80 bg-white/[0.02] p-4 text-xs text-foreground-muted">
                      <p className="font-semibold text-foreground">
                        Template ID
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-teal-200/90">
                        {form.id}
                      </p>
                      {form.updatedAt ? (
                        <p className="mt-3">
                          Last updated{" "}
                          {new Date(form.updatedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </>
                )}

                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Actions</dt>
                  <dd className="admin-product-form-sidebar-fields">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={onSave}
                        disabled={saving || !isDirty}
                        className="btn-primary disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={onReset}
                        disabled={resetting}
                        className="dashboard-pro-btn-ghost disabled:opacity-50"
                      >
                        {resetting ? "Resetting…" : "Reset to default"}
                      </button>
                      <Link
                        href="/admin/settings/email/templates/branding"
                        className="dashboard-pro-btn-ghost inline-flex items-center"
                      >
                        Email Header Logo
                      </Link>
                    </div>
                  </dd>
                </div>
              </div>
              </ProductFormOrderCard>

          <EmailTemplateLivePreview
            template={form}
            branding={branding}
            fullWidth
          />

          <EmailSetupGuide />
        </div>
      )}
    </AdminPageLayout>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="admin-filter-label">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-subtle">{hint}</p> : null}
    </div>
  );
}
