"use client";

import { adminToast } from "@/lib/admin-toast";
import { useCallback, useEffect, useState } from "react";
import {
  AdminOrderPageIntro,
  AdminOrderTwoColumnLayout,
  SETTINGS_QUICK_LINKS,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { ChatIcon, MailIcon, LinkIcon, StoreIcon } from "@/components/admin/icons";
import {
  getAdminContactSettings,
  updateContactSettings,
  type ContactSettings,
  type ContactSocialLink,
} from "@/lib/api";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";
const textareaCls = "admin-input min-h-[80px] w-full";

function linesToText(lines: string[] | undefined): string {
  return (lines ?? []).join("\n");
}
function textToLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const DEFAULT_SETTINGS: ContactSettings = {
  heading: "CONTACT US",
  subheading: "",
  extraText: "",
  address: { label: "Address", lines: [] },
  support: { label: "Support", phones: [] },
  email: { label: "Email", emails: [] },
  social: { label: "Social", facebookUrl: "", youtubeUrl: "", whatsappUrl: "", links: [] },
  whatsappCard: { title: "Connect Directly", description: "" },
};

function mergeSettings(data: Partial<ContactSettings>): ContactSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    address: {
      label: data.address?.label ?? DEFAULT_SETTINGS.address.label,
      lines: data.address?.lines ?? [],
    },
    support: {
      label: data.support?.label ?? DEFAULT_SETTINGS.support.label,
      phones: data.support?.phones ?? [],
    },
    email: {
      label: data.email?.label ?? DEFAULT_SETTINGS.email.label,
      emails: data.email?.emails ?? [],
    },
    social: {
      label: data.social?.label ?? DEFAULT_SETTINGS.social.label,
      facebookUrl: data.social?.facebookUrl ?? "",
      youtubeUrl: data.social?.youtubeUrl ?? "",
      whatsappUrl: data.social?.whatsappUrl ?? "",
      links: data.social?.links ?? [],
    },
    whatsappCard: {
      title: data.whatsappCard?.title ?? "Connect Directly",
      description: data.whatsappCard?.description ?? "",
    },
  };
}

