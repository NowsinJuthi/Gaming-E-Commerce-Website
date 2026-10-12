"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import {
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { CheckIcon, KeyIcon, PulseIcon, ShieldIcon } from "@/components/admin/icons";
import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import {
  activateLicenseKey,
  deactivateLicense,
  validateLicense,
  type LicenseAdminStatus,
} from "@/lib/api";
import { invalidateLicenseStatusCache, useLicenseStatus } from "@/hooks/useLicenseStatus";
import { LICENSE_ADMIN_ROUTE_FEATURES } from "@/lib/license-features";
import { AdminLicenseContactPanel } from "@/components/admin/AdminLicenseContactPanel";

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
  if (status.devBypass) return "Dev mode (no license)";
  if (status.valid) return "Active";
  if (!status.serverReady) return "Server not configured";
  if (status.configured) return "Key saved";
  return "Inactive";
}

function statusTone(status: LicenseAdminStatus): string {
  if (status.devBypass) return "text-sky-400";
  if (status.valid) return "text-emerald-400";
  return "text-amber-400";
}

export default function AdminLicenseSettingsPage() {
  const { status, loading, reload } = useLicenseStatus();
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [replacingKey, setReplacingKey] = useState(false);

  const hasSavedKey = Boolean(status?.licenseKeyMasked || status?.configured);
  const licenseActive = Boolean(status?.valid && !status?.devBypass);
  const showMaskedKey = hasSavedKey && !replacingKey;

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
      setReplacingKey(false);
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

  async function onDeactivate() {
    if (
      !confirm(
        "Remove this license key?\n\nPayment gateways, email, live chat and other licensed settings will lock until you activate a key again.",
      )
    ) {
      return;
    }

    setDeactivating(true);
    hideAdminToast();
    try {
      await deactivateLicense();
      setLicenseKey("");
      setReplacingKey(false);
      invalidateLicenseStatusCache();
      await reload();
      adminToast("License key removed. Licensed features are locked.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Could not remove license key.", false);
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <AdminPageLayout
      section="Settings"
      title="License key"
      description="Activate or deactivate this website. Licensed settings stay locked until a valid key is active."
      backHref="/admin/settings"
      backLabel="All settings"
      loading={loading}
      loadingText="Loading license…"
      icon={KeyIcon}
    >
      {status ? (
        <section
          className={`admin-license-hero ${
            status.devBypass
              ? "admin-license-hero--dev"
              : status.valid
                ? "admin-license-hero--active"
                : ""
          }`}
        >
          <span className="admin-license-hero-icon" aria-hidden>
            <KeyIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="admin-license-hero-kicker">Gaming E-Commerce Website</p>
            <h2 className="admin-license-hero-title">
              {loading
                ? "Checking license…"
                : status.devBypass
                  ? "Dev mode — no license required"
                  : status.valid
                    ? "License active"
                    : "License required"}
            </h2>
            <p className="admin-license-hero-desc">
              {loading
                ? "Reading the current license status from this server."
                : status.devBypass
                  ? "All features are unlocked locally. Enter a license key before production deploy."
                  : status.valid
                    ? "Payment gateways, email, live chat and other licensed features are available."
                    : "Paste a valid license key below to unlock payment gateways, email, live chat and other licensed settings."}
            </p>
          </div>
        </section>
      ) : null}

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
                    This server is not configured for licensing yet. Contact your
                    vendor or hosting administrator, then return here to activate
                    your license key.
                  </div>
                ) : null}
                {status.devBypass ? (
                  <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
                    Local development — no license key required. All features are
                    unlocked on this machine only. Enter a license key before production
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
                  {status.message ? (
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
              title={hasSavedKey ? "License key" : "Activate license key"}
              subtitle={
                hasSavedKey
                  ? licenseActive
                    ? "This license is active. The key stays hidden. Remove it below to lock licensed settings."
                    : "A key is saved on this server. Remove it or paste a new key to replace it."
                  : "From license.amarpin.com → Licenses"
              }
            >
              <div>
                <label className={labelCls} htmlFor="license-key">
                  License key
                </label>
                {showMaskedKey ? (
                  <input
                    id="license-key"
                    className={`admin-input admin-license-key-saved ${inputCls}`}
                    type="text"
                    value="************************"
                    readOnly
                    disabled
                    autoComplete="off"
                    aria-label="License key saved and hidden"
                  />
                ) : (
                  <input
                    id="license-key"
                    className={`admin-input font-mono ${inputCls}`}
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="Paste license key"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!status?.serverReady && !status?.devBypass}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void onActivate();
                      }
                    }}
                  />
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {!showMaskedKey ? (
                  <button
                    type="button"
                    className="btn-primary btn-primary-sm"
                    disabled={
                      activating ||
                      validating ||
                      deactivating ||
                      !licenseKey.trim() ||
                      (!status?.serverReady && !status?.devBypass)
                    }
                    onClick={() => void onActivate()}
                  >
                    {activating ? "Activating…" : hasSavedKey ? "Replace key" : "Activate"}
                  </button>
                ) : null}
                {showMaskedKey ? (
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost text-sm"
                    disabled={activating || validating || deactivating}
                    onClick={() => {
                      setReplacingKey(true);
                      setLicenseKey("");
                    }}
                  >
                    Replace key
                  </button>
                ) : null}
                {replacingKey ? (
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost text-sm"
                    disabled={activating || validating || deactivating}
                    onClick={() => {
                      setReplacingKey(false);
                      setLicenseKey("");
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
                {status?.configured && licenseActive ? (
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost text-sm"
                    disabled={activating || validating || deactivating}
                    onClick={() => void onValidate()}
                  >
                    {validating ? "Checking…" : "Validate now"}
                  </button>
                ) : null}
              </div>
            </ProductFormOrderCard>

            {hasSavedKey && !status?.devBypass ? (
              <section className="admin-license-remove-card" aria-labelledby="license-remove-title">
                <div className="admin-license-remove-head">
                  <span className="admin-license-remove-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path strokeLinecap="round" d="M9 9h6M9 12h6M9 15h4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 5h10l1 14H6L7 5Z" />
                      <path strokeLinecap="round" d="M10 5V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h3 id="license-remove-title" className="text-sm font-semibold text-rose-100">
                      Remove license key
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-rose-100/75">
                      Deactivate this installation and clear the saved key from the server.
                    </p>
                  </div>
                </div>
                <div className="admin-license-remove-body">
                  <p className="text-sm text-foreground-muted">
                    {licenseActive
                      ? "Your license is currently active on this website."
                      : "A license key is saved but not active right now."}
                  </p>
                  <ul className="admin-license-remove-list">
                    <li>Payment gateways, email and live chat settings will lock</li>
                    <li>The key is removed from MongoDB on this server</li>
                    <li>You can activate the same or a new key again anytime</li>
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="admin-license-deactivate-btn"
                      disabled={activating || validating || deactivating}
                      onClick={() => void onDeactivate()}
                    >
                      {deactivating ? "Removing…" : "Remove license key"}
                    </button>
                    {status?.licenseKeyMasked ? (
                      <span className="text-xs text-foreground-muted">
                        Saved key: <span className="font-mono text-rose-200/90">{status.licenseKeyMasked}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

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
                          row.enabled
                            ? status.devBypass
                              ? "text-sky-400"
                              : "text-emerald-400"
                            : "text-foreground-muted"
                        }
                      >
                        {row.enabled
                          ? status.devBypass
                            ? "Dev unlock"
                            : "Enabled"
                          : "Locked"}
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
            <AdminLicenseContactPanel />
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
