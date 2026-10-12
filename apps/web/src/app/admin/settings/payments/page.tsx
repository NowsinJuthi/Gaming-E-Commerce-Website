"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AdminOrderListCard,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminLicenseFeatureNotice } from "@/components/admin/AdminLicenseFeatureNotice";
import { AdminMfsGatewaysPanel } from "@/components/admin/AdminMfsGatewaysPanel";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  CheckIcon,
  CreditCardIcon,
  DollarIcon,
  PulseIcon,
  WalletIcon,
} from "@/components/admin/icons";
import {
  getCustomerPanelAdminSettings,
  getPaymentGatewayOverview,
  getPaymentGatewaySettings,
  updateCustomerPanelSettings,
  updatePaymentGatewaySettings,
  type CustomerPanelConfig,
  type PaymentGatewayId,
  type PaymentGatewayMode,
  type PaymentGatewayOverview,
  type PaymentGatewaySettings,
  type PaymentGatewaySettingsView,
} from "@/lib/api";
import {
  CHECKOUT_PAYMENT_METHOD_OPTIONS,
  countEnabledCheckoutMethods,
  movePaymentMethodOrder,
  normalizePaymentMethodOrder,
} from "@/lib/checkout-payment-methods";

type PaymentsTab = "online" | "mfs";

const PAYMENTS_TABS: Array<{ id: PaymentsTab; label: string }> = [
  { id: "online", label: "Online gateways" },
  { id: "mfs", label: "MFS gateways" },
];

function paymentsTabFromSearchParam(value: string | null): PaymentsTab {
  return value === "mfs" ? "mfs" : "online";
}

type CheckoutMethodFlags = CustomerPanelConfig["checkout"];

function normalizeCheckoutMethods(
  checkout: Partial<CheckoutMethodFlags> | null | undefined,
): CheckoutMethodFlags {
  return {
    walletEnabled: checkout?.walletEnabled !== false,
    gatewayEnabled: checkout?.gatewayEnabled !== false,
    manualEnabled: checkout?.manualEnabled !== false,
    gatewayLabel: checkout?.gatewayLabel?.trim() || "bKash / Nagad",
    gatewaySubtitle:
      checkout?.gatewaySubtitle?.trim() || "Pay Money And Verify With TrxID",
    paymentMethodOrder: normalizePaymentMethodOrder(checkout?.paymentMethodOrder),
    allowGuestCheckout: checkout?.allowGuestCheckout === true,
    allowGuestChat: checkout?.allowGuestChat === true,
  };
}

function mergeCheckoutMethods(
  previous: CheckoutMethodFlags,
  patch: Partial<CheckoutMethodFlags> | null | undefined,
): CheckoutMethodFlags {
  if (!patch) return previous;
  const next: CheckoutMethodFlags = { ...previous };
  if (patch.walletEnabled !== undefined) {
    next.walletEnabled = patch.walletEnabled !== false;
  }
  if (patch.gatewayEnabled !== undefined) {
    next.gatewayEnabled = patch.gatewayEnabled !== false;
  }
  if (patch.manualEnabled !== undefined) {
    next.manualEnabled = patch.manualEnabled !== false;
  }
  if (patch.allowGuestCheckout !== undefined) {
    next.allowGuestCheckout = patch.allowGuestCheckout === true;
  }
  if (patch.allowGuestChat !== undefined) {
    next.allowGuestChat = patch.allowGuestChat === true;
  }
  if (patch.gatewayLabel !== undefined && patch.gatewayLabel.trim()) {
    next.gatewayLabel = patch.gatewayLabel.trim();
  }
  if (patch.gatewaySubtitle !== undefined && patch.gatewaySubtitle.trim()) {
    next.gatewaySubtitle = patch.gatewaySubtitle.trim();
  }
  if (patch.paymentMethodOrder !== undefined) {
    next.paymentMethodOrder = normalizePaymentMethodOrder(patch.paymentMethodOrder);
  }
  return next;
}

const GATEWAY_IDS: PaymentGatewayId[] = [
  "bkash",
  "nagad",
  "rocket",
  "upay",
  "uddoktapay",
];

const GATEWAY_LABELS: Record<PaymentGatewayId, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  upay: "Upay",
  uddoktapay: "UddoktaPay",
};

const DEFAULT_GATEWAY_OPTIONS = GATEWAY_IDS.map((id) => ({
  value: id,
  label: GATEWAY_LABELS[id],
}));

type GatewayForm = {
  enabled: boolean;
  sandbox: boolean;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  username: string;
  password: string;
};

const EMPTY_GATEWAY_FORM: GatewayForm = {
  enabled: true,
  sandbox: false,
  baseUrl: "",
  apiKey: "",
  apiSecret: "",
  webhookSecret: "",
  username: "",
  password: "",
};

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

type PaymentStatTone = "brand" | "success" | "amber" | "muted";