export default function ContactSettingsPage() {
  const [settings, setSettings] = useState<ContactSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminContactSettings();
      setSettings(mergeSettings(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(update: Partial<ContactSettings>) {
    setSettings((prev) => ({ ...prev, ...update }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<ContactSettings> = {
        heading: settings.heading,
        subheading: settings.subheading,
        extraText: settings.extraText,
        address: settings.address,
        support: settings.support,
        email: settings.email,
        social: settings.social,
        whatsappCard: settings.whatsappCard,
      };
      const data = await updateContactSettings(payload);
      setSettings(mergeSettings(data));
      adminToast("Contact page saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      adminToast(msg, false);
    } finally {
      setSaving(false);
    }
  }

  const saveBtn = (
    <button
      type="button"
      className="btn-primary disabled:opacity-50"
      disabled={saving || loading}
      onClick={() => void handleSave()}
    >
      {saving ? "Saving…" : "Save changes"}
    </button>
  );

  const mainContent = (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      {/* Page Header */}
      <ProductFormOrderCard
        icon={<ChatIcon className="h-4 w-4" />}
        title="Page header"
        subtitle="Main heading and description text shown at the top"
        className="admin-product-form-section space-y-4"
        flatBody
      >
        <div>
          <label className={labelCls}>Page heading</label>
          <input
            type="text"
            className={inputCls}
            value={settings.heading}
            onChange={(e) => patch({ heading: e.target.value })}
            placeholder="CONTACT US"
          />
        </div>
        <div>
          <label className={labelCls}>Description text</label>
          <textarea
            className={textareaCls}
            value={settings.subheading}
            onChange={(e) => patch({ subheading: e.target.value })}
            placeholder="SMS To Our Facebook Page Without Calling To Get Fast Service..."
          />
        </div>
        <div>
          <label className={labelCls}>Notice text (shown in red)</label>
          <input
            type="text"
            className={inputCls}
            value={settings.extraText}
            onChange={(e) => patch({ extraText: e.target.value })}
            placeholder="WhatsApp Call Support Available NO — Only SMS Support."
          />
        </div>
      </ProductFormOrderCard>

      {/* Address */}
      <ProductFormOrderCard
        icon={<LinkIcon className="h-4 w-4" />}
        title="Address card"
        subtitle="Physical address shown in the contact card"
        className="admin-product-form-section space-y-4"
        flatBody
      >
        <div>
          <label className={labelCls}>Card label</label>
          <input
            type="text"
            className={inputCls}
            value={settings.address.label}
            onChange={(e) =>
              patch({ address: { ...settings.address, label: e.target.value } })
            }
            placeholder="Address"
          />
        </div>
        <div>
          <label className={labelCls}>Address lines (one per line)</label>
          <textarea
            className={textareaCls}
            value={linesToText(settings.address.lines)}
            onChange={(e) =>
              patch({
                address: { ...settings.address, lines: textToLines(e.target.value) },
              })
            }
            placeholder={"Razahan, Turag, Dhaka-1711\nHouse 13, Road 01, Block B, Ward 54"}
          />
        </div>
      </ProductFormOrderCard>

      {/* Support */}
      <ProductFormOrderCard
        icon={<StoreIcon className="h-4 w-4" />}
        title="Support card"
        subtitle="Phone numbers or support contact info"
        className="admin-product-form-section space-y-4"
        flatBody
      >
        <div>
          <label className={labelCls}>Card label</label>
          <input
            type="text"
            className={inputCls}
            value={settings.support.label}
            onChange={(e) =>
              patch({ support: { ...settings.support, label: e.target.value } })
            }
            placeholder="Support"
          />
        </div>
        <div>
          <label className={labelCls}>Phone / contact lines (one per line)</label>
          <textarea
            className={textareaCls}
            value={linesToText(settings.support.phones)}
            onChange={(e) =>
              patch({
                support: { ...settings.support, phones: textToLines(e.target.value) },
              })
            }
            placeholder={"01777110777\n01777112777\nWhatsApp SMS: 01777190777"}
          />
        </div>
      </ProductFormOrderCard>

      {saveBtn}
    </div>
  );

  const sidebarContent = (
    <div className="space-y-4">
      {/* Email */}
      <ProductFormOrderCard
        icon={<MailIcon className="h-4 w-4" />}
        title="Email card"
        subtitle="Email addresses shown in the contact card"
        className="admin-product-form-section space-y-4"
        flatBody
      >
        <div>
          <label className={labelCls}>Card label</label>
          <input
            type="text"
            className={inputCls}
            value={settings.email.label}
            onChange={(e) =>
              patch({ email: { ...settings.email, label: e.target.value } })
            }
            placeholder="Email"
          />
        </div>
        <div>
          <label className={labelCls}>Email addresses (one per line)</label>
          <textarea
            className={textareaCls}
            value={linesToText(settings.email.emails)}
            onChange={(e) =>
              patch({
                email: { ...settings.email, emails: textToLines(e.target.value) },
              })
            }
            placeholder={"support@uniqbd.com\ninfo@uniqbd.com"}
          />
        </div>
      </ProductFormOrderCard>

      {/* Social */}
      <ProductFormOrderCard
        icon={<LinkIcon className="h-4 w-4" />}
        title="Social card"
        subtitle="Facebook, YouTube, WhatsApp, and other social links"
        className="admin-product-form-section space-y-4"
        flatBody
      >
        <div>
          <label className={labelCls}>Card label</label>
          <input
            type="text"
            className={inputCls}
            value={settings.social.label}
            onChange={(e) =>
              patch({ social: { ...settings.social, label: e.target.value } })
            }
            placeholder="Social"
          />
        </div>
        <div>
          <label className={labelCls}>Facebook page URL</label>
          <input
            type="url"
            className={inputCls}
            value={settings.social.facebookUrl}
            onChange={(e) =>
              patch({
                social: { ...settings.social, facebookUrl: e.target.value },
              })
            }
            placeholder="https://facebook.com/UniQbdOnline"
          />
          <p className="mt-1 text-[11px] text-subtle">
            Shown as an icon in the footer and contact page hero.
          </p>
        </div>
        <div>
          <label className={labelCls}>YouTube channel URL</label>
          <input
            type="url"
            className={inputCls}
            value={settings.social.youtubeUrl}
            onChange={(e) =>
              patch({
                social: { ...settings.social, youtubeUrl: e.target.value },
              })
            }
            placeholder="https://youtube.com/@UniQbd"
          />
          <p className="mt-1 text-[11px] text-subtle">
            Shown as an icon in the footer and contact page hero.
          </p>
        </div>
        <div>
          <label className={labelCls}>WhatsApp link or phone number</label>
          <input
            type="text"
            className={inputCls}
            value={settings.social.whatsappUrl}
            onChange={(e) =>
              patch({
                social: { ...settings.social, whatsappUrl: e.target.value },
              })
            }
            placeholder="01777190777 or https://wa.me/8801777190777"
          />
          <p className="mt-1 text-[11px] text-subtle">
            Phone number or wa.me link — shown as an icon in the footer and
            contact page hero.
          </p>
        </div>
        <div>
          <label className={labelCls}>WhatsApp card title</label>
          <input
            type="text"
            className={inputCls}
            value={settings.whatsappCard?.title ?? ""}
            onChange={(e) =>
              patch({
                whatsappCard: {
                  title: e.target.value,
                  description: settings.whatsappCard?.description ?? "",
                },
              })
            }
            placeholder="Connect Directly"
          />
        </div>
        <div>
          <label className={labelCls}>WhatsApp card description</label>
          <textarea
            className={textareaCls}
            value={settings.whatsappCard?.description ?? ""}
            onChange={(e) =>
              patch({
                whatsappCard: {
                  title: settings.whatsappCard?.title ?? "Connect Directly",
                  description: e.target.value,
                },
              })
            }
            placeholder="Chat with our support executives instantly via WhatsApp."
          />
          <p className="mt-1 text-[11px] text-subtle">
            Shown on the &quot;Connect Directly&quot; card on /contact. Leave
            empty to use the default text (which also tells signed-out
            visitors to sign in first).
          </p>
        </div>
        <div>
          <label className={labelCls}>Other links (display text + URL)</label>
          <div className="space-y-2">
            {settings.social.links.map((link, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  className="admin-input flex-1"
                  value={link.text}
                  onChange={(e) => {
                    const links = settings.social.links.map((l, i) =>
                      i === idx ? { ...l, text: e.target.value } : l,
                    );
                    patch({ social: { ...settings.social, links } });
                  }}
                  placeholder="Facebook.com/UniQbdOnline"
                />
                <input
                  type="text"
                  className="admin-input flex-1"
                  value={link.url}
                  onChange={(e) => {
                    const links = settings.social.links.map((l, i) =>
                      i === idx ? { ...l, url: e.target.value } : l,
                    );
                    patch({ social: { ...settings.social, links } });
                  }}
                  placeholder="https://facebook.com/..."
                />
                <button
                  type="button"
                  className="dashboard-pro-btn-ghost shrink-0 px-2 text-rose-400"
                  onClick={() => {
                    const links = settings.social.links.filter((_, i) => i !== idx);
                    patch({ social: { ...settings.social, links } });
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="dashboard-pro-btn-ghost text-xs"
              onClick={() => {
                const links: ContactSocialLink[] = [
                  ...settings.social.links,
                  { text: "", url: "" },
                ];
                patch({ social: { ...settings.social, links } });
              }}
            >
              + Add social link
            </button>
          </div>
        </div>
      </ProductFormOrderCard>

      {/* Preview */}
      <div className="rounded-xl border border-border/40 bg-sunken/40 px-4 py-3 text-xs text-foreground-muted space-y-1">
        <p className="font-semibold text-foreground">Public page</p>
        <a
          href="/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          /contact — open in new tab ↗
        </a>
      </div>

      {saveBtn}
    </div>
  );

  return (
    <AdminPageLayout>
      <AdminOrderPageIntro
        icon={<MailIcon className="h-4 w-4" />}
        title="Contact page"
        subtitle="Edit the public /contact page content and info cards."
        quickLinks={SETTINGS_QUICK_LINKS}
      />
      <AdminOrderTwoColumnLayout main={mainContent} sidebar={sidebarContent} />
    </AdminPageLayout>
  );
}
