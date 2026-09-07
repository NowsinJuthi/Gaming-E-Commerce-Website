"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import { useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminLicenseFeatureNotice } from "@/components/admin/AdminLicenseFeatureNotice";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import {
  CartIcon,
  CheckIcon,
  CreditCardIcon,
  HeartIcon,
  StoreIcon,
  TagIcon,
  UsersIcon,
} from "@/components/admin/icons";
import {
  getCustomerPanelAdminOverview,
  getCustomerPanelAdminSettings,
  updateCustomerPanelSettings,
} from "@/lib/api";
import {
  invalidatePanelConfig,
  notifyPanelConfigChanged,
  PANEL_NAV,
  resolveNavItemEnabled,
  type PanelNavItem,
} from "@/lib/customer-panel";
import {
  CHECKOUT_PAYMENT_METHOD_OPTIONS,
  movePaymentMethodOrder,
  normalizePaymentMethodOrder,
} from "@/lib/checkout-payment-methods";
import type { PaymentMethodValue } from "@/lib/api";

type Tab = "nav" | "storefront" | "rewards" | "checkout";

const TAB_IDS = new Set<Tab>(["nav", "storefront", "rewards", "checkout"]);

function tabFromSearchParam(value: string | null): Tab | null {
  if (value && TAB_IDS.has(value as Tab)) return value as Tab;
  return null;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "nav", label: "Navigation" },
  { id: "storefront", label: "Storefront" },
  { id: "rewards", label: "Rewards" },
  { id: "checkout", label: "Checkout" },
];

type PanelSettings = Awaited<ReturnType<typeof getCustomerPanelAdminSettings>>;
type PanelOverview = Awaited<ReturnType<typeof getCustomerPanelAdminOverview>>;

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

function loadingStat(loading: boolean, value: string) {
  return loading ? "…" : value;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

function countEnabledNav(nav: PanelSettings["nav"]) {
  return PANEL_NAV.filter((item) => resolveNavItemEnabled(nav, item.key)).length;
}

const SHOP_NAV_ITEMS = PANEL_NAV.filter((item) => item.section === "shop");
const BLOG_NAV_ITEMS = PANEL_NAV.filter((item) => item.section === "blog");
const ACCOUNT_NAV_ITEMS = PANEL_NAV.filter((item) => item.section === "account");

function patchOverviewFromSettings(
  prev: PanelOverview | null,
  settingsData: PanelSettings,
): PanelOverview | null {
  if (!prev) return prev;
  return {
    ...prev,
    storefront: settingsData.storefront,
    rewards: settingsData.rewards,
    checkout: settingsData.checkout,
    nav: {
      ...prev.nav,
      enabledCount: countEnabledNav(settingsData.nav),
      items: Object.fromEntries(
        PANEL_NAV.map((item) => [
          item.key,
          resolveNavItemEnabled(settingsData.nav, item.key),
        ]),
      ),
    },
  };
}

function countCheckoutMethods(checkout: PanelSettings["checkout"]) {
  return [checkout.walletEnabled, checkout.gatewayEnabled, checkout.manualEnabled].filter(
    Boolean,
  ).length;
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

const SwitchToggle = memo(function SwitchToggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
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
  );
});