type PaymentOverviewStat = {
  key: string;
  tone: PaymentStatTone;
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
};

function PaymentOverviewStats({ items }: { items: PaymentOverviewStat[] }) {
  return (
    <section
      className="customer-dashboard-overview-section admin-payments-overview-stats"
      aria-label="Payment overview stats"
    >
      <dl className="customer-dashboard-overview-stats">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={`customer-dashboard-overview-stat customer-dashboard-overview-stat--${item.tone} cursor-default admin-payments-overview-stat`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span
              className="customer-dashboard-overview-stat-glow"
              aria-hidden
            />
            <span
              className={`customer-dashboard-overview-stat-icon admin-payments-overview-stat-icon admin-payments-overview-stat-icon--${item.tone}`}
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

const PaymentOverviewSwitch = memo(function PaymentOverviewSwitch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="admin-payments-setting-row">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-foreground-muted">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`admin-customer-panel-switch${
          checked ? " admin-customer-panel-switch--on" : ""
        } disabled:opacity-50`}
      >
        <span className="admin-customer-panel-switch-thumb" />
      </button>
    </div>
  );
});

type PaymentMethodOptionProps = {
  value: (typeof CHECKOUT_PAYMENT_METHOD_OPTIONS)[number]["value"];
  title: string;
  subtitle?: string;
  checked: boolean;
  disabled?: boolean;
  reorderDisabledUp?: boolean;
  reorderDisabledDown?: boolean;
  reorderBusy?: boolean;
  onToggle: (checked: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

const PaymentMethodOption = memo(function PaymentMethodOption({
  title,
  subtitle,
  checked,
  disabled,
  reorderDisabledUp,
  reorderDisabledDown,
  reorderBusy,
  onToggle,
  onMoveUp,
  onMoveDown,
}: PaymentMethodOptionProps) {
  return (
    <div className="admin-payments-method-item">
      <div className="admin-payments-method-reorder">
        <button
          type="button"
          className="admin-payments-method-reorder-btn"
          disabled={disabled || reorderBusy || reorderDisabledUp}
          aria-label={`Move ${title} up`}
          onClick={onMoveUp}
        >
          ↑
        </button>
        <button
          type="button"
          className="admin-payments-method-reorder-btn"
          disabled={disabled || reorderBusy || reorderDisabledDown}
          aria-label={`Move ${title} down`}
          onClick={onMoveDown}
        >
          ↓
        </button>
      </div>
      <div className="admin-payments-method-copy min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-subtle">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Enable ${title}`}
        disabled={disabled}
        onClick={() => onToggle(!checked)}
        className={`admin-customer-panel-switch${
          checked ? " admin-customer-panel-switch--on" : ""
        } disabled:opacity-50`}
      >
        <span className="admin-customer-panel-switch-thumb" />
      </button>
    </div>
  );
});

function effectiveMode(
  form: GatewayForm,
  meta: PaymentGatewaySettingsView | undefined,
): PaymentGatewayMode {
  if (!form.enabled) return "disabled";
  if (meta?.mode === "misconfigured") return "misconfigured";
  if (meta?.mode) return meta.mode;
  if (form.sandbox) return "sandbox";
  return "live";
}

function modeStatusClass(mode: PaymentGatewayMode) {
  if (mode === "live") return "dashboard-pro-status dashboard-pro-status--green";
  if (mode === "sandbox") return "dashboard-pro-status dashboard-pro-status--amber";
  if (mode === "misconfigured") return "dashboard-pro-status text-red-400";
  return "dashboard-pro-status";
}

function secretPlaceholder(hasValue: boolean, fromEnv: boolean) {
  if (hasValue && fromEnv) return "Stored in environment (.env)";
  if (hasValue) return "Saved — leave blank to keep";
  return "";
}

function buildForms(settings: PaymentGatewaySettings | null) {
  const forms = {} as Record<PaymentGatewayId, GatewayForm>;
  for (const id of GATEWAY_IDS) {
    const gateway = settings?.gateways.find((row) => row.id === id);
    forms[id] = {
      ...EMPTY_GATEWAY_FORM,
      enabled: gateway?.enabled ?? true,
      sandbox: gateway?.sandbox ?? false,
      baseUrl: gateway?.baseUrl ?? "",
    };
  }
  return forms;
}

function mergeFormsAfterSave(
  id: PaymentGatewayId,
  updated: PaymentGatewaySettings,
  current: Record<PaymentGatewayId, GatewayForm>,
) {
  const next = { ...current };
  for (const gatewayId of GATEWAY_IDS) {
    const gateway = updated.gateways.find((row) => row.id === gatewayId);
    if (gatewayId === id) {
      next[gatewayId] = {
        ...EMPTY_GATEWAY_FORM,
        enabled: gateway?.enabled ?? true,
        sandbox: gateway?.sandbox ?? false,
        baseUrl: gateway?.baseUrl ?? "",
      };
    } else {
      next[gatewayId] = {
        ...current[gatewayId],
        enabled: gateway?.enabled ?? current[gatewayId].enabled,
        sandbox: gateway?.sandbox ?? current[gatewayId].sandbox,
        baseUrl: gateway?.baseUrl ?? current[gatewayId].baseUrl,
      };
    }
  }
  return next;
}

