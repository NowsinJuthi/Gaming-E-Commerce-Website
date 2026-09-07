"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { memo, useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { EmailSettingsNav } from "@/components/admin/email/EmailSettingsNav";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminLicenseFeatureNotice } from "@/components/admin/AdminLicenseFeatureNotice";
import {
  AdminOrderListCard,
  AdminOrderTwoColumnLayout,
} from "@/components/admin/admin-order-page-shell";
import { EmailSetupGuide } from "@/components/admin/email/EmailSetupGuide";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CartIcon,
  CheckIcon,
  LayersIcon,
  LockIcon,
  MailIcon,
  SendIcon,
  ShieldIcon,
  UsersIcon,
  ZapIcon,
} from "@/components/admin/icons";
import {
  getEmailAdminSettings,
  sendTestEmail,
  updateEmailAdminSettings,
  verifySmtpConnection,
  type EmailSettingsView,
  type EmailSmtpStatus,
  type EmailTestChannel,
  type SmtpProviderOption,
} from "@/lib/api";

const DEFAULT_TEST_EMAIL = "ubsohel@gmail.com";

const TEST_CHANNEL_OPTIONS: { value: EmailTestChannel; label: string }[] = [
  { value: "default", label: "Default (General)" },
  { value: "orders", label: "Orders" },
  { value: "support", label: "Support" },
  { value: "system", label: "System" },
  { value: "admin", label: "Admin" },
];

type SenderTypeKey = "default" | "orders" | "support" | "system" | "admin";

const SENDER_TYPE_OPTIONS: {
  value: SenderTypeKey;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    value: "default",
    label: "Default (Authentication)",
    shortLabel: "Default",
    icon: LockIcon,
  },
  { value: "orders", label: "Orders", shortLabel: "Orders", icon: CartIcon },
  {
    value: "support",
    label: "Support",
    shortLabel: "Support",
    icon: ShieldIcon,
  },
  { value: "system", label: "System", shortLabel: "System", icon: ZapIcon },
  { value: "admin", label: "Admin", shortLabel: "Admin", icon: UsersIcon },
];

function senderInfoText(type: SenderTypeKey): string {
  switch (type) {
    case "default":
      return "Main SMTP username and password for your mail server. Orders, Support, System, and Admin use this account when their own mailbox fields are left blank.";
    case "orders":
      return "Optional separate mailbox for order confirmations, invoices, refunds, and delivery updates. Uses the same SMTP server as Default — only the login changes.";
    case "support":
      return "Optional separate mailbox for welcome, verification, password reset, and contact replies. Uses the same SMTP server as Default — only the login changes.";
    case "system":
      return "Optional separate mailbox for SMTP tests and operational notifications. Uses the same SMTP server as Default — only the login changes.";
    case "admin":
      return "Optional separate mailbox for store admin alerts — new orders, contact form submissions, and similar notifications to your team inbox.";
  }
}

function testChannelLabel(channel: EmailTestChannel): string {
  return TEST_CHANNEL_OPTIONS.find((o) => o.value === channel)?.label ?? channel;
}

const EMPTY: EmailSettingsView = {
  enabled: true,
  mockMode: false,
  orderCustomerEmailsEnabled: true,
  adminOrderAlertEmailsEnabled: true,
  fromName: "",
  fromEmail: "",
  ordersFromName: "",
  ordersFromEmail: "",
  ordersSmtpUser: "",
  ordersReplyTo: "",
  supportFromName: "",
  supportFromEmail: "",
  supportSmtpUser: "",
  supportReplyTo: "",
  systemFromName: "",
  systemFromEmail: "",
  systemSmtpUser: "",
  systemReplyTo: "",
  adminFromName: "",
  adminFromEmail: "",
  adminSmtpUser: "",
  adminReplyTo: "",
  replyTo: "",
  smtpProvider: "custom",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  emailLogoSource: "system",
  logoUrl: "",
  footerText: "",
  primaryColor: "#26BFB0",
};

function settingsFieldsFrom(
  settings: EmailSettingsView,
): Pick<
  EmailSettingsView,
  | "enabled"
  | "mockMode"
  | "orderCustomerEmailsEnabled"
  | "adminOrderAlertEmailsEnabled"
  | "fromName"
  | "fromEmail"
  | "ordersFromName"
  | "ordersFromEmail"
  | "ordersSmtpUser"
  | "ordersReplyTo"
  | "supportFromName"
  | "supportFromEmail"
  | "supportSmtpUser"
  | "supportReplyTo"
  | "systemFromName"
  | "systemFromEmail"
  | "systemSmtpUser"
  | "systemReplyTo"
  | "adminFromName"
  | "adminFromEmail"
  | "adminSmtpUser"
  | "adminReplyTo"
  | "replyTo"
  | "smtpProvider"
  | "smtpHost"
  | "smtpPort"
  | "smtpSecure"
  | "smtpUser"