const PanelToggle = memo(function PanelToggle({
  label,
  hint,
  checked,
  onChange,
  compact,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`admin-customer-panel-toggle${
        compact ? " admin-customer-panel-toggle--compact" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-foreground-muted">{hint}</p>
        ) : null}
      </div>
      <SwitchToggle
        checked={checked}
        onChange={onChange}
        label={label}
        disabled={disabled}
      />
    </div>
  );
});

const NavRow = memo(function NavRow({
  item,
  enabled,
  onChange,
  disabled,
}: {
  item: PanelNavItem;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="admin-customer-panel-nav-item">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{item.label}</p>
        <p className="mt-0.5 truncate text-xs text-subtle">
          {item.href}
          {item.auth ? " · Sign-in required" : ""}
        </p>
      </div>
      <SwitchToggle
        checked={enabled}
        onChange={onChange}
        label={`${item.label} navigation`}
        disabled={disabled}
      />
    </div>
  );
});

const NavTab = memo(function NavTab({
  settings,
  navEnabled,
  navTotal,
  busy,
  onToggle,
}: {
  settings: PanelSettings;
  navEnabled: number;
  navTotal: number;
  busy: boolean;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  return (
    <ProductFormOrderCard
      icon={<UsersIcon className="h-4 w-4" />}
      title="Customer navigation"
      subtitle={`Show or hide storefront and account menu items (${navEnabled}/${navTotal} enabled).`}
      className="admin-product-form-section admin-customer-panel-section"
    >
      <div className="admin-customer-panel-section-body space-y-5">
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Shop</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="admin-customer-panel-nav-list space-y-2">
              {SHOP_NAV_ITEMS.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  enabled={resolveNavItemEnabled(settings.nav, item.key)}
                  onChange={(value) => onToggle(item.key, value)}
                  disabled={busy}
                />
              ))}
            </div>
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Blog</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="admin-customer-panel-nav-list space-y-2">
              {BLOG_NAV_ITEMS.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  enabled={resolveNavItemEnabled(settings.nav, item.key)}
                  onChange={(value) => onToggle(item.key, value)}
                  disabled={busy}
                />
              ))}
            </div>
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Account</dt>
          <dd className="admin-product-form-sidebar-fields">
            <div className="admin-customer-panel-nav-list space-y-2">
              {ACCOUNT_NAV_ITEMS.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  enabled={resolveNavItemEnabled(settings.nav, item.key)}
                  onChange={(value) => onToggle(item.key, value)}
                  disabled={busy}
                />
              ))}
            </div>
          </dd>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Note</dt>
          <dd className="admin-product-form-sidebar-fields">
            <p className="text-xs text-foreground-muted">
              Changes save automatically. Hidden items are removed from the
              customer sidebar and mobile menu.
            </p>
          </dd>
        </div>
      </div>
    </ProductFormOrderCard>
  );
});

const StorefrontTab = memo(function StorefrontTab({
  settings,
  busy,
  onPatch,
  onSave,
}: {
  settings: PanelSettings;
  busy: boolean;
  onPatch: (patch: Partial<PanelSettings["storefront"]>) => void;
  onSave: () => void;
}) {
  const sf = settings.storefront;
  return (
    <ProductFormOrderCard
      icon={<StoreIcon className="h-4 w-4" />}
      title="Storefront"
      subtitle="Public site identity and maintenance controls for customers."
      className="admin-product-form-section admin-customer-panel-section"
    >
      <div className="admin-customer-panel-section-body space-y-4">
        <Field label="Site name">
          <input
            value={sf.siteName}
            onChange={(e) => onPatch({ siteName: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Default currency" hint="ISO code shown in cart and checkout">
          <input
            value={sf.defaultCurrency}
            onChange={(e) => onPatch({ defaultCurrency: e.target.value })}
            className={inputCls}
          />
        </Field>
        <PanelToggle
          label="Maintenance mode"
          hint="Shows maintenance page to customers while admins can still work"
          checked={sf.maintenanceMode}
          onChange={(value) => onPatch({ maintenanceMode: value })}
        />
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Save</dt>
          <dd className="admin-product-form-sidebar-fields">
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save storefront"}
            </button>
          </dd>
        </div>
      </div>
    </ProductFormOrderCard>
  );
});

const RewardsTab = memo(function RewardsTab({
  settings,
  busy,
  onPatch,
  onSave,
}: {
  settings: PanelSettings;
  busy: boolean;
  onPatch: (patch: Partial<PanelSettings["rewards"]>) => void;
  onSave: () => void;
}) {
  const rw = settings.rewards;
  return (
    <ProductFormOrderCard
      icon={<TagIcon className="h-4 w-4" />}
      title="Rewards program"
      subtitle="Points accrual and redemption rules for the customer wallet."
      className="admin-product-form-section admin-customer-panel-section"
    >
      <div className="admin-customer-panel-section-body space-y-4">
        <PanelToggle
          label="Rewards enabled"
          hint="Customers can earn and redeem points when enabled"
          checked={rw.enabled}
          onChange={(value) => onPatch({ enabled: value })}
        />
        <div className="admin-customer-panel-form-grid">
          <Field label="Points per currency unit">
            <input
              type="number"
              min={0}
              step={0.1}
              value={rw.pointsPerCurrency}
              onChange={(e) =>
                onPatch({ pointsPerCurrency: Number(e.target.value) || 0 })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Redeem threshold (points)">
            <input
              type="number"
              min={1}
              value={rw.redeemThreshold}
              onChange={(e) =>
                onPatch({ redeemThreshold: Number(e.target.value) || 0 })
              }
              className={inputCls}
            />
          </Field>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Save</dt>
          <dd className="admin-product-form-sidebar-fields">
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save rewards"}
            </button>
          </dd>
        </div>
      </div>
    </ProductFormOrderCard>
  );
});

const CHECKOUT_OPTIONS: Array<{
  key: "walletEnabled" | "gatewayEnabled" | "manualEnabled";
  label: string;
  hint: string;
}> = [
  {
    key: "walletEnabled",
    label: "Wallet payments",
    hint: "Pay from stored customer balance",
  },
  {
    key: "gatewayEnabled",
    label: "Gateway payments",
    hint: "bKash, Nagad, cards, and other gateways",
  },
  {
    key: "manualEnabled",
    label: "Manual / bank transfer",
    hint: "Offline payment with admin approval",
  },
];

const CheckoutTab = memo(function CheckoutTab({
  settings,
  busy,
  onPatch,
  onToggle,
  onMoveOrder,
  onSave,
}: {
  settings: PanelSettings;
  busy: boolean;
  onPatch: (patch: Partial<PanelSettings["checkout"]>) => void;
  onToggle: (
    key: "walletEnabled" | "gatewayEnabled" | "manualEnabled",
    value: boolean,
  ) => void;
  onMoveOrder: (value: PaymentMethodValue, direction: "up" | "down") => void;
  onSave: () => void;
}) {
  const order = normalizePaymentMethodOrder(settings.checkout.paymentMethodOrder);

  return (
    <ProductFormOrderCard
      icon={<CreditCardIcon className="h-4 w-4" />}
      title="Checkout"
      subtitle="Payment methods available to customers at checkout."
      className="admin-product-form-section admin-customer-panel-section"
    >
      <div className="admin-customer-panel-section-body space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
          Payment method order
        </p>
        <div className="space-y-2">
          {order.map((value, index) => {
            const option = CHECKOUT_PAYMENT_METHOD_OPTIONS.find(
              (row) => row.value === value,
            );
            const meta = CHECKOUT_OPTIONS.find(
              (row) =>
                (row.key === "walletEnabled" && value === "wallet") ||
                (row.key === "gatewayEnabled" && value === "gateway") ||
                (row.key === "manualEnabled" && value === "manual"),
            );
            if (!option || !meta) return null;
            return (
              <div
                key={value}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-sunken/20 px-3 py-2"
              >
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost px-2 py-0.5 text-xs disabled:opacity-40"
                    disabled={busy || index === 0}
                    onClick={() => onMoveOrder(value, "up")}
                    aria-label={`Move ${meta.label} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="dashboard-pro-btn-ghost px-2 py-0.5 text-xs disabled:opacity-40"
                    disabled={busy || index === order.length - 1}
                    onClick={() => onMoveOrder(value, "down")}
                    aria-label={`Move ${meta.label} down`}
                  >
                    ↓
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{meta.label}</p>
                  <p className="text-xs text-subtle">{meta.hint}</p>
                </div>
              </div>
            );
          })}
        </div>
        {CHECKOUT_OPTIONS.map(({ key, label, hint }) => (
          <PanelToggle
            key={key}
            label={label}
            hint={hint}
            checked={settings.checkout[key] as boolean}
            disabled={busy}
            onChange={(value) => onToggle(key, value)}
            compact
          />
        ))}
        <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
            MFS / gateway label (storefront)
          </p>
          <Field
            label="Payment option title"
            hint="Shown on checkout — e.g. bKash / Nagad, Mobile Banking"
          >
            <input
              type="text"
              className="admin-input w-full"
              value={settings.checkout.gatewayLabel ?? "bKash / Nagad"}
              maxLength={80}
              onChange={(e) =>
                onPatch({ gatewayLabel: e.target.value.slice(0, 80) })
              }
              placeholder="bKash / Nagad"
            />
          </Field>
          <Field
            label="Payment option subtitle"
            hint="Short line under the title on checkout"
          >
            <input
              type="text"
              className="admin-input w-full"
              value={
                settings.checkout.gatewaySubtitle ??
                "Pay Money And Verify With TrxID"
              }
              maxLength={160}
              onChange={(e) =>
                onPatch({ gatewaySubtitle: e.target.value.slice(0, 160) })
              }
              placeholder="Pay Money And Verify With TrxID"
            />
          </Field>
        </div>
        <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
          <dt>Save</dt>
          <dd className="admin-product-form-sidebar-fields">
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save checkout"}
            </button>
          </dd>
        </div>
      </div>
    </ProductFormOrderCard>
  );
});

