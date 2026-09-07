"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import {
  AdminOrderPageIntro,
  AdminOrderTwoColumnLayout,
  SETTINGS_QUICK_LINKS,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { CheckIcon, KeyIcon, PulseIcon, ShieldIcon } from "@/components/admin/icons";
import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import {
  activateLicenseKey,
  validateLicense,
  type LicenseAdminStatus,
} from "@/lib/api";
import { invalidateLicenseStatusCache, useLicenseStatus } from "@/hooks/useLicenseStatus";
import { LICENSE_ADMIN_ROUTE_FEATURES } from "@/lib/license-features";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

const ROUTE_LABELS: Record<string, string> = {
  "/admin/settings/payments": "Payment gateways",
  "/admin/settings/email": "Email / SMTP",
  "/admin/settings/customer-panel": "Customer panel & checkout",
  "/admin/settings/delivery": "Manual delivery fields",
  "/admin/chat/settings": "Live chat settings",
};

function statusLabel(status: LicenseAdminStatus): string {
  if (status.valid) return "Active";
  if (status.devBypass) return "Dev mode";
  if (!status.serverReady) return "Server not configured";
  if (status.configured) return "Key saved";
  return "Inactive";
}

function statusTone(status: LicenseAdminStatus): string {
  if (status.valid) return "text-emerald-400";
  if (status.devBypass) return "text-sky-400";
  return "text-amber-400";
}

export default function AdminLicenseSettingsPage() {
  const { status, loading, reload } = useLicenseStatus();
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [validating, setValidating] = useState(false);

  async function onActivate() {
    const key = licenseKey.trim();
    if (!key) {
      adminToast("Enter a license key.", false);
      return;
    }

    setActivating(true);
    hideAdminToast();
    try {
      await activateLicenseKey(key);
      setLicenseKey("");
      invalidateLicenseStatusCache();
      await reload();
      adminToast("Website activated successfully.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Activation failed.", false);
    } finally {
      setActivating(false);
    }
  }

  async function onValidate() {
    setValidating(true);
    hideAdminToast();
    try {
      await validateLicense();
      invalidateLicenseStatusCache();
      await reload();
      adminToast("License validated.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Validation failed.", false);
    } finally {
      setValidating(false);
    }
  }

  return (
    <AdminPageLayout
      section="Settings"
      title="License key"
      description="Enter your license key to activate this installation. Server credentials are bundled with the app."
      backHref="/admin/settings"
      backLabel="All settings"
      loading={loading}
      loadingText="Loading license…"
      icon={KeyIcon}
    >
      <AdminOrderPageIntro
        icon={<KeyIcon className="h-4 w-4" />}
        title="License key"
        subtitle="Works after domain, hosting, or database changes — only your license key is required here."
        quickLinks={SETTINGS_QUICK_LINKS}
        quickNavLabel="Settings shortcuts"
      />

      <AdminOrderTwoColumnLayout
        main={
          <div className="space-y-5">
            {status ? (
              <ProductFormOrderCard
                icon={<PulseIcon className="h-4 w-4" />}
                title="Current status"
                subtitle="License validation status"
              >
                {!status.serverReady && !status.devBypass ? (
                  <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    Server vendor config is missing. Set site secret in{" "}
                    <code className="text-xs">license.vendor-config.ts</code> before
                    deploy.
                  </div>
                ) : null}
                <dl className="admin-order-view-detail-list admin-order-view-detail-list--in-panel">
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
                    <dt>Status</dt>
                    <dd className={statusTone(status)}>{statusLabel(status)}</dd>
                  </div>
                  {status.licenseKeyMasked ? (
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--inline">
                      <dt>Key</dt>
                      <dd>{status.licenseKeyMasked}</dd>
                    </div>
                  ) : null}
                  {status.message && !status.devBypass ? (
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Message</dt>
                      <dd className="text-sm text-foreground-muted">{status.message}</dd>
                    </div>
                  ) : null}
                </dl>
              </ProductFormOrderCard>
            ) : null}

            <ProductFormOrderCard
              icon={<KeyIcon className="h-4 w-4" />}
              title="Activate with license key"
              subtitle="From license.amarpin.com → Licenses"
            >
              <div>
                <label className={labelCls} htmlFor="license-key">
                  License key
                </label>
                <input
                  id="license-key"
                  className={inputCls}
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder={status?.licenseKeyMasked || "AMP-XXXX-XXXX-XXXX"}
                  autoComplete="off"
                  disabled={!status?.serverReady && !status?.devBypass}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void onActivate();
                    }
                  }}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary btn-primary-sm"
                  disabled={
                    activating ||
                    validating ||
                    !licenseKey.trim() ||
                    (!status?.serverReady && !status?.devBypass)
                  }
                  onClick={() => void onActivate()}
                >
                  {activating ? "Activating…" : "Activate"}
                </button>
                {status?.configured ? (
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost text-sm"
                    disabled={activating || validating}
                    onClick={() => void onValidate()}
                  >
                    {validating ? "Checking…" : "Validate now"}
                  </button>
                ) : null}
              </div>
            </ProductFormOrderCard>

            {status?.serverReady ? (
              <ProductFormOrderCard
                icon={<ShieldIcon className="h-4 w-4" />}
                title="Licensed features"
                subtitle="Unlocked when your license is active"
              >
                <ul className="space-y-2">
                  {status.featureCatalog.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span>{row.label}</span>
                      <span
                        className={
                          row.enabled ? "text-emerald-400" : "text-foreground-muted"
                        }
                      >
                        {row.enabled ? "Enabled" : "Locked"}
                      </span>
                    </li>
                  ))}
                </ul>
              </ProductFormOrderCard>
            ) : null}
          </div>
        }
        sidebar={
          <div className="space-y-4">
            <ProductFormOrderCard
              icon={<CheckIcon className="h-4 w-4" />}
              title="Unlocked by license"
              subtitle="These settings pages require a license feature"
            >
              <ul className="space-y-2 text-sm">
                {Object.entries(LICENSE_ADMIN_ROUTE_FEATURES).map(
                  ([href, feature]) => {
                    const enabled = status?.features[feature!] === true;
                    return (
                      <li key={href}>
                        <Link
                          href={href as Route}
                          className={
                            enabled
                              ? "text-accent hover:underline"
                              : "text-foreground-muted opacity-70"
                          }
                        >
                          {ROUTE_LABELS[href] ?? href}
                        </Link>
                      </li>
                    );
                  },
                )}
              </ul>
            </ProductFormOrderCard>
          </div>
        }
      />
    </AdminPageLayout>
  );
}