function overviewFromSettings(
  settings: PaymentGatewaySettings,
  prev: PaymentGatewayOverview | null,
): PaymentGatewayOverview {
  const gateways = (settings.gateways ?? []).map((gateway) => ({
    id: gateway.id,
    label: gateway.label,
    enabled: gateway.enabled,
    configured: gateway.configured,
    sandbox: gateway.sandbox,
    mode: gateway.mode,
  }));
  return {
    callbackBaseUrl: settings.callbackBaseUrl,
    appUrl: settings.appUrl,
    defaultGateway: settings.defaultGateway,
    configuredCount: gateways.filter((row) => row.configured).length,
    enabledCount: gateways.filter((row) => row.enabled).length,
    liveCount: gateways.filter((row) => row.mode === "live").length,
    intents24h: prev?.intents24h ?? 0,
    succeeded24h: prev?.succeeded24h ?? 0,
    failed24h: prev?.failed24h ?? 0,
    gateways,
  };
}

function fieldLabels(id: PaymentGatewayId) {
  if (id === "bkash") {
    return {
      apiKey: "App key",
      apiSecret: "App secret",
      username: "Username",
      password: "Password",
    };
  }
  if (id === "nagad") {
    return {
      apiKey: "Merchant ID",
      apiSecret: "Private key",
    };
  }
  if (id === "uddoktapay") {
    return {
      apiKey: "API key",
    };
  }
  return {
    apiKey: "API key",
    apiSecret: "API secret",
  };
}

type GatewayFormPanelProps = {
  id: PaymentGatewayId;
  meta: PaymentGatewaySettingsView | undefined;
  form: GatewayForm;
  loading: boolean;
  saving: boolean;
  onPatch: (id: PaymentGatewayId, patch: Partial<GatewayForm>) => void;
  onToggle: (
    id: PaymentGatewayId,
    patch: Pick<GatewayForm, "enabled" | "sandbox">,
  ) => void;
  onSave: (id: PaymentGatewayId) => void;
};

const GatewayFormPanel = memo(function GatewayFormPanel({
  id,
  meta,
  form,
  loading,
  saving,
  onPatch,
  onToggle,
  onSave,
}: GatewayFormPanelProps) {
  const labels = fieldLabels(id);
  const mode = effectiveMode(form, meta);
  const title = meta?.label ?? GATEWAY_LABELS[id];

  return (
    <form
      className="h-full min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(id);
      }}
    >
      <ProductFormOrderCard
        icon={<CreditCardIcon className="h-4 w-4" />}
        title={title}
        subtitle={meta?.hint ?? "Payment gateway credentials."}
        action={
          <span className={`capitalize ${modeStatusClass(mode)}`}>{mode}</span>
        }
        className="admin-product-form-section admin-payment-gateways-form h-full"
      >
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Visibility</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-foreground-muted">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  disabled={saving || loading}
                  onChange={(event) =>
                    onToggle(id, { enabled: event.target.checked, sandbox: form.sandbox })
                  }
                />
                Enabled at checkout
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground-muted">
                <input
                  type="checkbox"
                  checked={form.sandbox}
                  disabled={saving || loading}
                  onChange={(event) =>
                    onToggle(id, { enabled: form.enabled, sandbox: event.target.checked })
                  }
                />
                Force sandbox mode
              </label>
            </div>
          </dd>
        </div>

        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Credentials</dt>
          <dd className="admin-product-form-sidebar-fields space-y-4">
            <div>
              <label htmlFor={`${id}-base-url`} className={labelCls}>
                Base URL
              </label>
              <input
                id={`${id}-base-url`}
                value={form.baseUrl}
                onChange={(event) => onPatch(id, { baseUrl: event.target.value })}
                placeholder="https://…"
                className={inputCls}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-api-key`} className={labelCls}>
                  {labels.apiKey ?? "API key"}
                </label>
                <input
                  id={`${id}-api-key`}
                  value={form.apiKey}
                  onChange={(event) => onPatch(id, { apiKey: event.target.value })}
                  placeholder={secretPlaceholder(
                    meta?.hasApiKey ?? false,
                    meta?.apiKeyFromEnv ?? false,
                  )}
                  className={inputCls}
                />
              </div>
              {"apiSecret" in labels ? (
                <div>
                  <label htmlFor={`${id}-api-secret`} className={labelCls}>
                    {labels.apiSecret}
                  </label>
                  <input
                    id={`${id}-api-secret`}
                    value={form.apiSecret}
                    onChange={(event) => onPatch(id, { apiSecret: event.target.value })}
                    placeholder={secretPlaceholder(
                      meta?.hasApiSecret ?? false,
                      meta?.apiSecretFromEnv ?? false,
                    )}
                    className={inputCls}
                  />
                </div>
              ) : null}
            </div>

            {id === "bkash" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${id}-username`} className={labelCls}>
                    Username
                  </label>
                  <input
                    id={`${id}-username`}
                    value={form.username}
                    onChange={(event) => onPatch(id, { username: event.target.value })}
                    placeholder={secretPlaceholder(
                      meta?.hasUsername ?? false,
                      meta?.usernameFromEnv ?? false,
                    )}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor={`${id}-password`} className={labelCls}>
                    Password
                  </label>
                  <input
                    id={`${id}-password`}
                    type="password"
                    value={form.password}
                    onChange={(event) => onPatch(id, { password: event.target.value })}
                    placeholder={secretPlaceholder(
                      meta?.hasPassword ?? false,
                      meta?.passwordFromEnv ?? false,
                    )}
                    className={inputCls}
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label htmlFor={`${id}-webhook-secret`} className={labelCls}>
                Webhook secret
              </label>
              <input
                id={`${id}-webhook-secret`}
                value={form.webhookSecret}
                onChange={(event) => onPatch(id, { webhookSecret: event.target.value })}
                placeholder={secretPlaceholder(
                  meta?.hasWebhookSecret ?? false,
                  meta?.webhookSecretFromEnv ?? false,
                )}
                className={inputCls}
              />
            </div>
          </dd>
        </div>

        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Save</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="flex flex-wrap justify-end gap-2.5">
              <button
                type="submit"
                disabled={saving || loading}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? "Saving…" : `Save ${title}`}
              </button>
            </div>
          </dd>
        </div>
      </ProductFormOrderCard>
    </form>
  );
});

export default function AdminPaymentGatewaysPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<PaymentsTab>(() =>
    paymentsTabFromSearchParam(searchParams.get("tab")),
  );
  const [overview, setOverview] = useState<PaymentGatewayOverview | null>(null);
  const [settings, setSettings] = useState<PaymentGatewaySettings | null>(null);
  const [forms, setForms] = useState<Record<PaymentGatewayId, GatewayForm>>(() =>
    buildForms(null),
  );
  const [defaultGateway, setDefaultGateway] =
    useState<PaymentGatewayId>("uddoktapay");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingGateway, setSavingGateway] = useState<PaymentGatewayId | null>(
    null,
  );
  const [savingDefault, setSavingDefault] = useState(false);
  const [checkoutMethods, setCheckoutMethods] = useState<CheckoutMethodFlags>({
    walletEnabled: true,
    gatewayEnabled: true,
    manualEnabled: true,
    gatewayLabel: "bKash / Nagad",
    gatewaySubtitle: "Pay Money And Verify With TrxID",
    paymentMethodOrder: ["wallet", "gateway", "manual"],
    allowGuestCheckout: false,
    allowGuestChat: false,
  });
  const [savingCheckoutMethod, setSavingCheckoutMethod] = useState<
    | "walletEnabled"
    | "gatewayEnabled"
    | "manualEnabled"
    | "allowGuestCheckout"
    | "paymentMethodOrder"
    | null
  >(null);
  const [draftGatewayLabel, setDraftGatewayLabel] = useState("bKash / Nagad");
  const [draftGatewaySubtitle, setDraftGatewaySubtitle] = useState("Pay Money And Verify With TrxID");
  const [savingGatewayLabel, setSavingGatewayLabel] = useState(false);
  
  const refreshBusyRef = useRef(false);
  const formsRef = useRef(forms);
  const checkoutMethodsRef = useRef(checkoutMethods);
  formsRef.current = forms;
  checkoutMethodsRef.current = checkoutMethods;

  useEffect(() => {
    setTab(paymentsTabFromSearchParam(searchParams.get("tab")));
  }, [searchParams]);

  const selectTab = useCallback(
    (nextTab: PaymentsTab) => {
      setTab(nextTab);
      const href =
        nextTab === "mfs"
          ? "/admin/settings/payments?tab=mfs"
          : "/admin/settings/payments";
      router.replace(href, { scroll: false });
    },
    [router],
  );

  const gatewayMetaById = useMemo(() => {
    const map = new Map<PaymentGatewayId, PaymentGatewaySettingsView>();
    for (const gateway of settings?.gateways ?? []) {
      map.set(gateway.id, gateway);
    }
    return map;
  }, [settings]);

  const loadPage = useCallback(async (silent = false) => {
    if (silent) {
      if (refreshBusyRef.current) return;
      refreshBusyRef.current = true;
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [overviewData, settingsData, panelData] = await Promise.all([
        getPaymentGatewayOverview(),
        getPaymentGatewaySettings(),
        getCustomerPanelAdminSettings(),
      ]);
      setOverview(overviewData);
      setSettings(settingsData);
      setForms(buildForms(settingsData));
      setDefaultGateway(settingsData.defaultGateway ?? "uddoktapay");
      const normalized = normalizeCheckoutMethods(panelData.effective.checkout);
      setCheckoutMethods(normalized);
      setDraftGatewayLabel(normalized.gatewayLabel ?? "bKash / Nagad");
      setDraftGatewaySubtitle(normalized.gatewaySubtitle ?? "Pay Money And Verify With TrxID");
    } catch {
      if (!silent) {
        setOverview(null);
        setSettings(null);
        setForms(buildForms(null));
      }
    } finally {
      if (silent) {
        refreshBusyRef.current = false;
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const patchForm = useCallback(
    (id: PaymentGatewayId, patch: Partial<GatewayForm>) => {
      setForms((current) => ({
        ...current,
        [id]: { ...current[id], ...patch },
      }));
    },
    [],
  );

  const saveGateway = useCallback(async (id: PaymentGatewayId) => {
    setSavingGateway(id);
    hideAdminToast();
    const form = formsRef.current[id];
    try {
      const updated = await updatePaymentGatewaySettings({
        [id]: {
          enabled: form.enabled,
          sandbox: form.sandbox,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          apiSecret: form.apiSecret,
          webhookSecret: form.webhookSecret,
          username: form.username,
          password: form.password,
        },
      });
      setSettings(updated);
      setForms((current) => mergeFormsAfterSave(id, updated, current));
      setOverview((current) => overviewFromSettings(updated, current));
      adminToast(`${updated.gateways.find((g) => g.id === id)?.label ?? id} saved.`, true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Save failed.", false);
    } finally {
      setSavingGateway(null);
    }
  }, []);

  const saveGatewayFlags = useCallback(
    async (
      id: PaymentGatewayId,
      flags: Pick<GatewayForm, "enabled" | "sandbox">,
    ) => {
      const previous = formsRef.current[id];
      patchForm(id, flags);
      setSavingGateway(id);
      hideAdminToast();
      try {
        const updated = await updatePaymentGatewaySettings({
          [id]: flags,
        });
        setSettings(updated);
        setForms((current) => mergeFormsAfterSave(id, updated, current));
        setOverview((current) => overviewFromSettings(updated, current));
        adminToast(
          `${updated.gateways.find((g) => g.id === id)?.label ?? id} updated.`,
          true,
        );
      } catch (err) {
        patchForm(id, {
          enabled: previous.enabled,
          sandbox: previous.sandbox,
        });
        adminToast(err instanceof Error ? err.message : "Update failed.", false);
      } finally {
        setSavingGateway(null);
      }
    },
    [patchForm],
  );

  const handleToggleGateway = useCallback(
    (
      id: PaymentGatewayId,
      flags: Pick<GatewayForm, "enabled" | "sandbox">,
    ) => {
      void saveGatewayFlags(id, flags);
    },
    [saveGatewayFlags],
  );

  const handleSaveGateway = useCallback(
    (id: PaymentGatewayId) => {
      void saveGateway(id);
    },
    [saveGateway],
  );

  const statsPending = loading && !overview;
  const liveCount = overview?.liveCount ?? 0;

  const handleToggleCheckoutMethod = useCallback(
    async (key: "walletEnabled" | "gatewayEnabled" | "manualEnabled", enabled: boolean) => {
      const previous = checkoutMethodsRef.current[key];
      setCheckoutMethods((current) => ({ ...current, [key]: enabled }));
      setSavingCheckoutMethod(key);
      hideAdminToast();
      try {
        const updated = (await updateCustomerPanelSettings({
          checkout: { [key]: enabled },
        })) as { checkout?: Partial<CheckoutMethodFlags> };
        setCheckoutMethods((current) =>
          mergeCheckoutMethods(current, updated.checkout),
        );
        adminToast("Checkout payment method updated.", true);
      } catch (err) {
        setCheckoutMethods((current) => ({ ...current, [key]: previous }));
        adminToast(err instanceof Error ? err.message : "Update failed.", false);
      } finally {
        setSavingCheckoutMethod(null);
      }
    },
    [],
  );

  const handleToggleGuestCheckout = useCallback(async (enabled: boolean) => {
    const previous = checkoutMethodsRef.current.allowGuestCheckout;
    setCheckoutMethods((current) => ({ ...current, allowGuestCheckout: enabled }));
    setSavingCheckoutMethod("allowGuestCheckout");
    hideAdminToast();
    try {
      const updated = (await updateCustomerPanelSettings({
        checkout: { allowGuestCheckout: enabled },
      })) as { checkout?: Partial<CheckoutMethodFlags> };
      setCheckoutMethods((current) =>
        mergeCheckoutMethods(current, updated.checkout),
      );
      adminToast("Guest checkout updated.", true);
    } catch (err) {
      setCheckoutMethods((current) => ({
        ...current,
        allowGuestCheckout: previous,
      }));
      adminToast(err instanceof Error ? err.message : "Update failed.", false);
    } finally {
      setSavingCheckoutMethod(null);
    }
  }, []);

  const saveGatewayLabel = useCallback(async () => {
    const label = draftGatewayLabel.trim() || "bKash / Nagad";
    const subtitle = draftGatewaySubtitle.trim() || "Pay Money And Verify With TrxID";
    setSavingGatewayLabel(true);
    hideAdminToast();
    try {
      const updated = (await updateCustomerPanelSettings({
        checkout: { gatewayLabel: label, gatewaySubtitle: subtitle },
      })) as { checkout?: Partial<CheckoutMethodFlags> };
      setCheckoutMethods((current) =>
        mergeCheckoutMethods(current, updated.checkout),
      );
      setDraftGatewayLabel(label);
      setDraftGatewaySubtitle(subtitle);
      adminToast("Gateway name updated.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed.", false);
    } finally {
      setSavingGatewayLabel(false);
    }
  }, [draftGatewayLabel, draftGatewaySubtitle]);

  const handleMovePaymentMethod = useCallback(
    async (value: (typeof CHECKOUT_PAYMENT_METHOD_OPTIONS)[number]["value"], direction: "up" | "down") => {
      const previousOrder = normalizePaymentMethodOrder(
        checkoutMethodsRef.current.paymentMethodOrder,
      );
      const nextOrder = movePaymentMethodOrder(previousOrder, value, direction);
      if (nextOrder.join(",") === previousOrder.join(",")) return;

      setCheckoutMethods((current) => ({
        ...current,
        paymentMethodOrder: nextOrder,
      }));
      setSavingCheckoutMethod("paymentMethodOrder");
      hideAdminToast();
      try {
        await updateCustomerPanelSettings({
          checkout: { paymentMethodOrder: nextOrder },
        });
        setCheckoutMethods((current) =>
          mergeCheckoutMethods(current, { paymentMethodOrder: nextOrder }),
        );
        adminToast("Payment method order updated.", true);
      } catch (err) {
        setCheckoutMethods((current) => ({
          ...current,
          paymentMethodOrder: previousOrder,
        }));
        adminToast(err instanceof Error ? err.message : "Update failed.", false);
      } finally {
        setSavingCheckoutMethod(null);
      }
    },
    [],
  );

  const enabledCheckoutCount = countEnabledCheckoutMethods({
    walletEnabled: checkoutMethods.walletEnabled,
    gatewayEnabled: checkoutMethods.gatewayEnabled,
    manualEnabled: checkoutMethods.manualEnabled,
  });

  const paymentOverviewStats = useMemo<PaymentOverviewStat[]>(
    () => [
      {
        key: "configured",
        tone: "brand",
        icon: <CreditCardIcon className="h-4 w-4" />,
        label: "Configured",
        value: loadingStat(
          statsPending,
          (overview?.configuredCount ?? 0).toLocaleString(),
        ),
        meta: "Gateways with credentials",
      },
      {
        key: "live",
        tone: "success",
        icon: <CheckIcon className="h-4 w-4" />,
        label: "Live",
        value: loadingStat(statsPending, liveCount.toLocaleString()),
        meta: "Production-ready gateways",
      },
      {
        key: "enabled",
        tone: "amber",
        icon: <WalletIcon className="h-4 w-4" />,
        label: "Enabled",
        value: loadingStat(
          statsPending,
          (overview?.enabledCount ?? 0).toLocaleString(),
        ),
        meta: "Available at checkout",
      },
      {
        key: "intents",
        tone: "brand",
        icon: <PulseIcon className="h-4 w-4" />,
        label: "Intents (24h)",
        value: loadingStat(
          statsPending,
          (overview?.intents24h ?? 0).toLocaleString(),
        ),
        meta: statsPending
          ? "…"
          : `${overview?.succeeded24h ?? 0} success · ${overview?.failed24h ?? 0} failed`,
      },
    ],
    [liveCount, overview, statsPending],
  );

  async function saveDefaultGateway() {
    setSavingDefault(true);
    hideAdminToast();
    try {
      const updated = await updatePaymentGatewaySettings({ defaultGateway });
      setSettings(updated);
      setDefaultGateway(updated.defaultGateway);
      setOverview((current) => overviewFromSettings(updated, current));
      adminToast("Default gateway updated.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed.", false);
    } finally {
      setSavingDefault(false);
    }
  }

  return (
    <AdminPageLayout
      section="Settings"
      title="Payment gateways"
      description="Online gateways, MFS send-money numbers, checkout methods, and sandbox modes."
      icon={DollarIcon}
      backHref="/admin/settings"
      backLabel="General"
      action={
        statsPending ? null : liveCount > 0 ? (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            {liveCount.toLocaleString()} live
          </span>
        ) : (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            Sandbox / env
          </span>
        )
      }
    >

      <div className="admin-payments-page space-y-5">
        <AdminLicenseFeatureNotice path="/admin/settings/payments" />
            <AdminOrderListCard
              icon={<DollarIcon className="h-4 w-4" />}
              title="Payment overview"
              subtitle={
                statsPending
                  ? "Loading gateway settings…"
                  : `${liveCount} live gateway${liveCount === 1 ? "" : "s"} · ${enabledCheckoutCount}/3 checkout methods`
              }
              className="admin-payments-catalog admin-payments-overview"
            >
              <div className="admin-payments-overview-stack">
                <div className="admin-payments-overview-toolbar">
                  <div
                    className="admin-payments-overview-tabs"
                    role="tablist"
                    aria-label="Payment sections"
                  >
                    {PAYMENTS_TABS.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => selectTab(id)}
                        className={`admin-payments-overview-tab${
                          tab === id ? " admin-payments-overview-tab--active" : ""
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadPage(true)}
                    disabled={loading || refreshing}
                    className="admin-payments-overview-refresh dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                  >
                    {refreshing || loading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>

                <PaymentOverviewStats items={paymentOverviewStats} />

                <div className="admin-payments-meta-grid">
                  <div className="admin-payments-meta-item">
                    <span className="admin-payments-meta-label">Callback URL</span>
                    <span className="admin-payments-meta-value">
                      {statsPending ? "…" : (settings?.callbackBaseUrl ?? "—")}
                    </span>
                  </div>
                  <div className="admin-payments-meta-item">
                    <span className="admin-payments-meta-label">Storefront</span>
                    <span className="admin-payments-meta-value">
                      {statsPending ? "…" : (settings?.appUrl ?? "—")}
                    </span>
                  </div>
                  <div className="admin-payments-meta-item">
                    <span className="admin-payments-meta-label">Default gateway</span>
                    <span className="admin-payments-meta-value">
                      {GATEWAY_LABELS[defaultGateway]}
                    </span>
                  </div>
                </div>

                <div className="admin-payments-overview-panel">
                  {tab === "online" ? (
                    <div className="admin-payments-settings-grid">
                      <section className="admin-payments-settings-block">
                        <h3 className="admin-payments-section-title">Checkout experience</h3>
                        <PaymentOverviewSwitch
                          label="Allow ordering without account"
                          hint="When off, customers must register or sign in to checkout. Automatic order emails/SMS alerts are not sent to guest sessions."
                          checked={checkoutMethods.allowGuestCheckout === true}
                          disabled={
                            loading || savingCheckoutMethod === "allowGuestCheckout"
                          }
                          onChange={(value) => void handleToggleGuestCheckout(value)}
                        />
                      </section>

                      <section className="admin-payments-settings-block admin-payments-settings-block--wide">
                        <h3 className="admin-payments-section-title">Checkout payment methods</h3>
                        <div className="admin-payments-method-list">
                          {normalizePaymentMethodOrder(
                            checkoutMethods.paymentMethodOrder,
                          ).map((value, index, order) => {
                            const option = CHECKOUT_PAYMENT_METHOD_OPTIONS.find(
                              (row) => row.value === value,
                            );
                            if (!option) return null;
                            const reorderBusy =
                              savingCheckoutMethod === "paymentMethodOrder";
                            const title =
                              option.value === "gateway"
                                ? checkoutMethods.gatewayLabel || option.checkoutTitle
                                : option.checkoutTitle;
                            const subtitle =
                              option.value === "gateway"
                                ? checkoutMethods.gatewaySubtitle ||
                                  option.checkoutSubtitle
                                : option.checkoutSubtitle;
                            return (
                              <PaymentMethodOption
                                key={option.value}
                                value={option.value}
                                title={title}
                                subtitle={subtitle}
                                checked={checkoutMethods[option.flag]}
                                disabled={
                                  loading || savingCheckoutMethod === option.flag
                                }
                                reorderBusy={reorderBusy}
                                reorderDisabledUp={index === 0}
                                reorderDisabledDown={index === order.length - 1}
                                onToggle={(enabled) =>
                                  void handleToggleCheckoutMethod(option.flag, enabled)
                                }
                                onMoveUp={() =>
                                  void handleMovePaymentMethod(option.value, "up")
                                }
                                onMoveDown={() =>
                                  void handleMovePaymentMethod(option.value, "down")
                                }
                              />
                            );
                          })}
                        </div>
                        <div className="admin-payments-gateway-label-form mt-4 space-y-3 border-t border-border/60 pt-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                            Gateway display name
                          </p>
                          <div className="space-y-2">
                            <label className={labelCls} htmlFor="gateway-label-input">
                              Title shown at checkout
                            </label>
                            <input
                              id="gateway-label-input"
                              type="text"
                              className={inputCls}
                              value={draftGatewayLabel}
                              onChange={(e) => setDraftGatewayLabel(e.target.value.slice(0, 80))}
                              placeholder="bKash / Nagad"
                              maxLength={80}
                              disabled={savingGatewayLabel || loading}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className={labelCls} htmlFor="gateway-subtitle-input">
                              Subtitle
                            </label>
                            <input
                              id="gateway-subtitle-input"
                              type="text"
                              className={inputCls}
                              value={draftGatewaySubtitle}
                              onChange={(e) => setDraftGatewaySubtitle(e.target.value.slice(0, 160))}
                              placeholder="Pay Money And Verify With TrxID"
                              maxLength={160}
                              disabled={savingGatewayLabel || loading}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-subtle">
                              Displayed on the storefront checkout page.
                            </p>
                            <button
                              type="button"
                              disabled={savingGatewayLabel || loading}
                              onClick={() => void saveGatewayLabel()}
                              className="btn-primary btn-primary-sm shrink-0 disabled:opacity-50"
                            >
                              {savingGatewayLabel ? "Saving…" : "Save name"}
                            </button>
                          </div>
                        </div>
                      </section>

                      <section className="admin-payments-settings-block">
                        <h3 className="admin-payments-section-title">Default gateway</h3>
                        <p className="admin-payments-section-desc">
                          Primary checkout route when customers pay with a mobile wallet.
                        </p>
                        <div className="admin-payments-default-gateway">
                          <AdminSelect
                            id="default-gateway"
                            value={defaultGateway}
                            onChange={(value) =>
                              setDefaultGateway(value as PaymentGatewayId)
                            }
                            options={DEFAULT_GATEWAY_OPTIONS}
                            className="w-full"
                          />
                          <button
                            type="button"
                            disabled={savingDefault || loading}
                            onClick={() => void saveDefaultGateway()}
                            className="btn-primary shrink-0 disabled:opacity-50"
                          >
                            {savingDefault ? "Saving…" : "Save default"}
                          </button>
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="admin-payments-mfs-callout">
                      <p className="admin-payments-mfs-callout-title">MFS send-money checkout</p>
                      <p className="admin-payments-mfs-callout-text">
                        Configure bKash, Nagad, Rocket, and Upay merchant numbers for manual
                        TrxID checkout in the section below.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </AdminOrderListCard>

            {tab === "online" ? (
              <div className="admin-payments-gateways-grid">
                {GATEWAY_IDS.map((id) => (
                  <GatewayFormPanel
                    key={id}
                    id={id}
                    meta={gatewayMetaById.get(id)}
                    form={forms[id] ?? EMPTY_GATEWAY_FORM}
                    loading={loading}
                    saving={savingGateway === id}
                    onPatch={patchForm}
                    onToggle={handleToggleGateway}
                    onSave={handleSaveGateway}
                  />
                ))}
              </div>
            ) : (
              <AdminMfsGatewaysPanel />
            )}

            <ProductFormOrderCard
              className="admin-product-form-section admin-payment-gateways-sidebar"
              icon={<CreditCardIcon className="h-4 w-4" />}
              title="Setup guide"
              subtitle="Credentials, sandbox, and webhooks."
            >
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Credentials</dt>
                <dd className="text-sm text-foreground-muted">
                  Values saved here override environment variables. Leave secret
                  fields blank to keep existing stored or .env credentials.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Enable / disable</dt>
                <dd className="text-sm text-foreground-muted">
                  Toggles save immediately. Disabled providers are hidden on the
                  manual MFS checkout page. Configure merchant numbers under the{" "}
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => selectTab("mfs")}
                  >
                    MFS gateways
                  </button>{" "}
                  tab.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Sandbox mode</dt>
                <dd className="text-sm text-foreground-muted">
                  Sandbox charges exist only in development/test with
                  ALLOW_SANDBOX_INTEGRATIONS=true. Production returns a
                  configuration error instead of a fake checkout URL.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>UddoktaPay</dt>
                <dd className="text-sm text-foreground-muted">
                  Single API key can expose bKash, Nagad, Rocket, and Upay through
                  one aggregator checkout flow.
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Webhooks</dt>
                <dd className="text-sm text-foreground-muted">
                  Callback URL pattern:{" "}
                  <span className="font-mono text-[11px]">
                    {settings?.callbackBaseUrl ?? "…"}/payments/webhooks/{"{gateway}"}
                  </span>
                </dd>
              </div>
              <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                <dt>Sales</dt>
                <dd className="text-sm text-foreground-muted">
                  Monitor captured payments and failures under{" "}
                  <Link
                    href="/admin/sales/payments"
                    className="text-accent hover:underline"
                  >
                    Sales → Payments
                  </Link>{" "}
                  after going live.
                </dd>
              </div>
            </ProductFormOrderCard>
      </div>
    </AdminPageLayout>
  );
}