export default function AdminCustomerPanelPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    () => tabFromSearchParam(searchParams.get("tab")) ?? "nav",
  );
  const [overview, setOverview] = useState<PanelOverview | null>(null);
  const [settings, setSettings] = useState<PanelSettings | null>(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const refreshBusyRef = useRef(false);
  const overviewFetchRef = useRef(false);
  const saveBusyRef = useRef(false);
  const settingsRef = useRef<PanelSettings | null>(null);
  settingsRef.current = settings;

  useEffect(() => {
    const nextTab = tabFromSearchParam(searchParams.get("tab"));
    if (nextTab) setTab(nextTab);
  }, [searchParams]);

  const loadOverview = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (overviewFetchRef.current && !opts?.force) return;
    overviewFetchRef.current = true;
    try {
      const overviewData = await getCustomerPanelAdminOverview();
      setOverview(overviewData);
    } catch {
      if (!opts?.silent) setOverview(null);
    } finally {
      overviewFetchRef.current = false;
    }
  }, []);

  const loadCore = useCallback(async (silent = false, withOverview = false) => {
    if (silent) {
      if (refreshBusyRef.current) return;
      refreshBusyRef.current = true;
      setRefreshing(true);
    } else {
      setCoreLoading(true);
      setLoadError(null);
    }
    try {
      const settingsData = await getCustomerPanelAdminSettings();
      setSettings(settingsData);
      if (withOverview) await loadOverview({ silent: true, force: true });
    } catch (err) {
      if (!silent) {
        setSettings(null);
        setOverview(null);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load customer panel.",
        );
      }
    } finally {
      if (silent) {
        refreshBusyRef.current = false;
        setRefreshing(false);
      } else {
        setCoreLoading(false);
      }
    }
  }, [loadOverview]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (!settings || overview) return;
    void loadOverview({ silent: true });
  }, [settings, overview, loadOverview]);

  const savePatch = useCallback(
    async (patch: Record<string, unknown>, successMsg: string) => {
      if (!settingsRef.current || saveBusyRef.current) return;
      saveBusyRef.current = true;
      setBusy(true);
      hideAdminToast();
      try {
        const updated = await updateCustomerPanelSettings(patch);
        settingsRef.current = updated;
        setSettings(updated);
        setOverview((prev) => patchOverviewFromSettings(prev, updated));
        invalidatePanelConfig();
        notifyPanelConfigChanged();
        adminToast(successMsg, true);
      } catch (err) {
        adminToast(err instanceof Error ? err.message : "Save failed.", false);
      } finally {
        saveBusyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const applyNavToggle = useCallback((key: string, enabled: boolean) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nav: {
          ...prev.nav,
          [key]: { ...prev.nav[key], enabled },
        },
        effective: {
          ...prev.effective,
          nav: {
            ...prev.effective.nav,
            [key]: enabled,
          },
        },
      };
    });
  }, []);

  const toggleNav = useCallback(
    (key: string, enabled: boolean) => {
      if (!settingsRef.current || saveBusyRef.current) return;
      const previousEnabled = resolveNavItemEnabled(settingsRef.current.nav, key);
      applyNavToggle(key, enabled);
      saveBusyRef.current = true;
      setBusy(true);
      void (async () => {
        try {
          const updated = await updateCustomerPanelSettings({
            nav: { [key]: { enabled } },
          });
          settingsRef.current = updated;
          setSettings(updated);
          setOverview((prev) => patchOverviewFromSettings(prev, updated));
          invalidatePanelConfig();
          notifyPanelConfigChanged();
        } catch (err) {
          applyNavToggle(key, previousEnabled);
          adminToast(err instanceof Error ? err.message : "Update failed.", false);
        } finally {
          saveBusyRef.current = false;
          setBusy(false);
        }
      })();
    },
    [applyNavToggle],
  );

  const patchStorefront = useCallback((patch: Partial<PanelSettings["storefront"]>) => {
    setSettings((prev) =>
      prev
        ? { ...prev, storefront: { ...prev.storefront, ...patch } }
        : prev,
    );
  }, []);

  const patchRewards = useCallback((patch: Partial<PanelSettings["rewards"]>) => {
    setSettings((prev) =>
      prev ? { ...prev, rewards: { ...prev.rewards, ...patch } } : prev,
    );
  }, []);

  const patchCheckout = useCallback((patch: Partial<PanelSettings["checkout"]>) => {
    setSettings((prev) =>
      prev ? { ...prev, checkout: { ...prev.checkout, ...patch } } : prev,
    );
  }, []);

  const statsPending = coreLoading && !settings;
  const overviewPending = !overview && !coreLoading && !!settings;
  const navEnabled = settings ? countEnabledNav(settings.nav) : 0;
  const navTotal = overview?.nav.total ?? PANEL_NAV.length;
  const checkoutMethods = settings ? countCheckoutMethods(settings.checkout) : 0;

  const saveStorefront = useCallback(
    () =>
      void savePatch(
        { storefront: settingsRef.current!.storefront },
        "Storefront settings saved.",
      ),
    [savePatch],
  );
  const saveRewards = useCallback(
    () =>
      void savePatch({ rewards: settingsRef.current!.rewards }, "Rewards settings saved."),
    [savePatch],
  );
  const saveCheckout = useCallback(
    () =>
      void savePatch({ checkout: settingsRef.current!.checkout }, "Checkout settings saved."),
    [savePatch],
  );

  const toggleCheckoutMethod = useCallback(
    (key: "walletEnabled" | "gatewayEnabled" | "manualEnabled", value: boolean) => {
      const previous = settingsRef.current?.checkout[key] ?? true;
      patchCheckout({ [key]: value });
      void (async () => {
        try {
          await updateCustomerPanelSettings({ checkout: { [key]: value } });
          adminToast("Payment method updated.", true);
        } catch (err) {
          patchCheckout({ [key]: previous });
          adminToast(err instanceof Error ? err.message : "Update failed.", false);
        }
      })();
    },
    [patchCheckout],
  );

  const toggleGuestCheckout = useCallback(
    (value: boolean) => {
      const previous = settingsRef.current?.checkout.allowGuestCheckout ?? false;
      patchCheckout({ allowGuestCheckout: value });
      void (async () => {
        try {
          await updateCustomerPanelSettings({ checkout: { allowGuestCheckout: value } });
          adminToast("Guest checkout setting updated.", true);
        } catch (err) {
          patchCheckout({ allowGuestCheckout: previous });
          adminToast(err instanceof Error ? err.message : "Update failed.", false);
        }
      })();
    },
    [patchCheckout],
  );

  const moveCheckoutMethodOrder = useCallback(
    (value: PaymentMethodValue, direction: "up" | "down") => {
      const previous = normalizePaymentMethodOrder(
        settingsRef.current?.checkout.paymentMethodOrder,
      );
      const nextOrder = movePaymentMethodOrder(previous, value, direction);
      if (nextOrder.join(",") === previous.join(",")) return;
      patchCheckout({ paymentMethodOrder: nextOrder });
      void (async () => {
        try {
          await updateCustomerPanelSettings({
            checkout: { paymentMethodOrder: nextOrder },
          });
          adminToast("Payment method order updated.", true);
        } catch (err) {
          patchCheckout({ paymentMethodOrder: previous });
          adminToast(err instanceof Error ? err.message : "Update failed.", false);
        }
      })();
    },
    [patchCheckout],
  );

  return (
    <AdminPageLayout
      section="Settings"
      title="Customer panel"
      description="Navigation, storefront identity, rewards, and checkout for signed-in customers."
      icon={UsersIcon}
      backHref="/admin/settings"
      backLabel="General"
      className="admin-customer-panel-settings"
      action={
        statsPending ? null : settings?.storefront.maintenanceMode ? (
          <span className="dashboard-pro-status dashboard-pro-status--amber">
            Maintenance
          </span>
        ) : (
          <span className="dashboard-pro-status dashboard-pro-status--green">
            Live storefront
          </span>
        )
      }
    >

      <AdminLicenseFeatureNotice path="/admin/settings/customer-panel" />

      {loadError && !settings ? (
        <ProductFormOrderCard
          title="Could not load customer panel"
          subtitle={loadError}
          className="admin-customer-panel-empty space-y-3"
        >
          <button
            type="button"
            onClick={() => void loadCore()}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Retry
          </button>
        </ProductFormOrderCard>
      ) : (
        <div className="admin-customer-panel-layout space-y-5">
          <div className="customer-dashboard-page dashboard-page--pro min-w-0 space-y-4">
                  <section
                    className="customer-dashboard-overview-section admin-customer-panel-overview"
                    aria-label="Customer panel overview"
                  >
                    <dl className="customer-dashboard-overview-stats">
                      <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--brand">
                        <span
                          className="customer-dashboard-overview-stat-glow"
                          aria-hidden
                        />
                        <span
                          className="customer-dashboard-overview-stat-icon"
                          aria-hidden
                        >
                          <UsersIcon className="h-4 w-4" />
                        </span>
                        <div className="customer-dashboard-overview-stat-copy min-w-0">
                          <dt className="customer-dashboard-overview-stat-label">
                            Nav enabled
                          </dt>
                          <dd className="customer-dashboard-overview-stat-value">
                            {loadingStat(statsPending, `${navEnabled}/${navTotal}`)}
                          </dd>
                          <p className="customer-dashboard-overview-stat-meta">
                            Menu items visible
                          </p>
                        </div>
                      </div>
                      <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--muted">
                        <span
                          className="customer-dashboard-overview-stat-glow"
                          aria-hidden
                        />
                        <span
                          className="customer-dashboard-overview-stat-icon"
                          aria-hidden
                        >
                          <HeartIcon className="h-4 w-4" />
                        </span>
                        <div className="customer-dashboard-overview-stat-copy min-w-0">
                          <dt className="customer-dashboard-overview-stat-label">
                            Wishlist
                          </dt>
                          <dd className="customer-dashboard-overview-stat-value">
                            {loadingStat(
                              statsPending || overviewPending,
                              (overview?.stats.wishlistItems ?? 0).toLocaleString(),
                            )}
                          </dd>
                          <p className="customer-dashboard-overview-stat-meta">
                            Saved items
                          </p>
                        </div>
                      </div>
                      <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--amber">
                        <span
                          className="customer-dashboard-overview-stat-glow"
                          aria-hidden
                        />
                        <span
                          className="customer-dashboard-overview-stat-icon"
                          aria-hidden
                        >
                          <CartIcon className="h-4 w-4" />
                        </span>
                        <div className="customer-dashboard-overview-stat-copy min-w-0">
                          <dt className="customer-dashboard-overview-stat-label">
                            Active orders
                          </dt>
                          <dd className="customer-dashboard-overview-stat-value">
                            {loadingStat(
                              statsPending || overviewPending,
                              (overview?.stats.activeOrders ?? 0).toLocaleString(),
                            )}
                          </dd>
                          <p className="customer-dashboard-overview-stat-meta">
                            In progress
                          </p>
                        </div>
                      </div>
                      <div className="customer-dashboard-overview-stat customer-dashboard-overview-stat--success">
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
                        <div className="customer-dashboard-overview-stat-copy min-w-0">
                          <dt className="customer-dashboard-overview-stat-label">
                            Delivered
                          </dt>
                          <dd className="customer-dashboard-overview-stat-value">
                            {loadingStat(
                              statsPending || overviewPending,
                              (overview?.stats.deliveredOrders ?? 0).toLocaleString(),
                            )}
                          </dd>
                          <p className="customer-dashboard-overview-stat-meta">
                            Completed orders
                          </p>
                        </div>
                      </div>
                    </dl>
                  </section>

                  <section
                    className="customer-dashboard-recent-orders-section"
                    aria-label="Customer panel settings"
                  >
                    <div className="admin-customer-panel-overview-toolbar mb-4 space-y-3 px-1">
                      <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3 sm:px-4">
                        <div
                          className="admin-customer-panel-summary flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-muted"
                        >
                          <span>
                            <span className="font-semibold text-foreground">Site</span>{" "}
                            {statsPending ? "…" : settings?.storefront.siteName || "—"}
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">Currency</span>{" "}
                            {statsPending ? "…" : settings?.storefront.defaultCurrency || "—"}
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">Checkout</span>{" "}
                            {statsPending ? "…" : `${checkoutMethods}/3 methods`}
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">Guest checkout</span>{" "}
                            {statsPending
                              ? "…"
                              : settings?.checkout.allowGuestCheckout
                                ? "On"
                                : "Off"}
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">Updated</span>{" "}
                            {statsPending ? "…" : formatDate(settings?.updatedAt)}
                          </span>
                        </div>
                      </div>

                      {settings ? (
                        <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3 sm:px-4">
                          <PanelToggle
                            label="Allow ordering without account"
                            hint="When off, customers must register or sign in to checkout. Order emails/alerts are not sent without a real account."
                            checked={settings.checkout.allowGuestCheckout === true}
                            disabled={busy}
                            onChange={toggleGuestCheckout}
                          />
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                            Sections
                          </p>
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
                        </div>
                        <button
                          type="button"
                          onClick={() => void loadCore(true, true)}
                          disabled={coreLoading || refreshing}
                          className="dashboard-pro-btn-ghost shrink-0 text-xs disabled:opacity-50"
                        >
                          {refreshing || coreLoading ? "Refreshing…" : "Refresh"}
                        </button>
                      </div>
                    </div>
                  </section>
                </div>

          <div className="admin-customer-panel-content min-w-0 space-y-5">
                  {settings && tab === "nav" ? (
                    <NavTab
                      settings={settings}
                      navEnabled={navEnabled}
                      navTotal={navTotal}
                      busy={busy}
                      onToggle={toggleNav}
                    />
                  ) : null}
                  {settings && tab === "storefront" ? (
                    <StorefrontTab
                      settings={settings}
                      busy={busy}
                      onPatch={patchStorefront}
                      onSave={saveStorefront}
                    />
                  ) : null}
                  {settings && tab === "rewards" ? (
                    <RewardsTab
                      settings={settings}
                      busy={busy}
                      onPatch={patchRewards}
                      onSave={saveRewards}
                    />
                  ) : null}
                  {settings && tab === "checkout" ? (
                    <CheckoutTab
                      settings={settings}
                      busy={busy}
                      onPatch={patchCheckout}
                      onToggle={toggleCheckoutMethod}
                      onMoveOrder={moveCheckoutMethodOrder}
                      onSave={saveCheckout}
                    />
                  ) : null}
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