> {
  return {
    enabled: settings.enabled,
    mockMode: settings.mockMode,
    orderCustomerEmailsEnabled: settings.orderCustomerEmailsEnabled,
    adminOrderAlertEmailsEnabled: settings.adminOrderAlertEmailsEnabled,
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    ordersFromName: settings.ordersFromName,
    ordersFromEmail: settings.ordersFromEmail,
    ordersSmtpUser: settings.ordersSmtpUser,
    ordersReplyTo: settings.ordersReplyTo,
    supportFromName: settings.supportFromName,
    supportFromEmail: settings.supportFromEmail,
    supportSmtpUser: settings.supportSmtpUser,
    supportReplyTo: settings.supportReplyTo,
    systemFromName: settings.systemFromName,
    systemFromEmail: settings.systemFromEmail,
    systemSmtpUser: settings.systemSmtpUser,
    systemReplyTo: settings.systemReplyTo,
    adminFromName: settings.adminFromName,
    adminFromEmail: settings.adminFromEmail,
    adminSmtpUser: settings.adminSmtpUser,
    adminReplyTo: settings.adminReplyTo,
    replyTo: settings.replyTo,
    smtpProvider: settings.smtpProvider,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUser: settings.smtpUser,
  };
}

function formatFromAddress(name: string, email: string): string {
  if (name && email) return `${name} <${email}>`;
  return email || name;
}

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type EmailStatTone = "brand" | "success" | "amber" | "muted";

