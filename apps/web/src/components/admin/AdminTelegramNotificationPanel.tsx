"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import {
  getTelegramSettings,
  updateTelegramSettings,
  type TelegramSettingsView,
} from "@/lib/api";

function SettingSwitchRow({
  title,
  description,
  checked,
  disabled,
  ariaLabel,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="admin-payments-setting-row">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-foreground-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
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
}

export function AdminTelegramNotificationPanel() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TelegramSettingsView | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [notifyOnOrderPlaced, setNotifyOnOrderPlaced] = useState(true);
  const [notifyOnCustomerChat, setNotifyOnCustomerChat] = useState(true);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [savingOrders, setSavingOrders] = useState(false);
  const [savingChat, setSavingChat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTelegramSettings();
      setSettings(data);
      setEnabled(data.enabled);
      setNotifyOnOrderPlaced(data.notifyOnOrderPlaced);
      setNotifyOnCustomerChat(data.notifyOnCustomerChat);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchToggle = useCallback(
    async (
      patch: Partial<
        Pick<
          TelegramSettingsView,
          "enabled" | "notifyOnOrderPlaced" | "notifyOnCustomerChat"
        >
      >,
      rollback: () => void,
      setSaving: (v: boolean) => void,
      successMessage: string,
    ) => {
      setSaving(true);
      hideAdminToast();
      try {
        const updated = await updateTelegramSettings(patch);
        setSettings(updated);
        setEnabled(updated.enabled);
        setNotifyOnOrderPlaced(updated.notifyOnOrderPlaced);
        setNotifyOnCustomerChat(updated.notifyOnCustomerChat);
        adminToast(successMessage, true);
      } catch (err) {
        rollback();
        adminToast(err instanceof Error ? err.message : "Update failed.", false);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const handleToggleEnabled = useCallback(
    async (next: boolean) => {
      const previous = enabled;
      setEnabled(next);
      await patchToggle(
        { enabled: next },
        () => setEnabled(previous),
        setSavingEnabled,
        next ? "Telegram notifications enabled." : "Telegram notifications disabled.",
      );
    },
    [enabled, patchToggle],
  );

  const handleToggleOrders = useCallback(
    async (next: boolean) => {
      const previous = notifyOnOrderPlaced;
      setNotifyOnOrderPlaced(next);
      await patchToggle(
        { notifyOnOrderPlaced: next },
        () => setNotifyOnOrderPlaced(previous),
        setSavingOrders,
        next
          ? "Order Telegram alerts enabled."
          : "Order Telegram alerts disabled.",
      );
    },
    [notifyOnOrderPlaced, patchToggle],
  );

  const handleToggleChat = useCallback(
    async (next: boolean) => {
      const previous = notifyOnCustomerChat;
      setNotifyOnCustomerChat(next);
      await patchToggle(
        { notifyOnCustomerChat: next },
        () => setNotifyOnCustomerChat(previous),
        setSavingChat,
        next
          ? "Live chat Telegram alerts enabled."
          : "Live chat Telegram alerts disabled.",
      );
    },
    [notifyOnCustomerChat, patchToggle],
  );

  const togglesDisabled = loading || savingEnabled;
  const childTogglesDisabled =
    togglesDisabled || !enabled || savingOrders || savingChat;

  return (
    <ProductFormOrderCard
      icon={<ChatIcon className="h-4 w-4" />}
      title="Telegram notifications"
      subtitle={
        settings?.configured
          ? "Turn admin Telegram alerts on or off from the dashboard."
          : "Connect a bot to enable Telegram alerts."
      }
      className="admin-product-form-section"
    >
      {loading ? (
        <p className="text-sm text-foreground-muted">Loading Telegram settings…</p>
      ) : !settings ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground-muted">
            Could not load Telegram settings.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
            <dt>Connection</dt>
            <dd className="text-sm text-foreground-muted">
              {settings.configured ? (
                <>
                  <span className="font-semibold text-emerald-400">Connected</span>
                  {settings.botUsername ? (
                    <span className="text-foreground-muted">
                      {" "}
                      · @{settings.botUsername}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="font-semibold text-amber-300">Not configured</span>
              )}
            </dd>
          </div>

          <div className="admin-payments-settings-list space-y-3">
            <SettingSwitchRow
              title="Telegram notifications"
              description="Master switch for all admin Telegram alerts."
              checked={enabled}
              disabled={togglesDisabled}
              ariaLabel="Toggle Telegram notifications"
              onToggle={(v) => void handleToggleEnabled(v)}
            />
            <SettingSwitchRow
              title="Order alerts"
              description="Paid, processing, and auto-fulfilled orders (not pending checkout)."
              checked={notifyOnOrderPlaced}
              disabled={childTogglesDisabled}
              ariaLabel="Toggle order Telegram alerts"
              onToggle={(v) => void handleToggleOrders(v)}
            />
            <SettingSwitchRow
              title="Live chat messages"
              description="When a customer sends a message in live chat."
              checked={notifyOnCustomerChat}
              disabled={childTogglesDisabled}
              ariaLabel="Toggle live chat Telegram alerts"
              onToggle={(v) => void handleToggleChat(v)}
            />
          </div>

          <Link
            href="/admin/settings/telegram"
            className="admin-webinfo-action-link text-sm"
          >
            Bot token &amp; chat ID →
          </Link>
        </div>
      )}
    </ProductFormOrderCard>
  );
}