type EmailOverviewStat = {
  key: string;
  tone: EmailStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function EmailOverviewStats({ items }: { items: EmailOverviewStat[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-email-overview"
      aria-label="Email overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-email-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-email-overview-stat-icon admin-email-overview-stat-icon--${item.tone}`}
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

function normalizeMailbox(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

function parseFromAddress(value: string): { fromName: string; fromEmail: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const [, matchedName, matchedEmail] = match;
    if (matchedName && matchedEmail) {
      return {
        fromName: matchedName.trim(),
        fromEmail: matchedEmail.trim(),
      };
    }
  }
  if (trimmed.includes("@")) {
    return { fromName: "", fromEmail: trimmed };
  }
  return { fromName: trimmed, fromEmail: "" };
}

export default function AdminEmailSettingsPage() {
  const [form, setForm] = useState<EmailSettingsView>(EMPTY);
  const [smtp, setSmtp] = useState<EmailSmtpStatus | null>(null);
  const [providers, setProviders] = useState<SmtpProviderOption[]>([]);
  const [fromAddress, setFromAddress] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [ordersSmtpPass, setOrdersSmtpPass] = useState("");
  const [supportSmtpPass, setSupportSmtpPass] = useState("");
  const [systemSmtpPass, setSystemSmtpPass] = useState("");
  const [adminSmtpPass, setAdminSmtpPass] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState(DEFAULT_TEST_EMAIL);
  const [testChannel, setTestChannel] = useState<EmailTestChannel>("system");
  const [activeSenderType, setActiveSenderType] =
    useState<SenderTypeKey>("default");

  useEffect(() => {
    let active = true;
    getEmailAdminSettings()
      .then((res) => {
        if (!active) return;
        const settings = {
          ...EMPTY,
          ...res.settings,
          smtpPort: res.settings.smtpPort || res.smtp.port || 587,
          smtpHost: res.settings.smtpHost || res.smtp.host,
          smtpSecure: res.settings.smtpSecure ?? res.smtp.secure,
        };
        setForm(settings);
        setFromAddress(
          formatFromAddress(settings.fromName, settings.fromEmail) ||
            res.smtp.fromDisplay,
        );
        setSmtp({
          ...res.smtp,
          orders: res.smtp.orders ?? { hasPassword: false, usernameMasked: "—" },
          support: res.smtp.support ?? { hasPassword: false, usernameMasked: "—" },
          system: res.smtp.system ?? { hasPassword: false, usernameMasked: "—" },
          admin: res.smtp.admin ?? { hasPassword: false, usernameMasked: "—" },
        });
        setProviders(res.providers);
      })
      .catch(() => adminToast("Failed to load email settings.", false))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const parsed = parseFromAddress(fromAddress);
    const displayFrom =
      formatFromAddress(
        parsed.fromName || form.fromName || smtp?.envFromName || "",
        parsed.fromEmail || form.fromEmail || smtp?.envFromEmail || "",
      ) || smtp?.fromDisplay || "—";
    return {
      from: displayFrom,
      host: form.smtpHost || smtp?.host || "—",
      port: form.smtpPort || smtp?.port || "—",
      user: form.smtpUser
        ? `${form.smtpUser.slice(0, 3)}***`
        : smtp?.usernameMasked || "—",
    };
  }, [form, fromAddress, smtp]);

  const fromAddressMismatch = useMemo(() => {
    const parsed = parseFromAddress(fromAddress);
    const fromEmail = (parsed.fromEmail || form.fromEmail).trim().toLowerCase();
    const smtpUser = form.smtpUser.trim().toLowerCase();
    if (!smtpUser.includes("@") || !fromEmail) return false;
    return fromEmail !== smtpUser;
  }, [fromAddress, form.fromEmail, form.smtpUser]);

  const providerOptions = useMemo(
    () =>
      providers.length
        ? providers.map((p) => ({ value: p.id, label: p.label }))
        : [{ value: "custom", label: "Custom SMTP" }],
    [providers],
  );

  const patchForm = useCallback(
    <K extends keyof EmailSettingsView>(key: K, value: EmailSettingsView[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const onProviderChange = useCallback(
    (id: string) => {
      const preset = providers.find((p) => p.id === id);
      setForm((f) => ({
        ...f,
        smtpProvider: id,
        ...(preset && id !== "custom"
          ? {
              smtpHost: preset.host,
              smtpPort: preset.port,
              smtpSecure: preset.secure,
            }
          : {}),
      }));
    },
    [providers],
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    hideAdminToast();
    try {
      const { fromName, fromEmail } = parseFromAddress(fromAddress);
      const smtpUser = form.smtpUser.trim();
      const resolvedFromEmail =
        form.fromEmail.trim() ||
        fromEmail ||
        (smtpUser.includes("@") ? smtpUser : "");
      const patch: Parameters<typeof updateEmailAdminSettings>[0] = {
        ...settingsFieldsFrom(form),
        fromName: form.fromName.trim() || fromName,
        fromEmail: resolvedFromEmail,
      };
      if (smtpPass.trim()) patch.smtpPass = smtpPass.trim();
      if (ordersSmtpPass.trim()) patch.ordersSmtpPass = ordersSmtpPass.trim();
      if (supportSmtpPass.trim()) patch.supportSmtpPass = supportSmtpPass.trim();
      if (systemSmtpPass.trim()) patch.systemSmtpPass = systemSmtpPass.trim();
      if (adminSmtpPass.trim()) patch.adminSmtpPass = adminSmtpPass.trim();
      const res = await updateEmailAdminSettings(patch);
      setForm({
        ...EMPTY,
        ...res.settings,
        smtpPort: res.settings.smtpPort || res.smtp.port || 587,
        smtpHost: res.settings.smtpHost || res.smtp.host,
        smtpSecure: res.settings.smtpSecure ?? res.smtp.secure,
        orderCustomerEmailsEnabled:
          res.settings.orderCustomerEmailsEnabled ?? true,
        adminOrderAlertEmailsEnabled:
          res.settings.adminOrderAlertEmailsEnabled ?? true,
      });
      setSmtp({
        ...res.smtp,
        orders: res.smtp.orders ?? { hasPassword: false, usernameMasked: "—" },
        support: res.smtp.support ?? { hasPassword: false, usernameMasked: "—" },
        system: res.smtp.system ?? { hasPassword: false, usernameMasked: "—" },
        admin: res.smtp.admin ?? { hasPassword: false, usernameMasked: "—" },
      });
      setFromAddress(
        formatFromAddress(res.settings.fromName, res.settings.fromEmail) ||
          res.smtp.fromDisplay,
      );
      setSmtpPass("");
      setOrdersSmtpPass("");
      setSupportSmtpPass("");
      setSystemSmtpPass("");
      setAdminSmtpPass("");
      const savedPasswords =
        smtpPass.trim() ||
        ordersSmtpPass.trim() ||
        supportSmtpPass.trim() ||
        systemSmtpPass.trim() ||
        adminSmtpPass.trim();
      adminToast(
        savedPasswords
          ? "SMTP settings saved. Passwords are stored securely."
          : "SMTP settings saved.",
        true,
      );
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Save failed.",
        false,
      );
    } finally {
      setSaving(false);
    }
  }, [
    fromAddress,
    form,
    smtpPass,
    ordersSmtpPass,
    supportSmtpPass,
    systemSmtpPass,
    adminSmtpPass,
  ]);

  const onVerifyConnection = useCallback(async () => {
    setVerifying(true);
    hideAdminToast();
    try {
      const res = await verifySmtpConnection();
      if (res.verified) {
        adminToast("SMTP connection verified successfully.", true);
      } else {
        adminToast(
          `Connection failed: ${res.error ?? "unknown error"}`,
          false,
        );
      }
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Connection test failed.",
        false,
      );
    } finally {
      setVerifying(false);
    }
  }, []);

  const onTest = useCallback(async () => {
    setTesting(true);
    hideAdminToast();
    try {
      const recipient = testTo.trim() || DEFAULT_TEST_EMAIL;
      const res = await sendTestEmail(recipient, testChannel);
      const channelLabel = testChannelLabel(res.channel ?? testChannel);
      if (!res.verified) {
        adminToast(
          `${channelLabel} SMTP failed: ${res.error ?? "unknown error"}`,
          false,
        );
      } else if (res.sent) {
        adminToast(
          `${channelLabel} test email sent to ${res.to ?? recipient} successfully.`,
          true,
        );
      } else if (res.failed && res.error) {
        adminToast(`Send failed: ${res.error}`, false);
      } else if (res.skipped) {
        adminToast(
          "Send skipped — email disabled, mock mode, or SMTP not configured.",
          false,
        );
      } else {
        adminToast("Send could not be completed.", false);
      }
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Test failed.", false);
    } finally {
      setTesting(false);
    }
  }, [testTo, testChannel]);

  const onSenderTypeChange = useCallback((value: SenderTypeKey) => {
    setActiveSenderType(value);
    setTestChannel(value === "default" ? "system" : value);
  }, []);

  const statsPending = loading;

  const emailOverviewStats = useMemo<EmailOverviewStat[]>(
    () => [
      {
        key: "from",
        tone: "brand",
        icon: <MailIcon className="h-4 w-4" />,
        label: "From",
        value: loadingStat(statsPending, summary.from),
        meta: "Sender identity",
      },
      {
        key: "host",
        tone: smtp?.configured ? "success" : "amber",
        icon: <SendIcon className="h-4 w-4" />,
        label: "SMTP host",
        value: loadingStat(statsPending, summary.host),
        meta: statsPending
          ? "…"
          : smtp?.configured
            ? "Mail server configured"
            : "Not configured",
      },
      {
        key: "port",
        tone: "brand",
        icon: <LayersIcon className="h-4 w-4" />,
        label: "Port",
        value: loadingStat(statsPending, String(summary.port)),
        meta: statsPending
          ? "…"
          : form.smtpSecure
            ? "SSL enabled"
            : "STARTTLS on 587",
      },
      {
        key: "username",
        tone: smtp?.hasPassword ? "success" : "muted",
        icon: <LockIcon className="h-4 w-4" />,
        label: "Username",
        value: loadingStat(statsPending, summary.user),
        meta: statsPending
          ? "…"
          : smtp?.hasPassword
            ? "Authenticated account"
            : "Password not set",
      },
    ],
    [form.smtpSecure, smtp, statsPending, summary],
  );

  return (
    <AdminPageLayout section="Settings" icon={MailIcon}>
      <AdminLicenseFeatureNotice path="/admin/settings/email" />
      <AdminOrderTwoColumnLayout
        main={
          <>
            <AdminOrderListCard
              icon={<MailIcon className="h-4 w-4" />}
              title="Email overview"
              subtitle={
                statsPending
                  ? "Loading SMTP configuration…"
                  : `${smtp?.configured ? "SMTP configured" : "SMTP not configured"} · ${form.mockMode ? "mock mode" : "live sending"}`
              }
              className="admin-email-catalog"
            >
              <EmailOverviewStats items={emailOverviewStats} />

              {!statsPending ? (
                <div className="admin-email-summary flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted">
                  <span>
                    <span className="font-semibold text-foreground">Status</span>{" "}
                    {form.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Mode</span>{" "}
                    {form.mockMode ? "Mock (log only)" : "Live sending"}
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Provider</span>{" "}
                    {form.smtpProvider === "custom"
                      ? "Custom SMTP"
                      : form.smtpProvider || "—"}
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">Password</span>{" "}
                    {smtp?.hasPassword ? "Stored" : "Not set"}
                  </span>
                </div>
              ) : null}

              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Sections</dt>
                <dd>
                  <EmailSettingsNav />
                </dd>
              </div>
            </AdminOrderListCard>

            {statsPending ? (
              <EmailSettingsSkeleton />
            ) : (
              <div className="admin-email-content space-y-5">
                <ProductFormOrderCard
                  icon={<MailIcon className="h-4 w-4" />}
                  title="SMTP configuration"
                  subtitle="Connect your store to a mail provider and define how outgoing emails are sent."
                  className="admin-product-form-section"
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={form.enabled ? "Email enabled" : "Email disabled"}
                          tone={form.enabled ? "emerald" : "amber"}
                        />
                        <StatusBadge
                          label={form.mockMode ? "Mock mode" : "Live sending"}
                          tone={form.mockMode ? "amber" : "teal"}
                        />
                        <StatusBadge
                          label={
                            smtp?.configured ? "SMTP configured" : "SMTP not configured"
                          }
                          tone={smtp?.configured ? "emerald" : "amber"}
                        />
                      </div>
                    }
                  >
                  <div className="admin-email-general-grid">
                    <SettingToggle
                      label="Email enabled"
                      hint="Master SMTP switch — required for any outbound email. Use the toggles below to control customer vs admin order mail separately."
                      checked={form.enabled}
                      onChange={(v) => patchForm("enabled", v)}
                    />
                    <SettingToggle
                      label="Mock mode"
                      hint="Log only — do not send real messages"
                      checked={form.mockMode}
                      onChange={(v) => patchForm("mockMode", v)}
                    />
                    <SettingToggle
                      label="Customer order emails"
                      hint="Send status emails to buyers when an order is Paid, Processing, Completed, Cancelled, or Refunded — not on pending checkout."
                      checked={form.orderCustomerEmailsEnabled}
                      onChange={(v) =>
                        patchForm("orderCustomerEmailsEnabled", v)
                      }
                    />
                    <SettingToggle
                      label="Admin new-order alerts"
                      hint="Email to your team when a pending order is placed (Admin mailbox). Separate from customer emails."
                      checked={form.adminOrderAlertEmailsEnabled}
                      onChange={(v) =>
                        patchForm("adminOrderAlertEmailsEnabled", v)
                      }
                    />
                    <Field label="Default from address">
                      <IconInput icon={MailIcon}>
                        <input
                          value={fromAddress}
                          onChange={(e) => setFromAddress(e.target.value)}
                          placeholder="UniQbd <noreply@uniqbd.com>"
                          className="admin-input w-full"
                        />
                      </IconInput>
                      {fromAddressMismatch ? (
                        <p className="mt-2 text-xs text-amber-300/90">
                          From email should match your SMTP username (
                          {form.smtpUser.trim()}).
                        </p>
                      ) : null}
                    </Field>
                  </div>

                  <div className="admin-email-sender-hub">
                    <div className="admin-email-sender-hub-head">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300/80">
                          Sender accounts
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          Choose a mailbox to configure
                        </p>
                      </div>
                      <SenderTypeTabs
                        value={activeSenderType}
                        onChange={onSenderTypeChange}
                      />
                    </div>

                    <p className="admin-email-sender-hint">
                      {senderInfoText(activeSenderType)}
                    </p>

                    <div className="admin-email-sender-panel">
                      {activeSenderType === "default" ? (
                        <AuthenticationGroup
                          compact
                          smtpUser={form.smtpUser}
                          smtpPass={smtpPass}
                          fromName={form.fromName}
                          fromEmail={form.fromEmail}
                          replyTo={form.replyTo}
                          hasSavedPassword={smtp?.hasPassword ?? false}
                          onSmtpUserChange={(v) => patchForm("smtpUser", v)}
                          onSmtpPassChange={setSmtpPass}
                          onFromNameChange={(v) => {
                            patchForm("fromName", v);
                            setFromAddress(
                              formatFromAddress(v, form.fromEmail),
                            );
                          }}
                          onFromEmailChange={(v) => {
                            const email = normalizeMailbox(v);
                            patchForm("fromEmail", email);
                            setFromAddress(
                              formatFromAddress(form.fromName, email),
                            );
                          }}
                          onReplyToChange={(v) => patchForm("replyTo", v)}
                          replyToPlaceholder="support@uniqbd.com"
                        />
                      ) : null}
                      {activeSenderType === "orders" ? (
                        <SenderAddressGroup
                          compact
                          icon={CartIcon}
                          title="Orders"
                          description="Order confirmations, invoices, refunds, and delivery updates."
                          name={form.ordersFromName}
                          email={form.ordersFromEmail}
                          smtpUser={form.ordersSmtpUser}
                          smtpPass={ordersSmtpPass}
                          hasSavedPassword={smtp?.orders.hasPassword ?? false}
                          onNameChange={(v) => patchForm("ordersFromName", v)}
                          onEmailChange={(v) => patchForm("ordersFromEmail", v)}
                          onSmtpUserChange={(v) => patchForm("ordersSmtpUser", v)}
                          onSmtpPassChange={setOrdersSmtpPass}
                          replyTo={form.ordersReplyTo}
                          onReplyToChange={(v) => patchForm("ordersReplyTo", v)}
                          namePlaceholder="UniQbd Orders"
                          emailPlaceholder="orders@uniqbd.com"
                          smtpUserPlaceholder="orders@uniqbd.com"
                          replyToPlaceholder="orders@uniqbd.com"
                        />
                      ) : null}
                      {activeSenderType === "support" ? (
                        <SenderAddressGroup
                          compact
                          icon={ShieldIcon}
                          title="Support"
                          description="Welcome, verification, password reset, and contact replies."
                          name={form.supportFromName}
                          email={form.supportFromEmail}
                          smtpUser={form.supportSmtpUser}
                          smtpPass={supportSmtpPass}
                          hasSavedPassword={smtp?.support.hasPassword ?? false}
                          onNameChange={(v) => patchForm("supportFromName", v)}
                          onEmailChange={(v) => patchForm("supportFromEmail", v)}
                          onSmtpUserChange={(v) => patchForm("supportSmtpUser", v)}
                          onSmtpPassChange={setSupportSmtpPass}
                          replyTo={form.supportReplyTo}
                          onReplyToChange={(v) => patchForm("supportReplyTo", v)}
                          namePlaceholder="UniQbd Support"
                          emailPlaceholder="support@uniqbd.com"
                          smtpUserPlaceholder="support@uniqbd.com"
                          replyToPlaceholder="support@uniqbd.com"
                        />
                      ) : null}
                      {activeSenderType === "system" ? (
                        <SenderAddressGroup
                          compact
                          icon={ZapIcon}
                          title="System"
                          description="SMTP tests and other operational notifications."
                          name={form.systemFromName}
                          email={form.systemFromEmail}
                          smtpUser={form.systemSmtpUser}
                          smtpPass={systemSmtpPass}
                          hasSavedPassword={smtp?.system.hasPassword ?? false}
                          onNameChange={(v) => patchForm("systemFromName", v)}
                          onEmailChange={(v) => patchForm("systemFromEmail", v)}
                          onSmtpUserChange={(v) => patchForm("systemSmtpUser", v)}
                          onSmtpPassChange={setSystemSmtpPass}
                          replyTo={form.systemReplyTo}
                          onReplyToChange={(v) => patchForm("systemReplyTo", v)}
                          namePlaceholder="UniQbd System"
                          emailPlaceholder="no-reply@uniqbd.com"
                          smtpUserPlaceholder="no-reply@uniqbd.com"
                          replyToPlaceholder="support@uniqbd.com"
                        />
                      ) : null}
                      {activeSenderType === "admin" ? (
                        <SenderAddressGroup
                          compact
                          icon={UsersIcon}
                          title="Admin"
                          description="New order alerts, contact form notifications, and other team inbox emails."
                          name={form.adminFromName}
                          email={form.adminFromEmail}
                          smtpUser={form.adminSmtpUser}
                          smtpPass={adminSmtpPass}
                          hasSavedPassword={smtp?.admin.hasPassword ?? false}
                          onNameChange={(v) => patchForm("adminFromName", v)}
                          onEmailChange={(v) => patchForm("adminFromEmail", v)}
                          onSmtpUserChange={(v) => patchForm("adminSmtpUser", v)}
                          onSmtpPassChange={setAdminSmtpPass}
                          replyTo={form.adminReplyTo}
                          onReplyToChange={(v) => patchForm("adminReplyTo", v)}
                          namePlaceholder="UniQbd Admin"
                          emailPlaceholder="admin@uniqbd.com"
                          smtpUserPlaceholder="admin@uniqbd.com"
                          replyToPlaceholder="admin@uniqbd.com"
                        />
                      ) : null}
                    </div>

                    <div className="admin-email-sender-divider">
                      <span className="admin-email-sender-divider-label">
                        <LayersIcon className="h-3.5 w-3.5" />
                        Shared SMTP server
                      </span>
                    </div>

                    <div className="admin-email-smtp-grid">
                      <Field label="SMTP provider">
                        <AdminSelect
                          value={form.smtpProvider}
                          onChange={onProviderChange}
                          className="w-full"
                          options={providerOptions}
                        />
                      </Field>
                      <Field label="SMTP host">
                        <IconInput icon={AtIcon}>
                          <input
                            value={form.smtpHost}
                            onChange={(e) => patchForm("smtpHost", e.target.value)}
                            placeholder="smtp.example.com"
                            className="admin-input w-full"
                          />
                        </IconInput>
                      </Field>
                      <Field label="Port">
                        <IconInput icon={HashIcon}>
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={form.smtpPort || ""}
                            onChange={(e) => {
                              const port = Number(e.target.value) || 0;
                              setForm((f) => ({
                                ...f,
                                smtpPort: port,
                                smtpSecure: port === 465,
                              }));
                            }}
                            placeholder="587"
                            className="admin-input w-full"
                          />
                        </IconInput>
                      </Field>
                      <div className="flex items-end">
                        <SettingToggle
                          label="Use SSL (port 465)"
                          hint="Port 587 uses STARTTLS automatically"
                          checked={form.smtpSecure}
                          onChange={(v) => {
                            setForm((f) => ({
                              ...f,
                              smtpSecure: v,
                              smtpPort: v ? 465 : f.smtpPort === 465 ? 587 : f.smtpPort,
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  </ProductFormOrderCard>

                  <ProductFormOrderCard
                    title="Save settings"
                    subtitle="Changes apply to all outgoing store emails after saving."
                    className="admin-product-form-section admin-email-save"
                  >
                    <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                      <dt>Apply changes</dt>
                      <dd className="admin-product-form-sidebar-fields">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-foreground-muted">
                            Changes apply to all outgoing store emails after saving.
                          </p>
                          <button
                            type="button"
                            onClick={() => void onSave()}
                            disabled={saving}
                            className="btn-primary disabled:opacity-50"
                          >
                            {saving ? "Saving…" : "Save settings"}
                          </button>
                        </div>
                      </dd>
                    </div>
                  </ProductFormOrderCard>
              </div>
            )}

            {!statsPending ? <EmailSetupGuide /> : null}
          </>
        }
        sidebar={
          statsPending ? null : (
            <>
              <DeliveryToolsCard
                testTo={testTo}
                testChannel={testChannel}
                onTestToChange={setTestTo}
                onTestChannelChange={setTestChannel}
                recipientPlaceholder={DEFAULT_TEST_EMAIL}
                verifying={verifying}
                testing={testing}
                onVerifyConnection={() => void onVerifyConnection()}
                onSendTest={() => void onTest()}
              />

              <ConnectionStatusCard smtp={smtp} form={form} />
            </>
          )
        }
      />
    </AdminPageLayout>
  );
}

const StatusBadge = memo(function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "emerald" | "amber" | "teal";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
        : "border-teal-500/25 bg-teal-500/10 text-teal-200";

  return (
    <span className={`admin-email-status ${cls}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tone === "emerald"
            ? "bg-emerald-400"
            : tone === "amber"
              ? "bg-amber-400"
              : "bg-teal-400"
        }`}
      />
      {label}
    </span>
  );
});

const ConnectionStatusCard = memo(function ConnectionStatusCard({
  smtp,
  form,
}: {
  smtp: EmailSmtpStatus | null;
  form: EmailSettingsView;
}) {
  const rows = useMemo(
    () => [
      {
        label: "Provider",
        value:
          form.smtpProvider === "custom"
            ? "Custom SMTP"
            : form.smtpProvider || "—",
      },
      { label: "Host", value: form.smtpHost || smtp?.host || "Not set" },
      {
        label: "Encryption",
        value: form.smtpSecure ? "SSL (465)" : "STARTTLS (587)",
      },
      {
        label: "Password",
        value: smtp?.hasPassword ? "Stored securely" : "Not configured",
      },
    ],
    [form.smtpHost, form.smtpProvider, form.smtpSecure, smtp?.hasPassword, smtp?.host],
  );

  return (
    <ProductFormOrderCard
      icon={<SendIcon className="h-4 w-4" />}
      title="Connection summary"
      subtitle="Quick view of your current SMTP setup."
      className="admin-product-form-section admin-email-side-card"
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="admin-order-view-detail-row admin-order-view-detail-row--stacked"
        >
          <dt>{row.label}</dt>
          <dd className="truncate text-sm font-medium text-foreground">
            {row.value}
          </dd>
        </div>
      ))}
    </ProductFormOrderCard>
  );
});

const DeliveryToolsCard = memo(function DeliveryToolsCard({
  testTo,
  testChannel,
  onTestToChange,
  onTestChannelChange,
  recipientPlaceholder,
  verifying,
  testing,
  onVerifyConnection,
  onSendTest,
}: {
  testTo: string;
  testChannel: EmailTestChannel;
  onTestToChange: (value: string) => void;
  onTestChannelChange: (value: EmailTestChannel) => void;
  recipientPlaceholder: string;
  verifying: boolean;
  testing: boolean;
  onVerifyConnection: () => void;
  onSendTest: () => void;
}) {
  return (
    <ProductFormOrderCard
      icon={<SendIcon className="h-4 w-4" />}
      title="Delivery tools"
      subtitle="Verify connection and send a test email."
      className="admin-product-form-section admin-email-side-card"
    >
      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Verify SMTP</dt>
        <dd className="admin-product-form-sidebar-fields space-y-3">
          <p className="text-xs leading-relaxed text-foreground-muted">
            Save your settings first, then test the server connection.
          </p>
          <button
            type="button"
            onClick={onVerifyConnection}
            disabled={verifying}
            className="dashboard-pro-btn-ghost inline-flex w-full items-center justify-center gap-1.5 text-xs disabled:opacity-50"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {verifying ? "Testing…" : "Test connection"}
          </button>
        </dd>
      </div>

      <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
        <dt>Send test email</dt>
        <dd className="admin-product-form-sidebar-fields space-y-3">
          <p className="text-xs leading-relaxed text-foreground-muted">
            Pick a sender type to test its mailbox and From address. Default
            recipient is {DEFAULT_TEST_EMAIL}.
          </p>
          <Field label="Sender type">
            <AdminSelect
              value={testChannel}
              onChange={(v) => onTestChannelChange(v as EmailTestChannel)}
              className="w-full"
              options={TEST_CHANNEL_OPTIONS}
            />
          </Field>
          <Field label="Recipient (optional)">
            <input
              type="email"
              value={testTo}
              onChange={(e) => onTestToChange(e.target.value)}
              placeholder={recipientPlaceholder}
              className="admin-input w-full"
            />
          </Field>
          <button
            type="button"
            onClick={onSendTest}
            disabled={testing}
            className="btn-primary w-full disabled:opacity-50"
          >
            {testing ? "Sending…" : "Send test email"}
          </button>
        </dd>
      </div>
    </ProductFormOrderCard>
  );
});

const SenderTypeTabs = memo(function SenderTypeTabs({
  value,
  onChange,
}: {
  value: SenderTypeKey;
  onChange: (value: SenderTypeKey) => void;
}) {
  return (
    <div className="admin-email-sender-tabs" role="tablist" aria-label="Sender type">
      {SENDER_TYPE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`admin-email-sender-tab${active ? " is-active" : ""}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden">{option.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
});

const SavedPasswordInput = memo(function SavedPasswordInput({
  value,
  onChange,
  hasSavedPassword,
  emptyPlaceholder = "Password for this mailbox",
}: {
  value: string;
  onChange: (value: string) => void;
  hasSavedPassword: boolean;
  emptyPlaceholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const showSavedPreview = hasSavedPassword && !editing && !value.trim();

  if (showSavedPreview) {
    return (
      <div className="space-y-2">
        <div className="admin-input flex items-center gap-2 px-3 py-2.5">
          <LockIcon className="h-4 w-4 shrink-0 text-foreground-muted" />
          <span className="tracking-[0.2em] text-foreground">••••••••••</span>
          <span className="ml-auto rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Saved
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] font-medium text-teal-300 hover:text-teal-200"
        >
          Change password
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <IconInput icon={LockIcon}>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasSavedPassword ? "New password" : emptyPlaceholder}
          className="admin-input w-full"
          autoComplete="new-password"
          autoFocus={editing}
        />
      </IconInput>
      {hasSavedPassword ? (
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            onChange("");
          }}
          className="text-[11px] text-foreground-muted hover:text-foreground"
        >
          Keep saved password
        </button>
      ) : null}
    </div>
  );
});

const AuthenticationGroup = memo(function AuthenticationGroup({
  compact = false,
  smtpUser,
  smtpPass,
  fromName,
  fromEmail,
  replyTo,
  hasSavedPassword,
  onSmtpUserChange,
  onSmtpPassChange,
  onFromNameChange,
  onFromEmailChange,
  onReplyToChange,
  replyToPlaceholder = "support@uniqbd.com",
}: {
  compact?: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  hasSavedPassword: boolean;
  onSmtpUserChange: (value: string) => void;
  onSmtpPassChange: (value: string) => void;
  onFromNameChange: (value: string) => void;
  onFromEmailChange: (value: string) => void;
  onReplyToChange: (value: string) => void;
  replyToPlaceholder?: string;
}) {
  return (
    <div className={compact ? "space-y-4" : "admin-email-inset space-y-3"}>
      {!compact ? (
        <div className="flex items-start gap-3">
          <span className="admin-email-section-icon !h-9 !w-9">
            <LockIcon className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Authentication</h4>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Default credentials used to authenticate with your mail provider.
            </p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="SMTP username">
          <IconInput icon={AtIcon}>
            <input
              value={smtpUser}
              onChange={(e) => onSmtpUserChange(e.target.value)}
              placeholder="noreply@uniqbd.com"
              className="admin-input w-full"
              autoComplete="off"
            />
          </IconInput>
          <p className="mt-1.5 text-[11px] text-foreground-muted">
            Usually your full email address for the default mailbox.
          </p>
        </Field>
        <Field label="SMTP password">
          <SavedPasswordInput
            value={smtpPass}
            onChange={onSmtpPassChange}
            hasSavedPassword={hasSavedPassword}
            emptyPlaceholder="Password"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="From email address">
          <IconInput icon={MailIcon}>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => onFromEmailChange(e.target.value)}
              onBlur={(e) => onFromEmailChange(normalizeMailbox(e.target.value))}
              placeholder="noreply@uniqbd.com"
              className="admin-input w-full"
              autoComplete="off"
            />
          </IconInput>
        </Field>
        <Field label="From name (optional)">
          <input
            value={fromName}
            onChange={(e) => onFromNameChange(e.target.value)}
            placeholder="UniQbd"
            className="admin-input w-full"
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="Reply-to email">
        <IconInput icon={AtIcon}>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => onReplyToChange(e.target.value)}
            onBlur={(e) => onReplyToChange(normalizeMailbox(e.target.value))}
            placeholder={replyToPlaceholder}
            className="admin-input w-full"
            autoComplete="off"
          />
        </IconInput>
        <p className="mt-1.5 text-[11px] text-foreground-muted">
          Default reply address for all email types when they do not set their own.
        </p>
      </Field>
    </div>
  );
});

const SenderAddressGroup = memo(function SenderAddressGroup({
  compact = false,
  icon: Icon,
  title,
  description,
  name,
  email,
  smtpUser,
  smtpPass,
  replyTo,
  hasSavedPassword,
  onNameChange,
  onEmailChange,
  onSmtpUserChange,
  onSmtpPassChange,
  onReplyToChange,
  namePlaceholder,
  emailPlaceholder,
  smtpUserPlaceholder,
  replyToPlaceholder,
}: {
  compact?: boolean;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  name: string;
  email: string;
  smtpUser: string;
  smtpPass: string;
  replyTo: string;
  hasSavedPassword: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSmtpUserChange: (value: string) => void;
  onSmtpPassChange: (value: string) => void;
  onReplyToChange: (value: string) => void;
  namePlaceholder: string;
  emailPlaceholder: string;
  smtpUserPlaceholder: string;
  replyToPlaceholder: string;
}) {
  return (
    <div className={compact ? "space-y-4" : "admin-email-inset space-y-3"}>
      {!compact ? (
        <div className="flex items-start gap-3">
          <span className="admin-email-section-icon !h-9 !w-9">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            <p className="mt-0.5 text-xs text-foreground-muted">{description}</p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Sender name">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={namePlaceholder}
            className="admin-input w-full"
            autoComplete="off"
          />
          {name.includes("@") ? (
            <p className="mt-1.5 text-[11px] text-amber-300/90">
              Use a display name here (e.g. UniQbd System), not an email address.
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-foreground-muted">
              Display name only — not an email address.
            </p>
          )}
        </Field>
        <Field label="From email">
          <IconInput icon={MailIcon}>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              onBlur={(e) => onEmailChange(normalizeMailbox(e.target.value))}
              placeholder={emailPlaceholder}
              className="admin-input w-full"
              autoComplete="off"
            />
          </IconInput>
          <p className="mt-1.5 text-[11px] text-foreground-muted">
            Shown in the From header. Use lowercase, e.g. system@uniqbd.com
          </p>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Mailbox username (optional)">
          <IconInput icon={AtIcon}>
            <input
              type="email"
              value={smtpUser}
              onChange={(e) => onSmtpUserChange(e.target.value)}
              onBlur={(e) => onSmtpUserChange(normalizeMailbox(e.target.value))}
              placeholder={smtpUserPlaceholder}
              className="admin-input w-full"
              autoComplete="off"
            />
          </IconInput>
          <p className="mt-1.5 text-[11px] text-foreground-muted">
            Must match a real email account in hosting. Leave blank to use Default login.
          </p>
        </Field>
        <Field label="Mailbox password (optional)">
          <SavedPasswordInput
            value={smtpPass}
            onChange={onSmtpPassChange}
            hasSavedPassword={hasSavedPassword}
          />
          {smtpUser.trim() && !hasSavedPassword && !smtpPass.trim() ? (
            <p className="mt-1.5 text-[11px] text-amber-300/90">
              Mailbox username is set but no password is saved. Enter the password
              and click Save settings before sending a test.
            </p>
          ) : null}
        </Field>
      </div>
      <Field label="Reply-to email">
        <IconInput icon={AtIcon}>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => onReplyToChange(e.target.value)}
            onBlur={(e) => onReplyToChange(normalizeMailbox(e.target.value))}
            placeholder={replyToPlaceholder}
            className="admin-input w-full"
            autoComplete="off"
          />
        </IconInput>
        <p className="mt-1.5 text-[11px] text-foreground-muted">
          Where customer replies go for this email type. Leave blank to use the default reply-to.
        </p>
      </Field>
    </div>
  );
});

const SettingToggle = memo(function SettingToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="admin-email-toggle">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-foreground-muted">{hint}</p>
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
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
});

const Field = memo(function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="admin-filter-label">{label}</label>
      {children}
    </div>
  );
});

const IconInput = memo(function IconInput({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="admin-input-icon-wrap">
      <Icon className="admin-input-icon" />
      {children}
    </div>
  );
});

function EmailSettingsSkeleton() {
  return (
    <ProductFormOrderCard
      title="Loading email settings"
      subtitle="Fetching SMTP configuration…"
      className="admin-product-form-section"
    >
      <div className="dashboard-pro-empty py-8">
        <p className="text-sm text-subtle">Loading…</p>
      </div>
    </ProductFormOrderCard>
  );
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16" />
    </svg>
  );
}

function AtIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}
