"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatIcon, MailIcon, SettingsIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import {
  getChatQuickReplies,
  getCustomerPanelAdminSettings,
  updateCustomerPanelSettings,
} from "@/lib/api";
import { hasStrictAdminRole } from "@/lib/auth-roles";
import { resolveNavItemEnabled } from "@/lib/customer-panel";

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

export function LiveChatSettingsPanel() {
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [allowChatImages, setAllowChatImages] = useState(true);
  const [allowGuestChat, setAllowGuestChat] = useState(false);
  const [chatNavEnabled, setChatNavEnabled] = useState(true);
  const [averageResponseTime, setAverageResponseTime] = useState("< 15 minutes");
  const [savedAverageResponseTime, setSavedAverageResponseTime] =
    useState("< 15 minutes");
  const [savingChatImages, setSavingChatImages] = useState(false);
  const [savingGuestChat, setSavingGuestChat] = useState(false);
  const [savingChatNav, setSavingChatNav] = useState(false);
  const [savingResponseTime, setSavingResponseTime] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quickReplyCount, setQuickReplyCount] = useState<number | null>(null);
  const [quickReplyEnabled, setQuickReplyEnabled] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setIsAdmin(hasStrictAdminRole());
    sync();
    window.addEventListener("auth-change", sync);
    return () => window.removeEventListener("auth-change", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCustomerPanelAdminSettings()
      .then((data) => {
        if (!cancelled) {
          setAllowChatImages(data.chat?.allowImageUpload !== false);
          setAllowGuestChat(data.checkout?.allowGuestChat === true);
          setChatNavEnabled(resolveNavItemEnabled(data.nav, "chat"));
          const responseTime =
            data.chat?.averageResponseTime?.trim() || "< 15 minutes";
          setAverageResponseTime(responseTime);
          setSavedAverageResponseTime(responseTime);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllowChatImages(true);
          setAllowGuestChat(false);
          setChatNavEnabled(true);
          setAverageResponseTime("< 15 minutes");
          setSavedAverageResponseTime("< 15 minutes");
        }
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setQuickReplyCount(null);
      setQuickReplyEnabled(null);
      return;
    }
    let cancelled = false;
    getChatQuickReplies()
      .then((result) => {
        if (cancelled) return;
        const items = result.quickReplies ?? [];
        setQuickReplyCount(items.length);
        setQuickReplyEnabled(items.filter((r) => r.enabled !== false).length);
      })
      .catch(() => {
        if (!cancelled) {
          setQuickReplyCount(null);
          setQuickReplyEnabled(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const handleToggleChatImages = useCallback(
    async (enabled: boolean) => {
      const previous = allowChatImages;
      setAllowChatImages(enabled);
      setSavingChatImages(true);
      hideAdminToast();
      try {
        await updateCustomerPanelSettings({
          chat: { allowImageUpload: enabled },
        });
        adminToast(
          enabled
            ? "Live chat picture uploads enabled."
            : "Live chat picture uploads disabled.",
          true,
        );
      } catch (err) {
        setAllowChatImages(previous);
        adminToast(err instanceof Error ? err.message : "Update failed.", false);
      } finally {
        setSavingChatImages(false);
      }
    },
    [allowChatImages],
  );

  const handleToggleGuestChat = useCallback(
    async (enabled: boolean) => {
      const previous = allowGuestChat;
      setAllowGuestChat(enabled);
      setSavingGuestChat(true);
      hideAdminToast();
      try {
        await updateCustomerPanelSettings({
          checkout: { allowGuestChat: enabled },
        });
        adminToast("Live chat guest access updated.", true);
      } catch (err) {
        setAllowGuestChat(previous);
        adminToast(err instanceof Error ? err.message : "Update failed.", false);
      } finally {
        setSavingGuestChat(false);
      }
    },
    [allowGuestChat],
  );

  const handleToggleChatNav = useCallback(
    async (enabled: boolean) => {
      const previous = chatNavEnabled;
      setChatNavEnabled(enabled);
      setSavingChatNav(true);
      hideAdminToast();
      try {
        await updateCustomerPanelSettings({
          nav: { chat: { enabled } },
        });
        adminToast(
          enabled
            ? "Live chat link shown in customer account menu."
            : "Live chat link hidden from customer account menu.",
          true,
        );
      } catch (err) {
        setChatNavEnabled(previous);
        adminToast(err instanceof Error ? err.message : "Update failed.", false);
      } finally {
        setSavingChatNav(false);
      }
    },
    [chatNavEnabled],
  );

  const handleSaveAverageResponseTime = useCallback(async () => {
    const next = averageResponseTime.trim() || "< 15 minutes";
    const previous = savedAverageResponseTime;
    setAverageResponseTime(next);
    setSavingResponseTime(true);
    hideAdminToast();
    try {
      await updateCustomerPanelSettings({
        chat: { averageResponseTime: next },
      });
      setSavedAverageResponseTime(next);
      adminToast("Average response time updated.", true);
    } catch (err) {
      setAverageResponseTime(previous);
      adminToast(err instanceof Error ? err.message : "Update failed.", false);
    } finally {
      setSavingResponseTime(false);
    }
  }, [averageResponseTime, savedAverageResponseTime]);

  const togglesDisabled = settingsLoading;
  const responseTimeDirty =
    averageResponseTime.trim() !== savedAverageResponseTime.trim();

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-muted">
        Live chat uses real-time WebSocket messaging and in-app notifications only —
        not SMTP email or MFS payment SMS. Order emails are configured under{" "}
        <Link href="/admin/settings/email" className="text-accent hover:underline">
          Settings → Email / SMTP
        </Link>
        ; MFS SMS verification is under{" "}
        <Link
          href="/admin/settings/payments"
          className="text-accent hover:underline"
        >
          Payment gateways
        </Link>
        .
      </p>
      <ProductFormOrderCard
        icon={<SettingsIcon className="h-4 w-4" />}
        title="Messaging"
        subtitle="Who can chat and what they can send"
        className="w-full"
      >
        <div className="space-y-2">
          <SettingSwitchRow
            title="Allow picture uploads"
            description="When off, nobody can attach images in live chat — customers, guests, and staff. Text messages still work."
            checked={allowChatImages}
            disabled={togglesDisabled || savingChatImages}
            ariaLabel="Allow picture uploads in live chat"
            onToggle={(enabled) => void handleToggleChatImages(enabled)}
          />
          <SettingSwitchRow
            title="Allow live chat without login"
            description="When enabled, visitors can open a live chat session by entering their name only — no account required. When disabled, a login is required to send messages."
            checked={allowGuestChat}
            disabled={togglesDisabled || savingGuestChat}
            ariaLabel="Allow live chat without login"
            onToggle={(enabled) => void handleToggleGuestChat(enabled)}
          />
          <div className="admin-payments-setting-row">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Average response time
              </p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                Shown in the live chat header as{" "}
                <span className="text-foreground">Average Response Time:</span>{" "}
                followed by your text (e.g. &lt; 15 minutes).
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={averageResponseTime}
                  maxLength={80}
                  disabled={togglesDisabled || savingResponseTime}
                  onChange={(e) => setAverageResponseTime(e.target.value)}
                  className="admin-input w-full sm:max-w-xs"
                  placeholder="< 15 minutes"
                  aria-label="Average response time display text"
                />
                <button
                  type="button"
                  disabled={
                    togglesDisabled ||
                    savingResponseTime ||
                    !responseTimeDirty
                  }
                  onClick={() => void handleSaveAverageResponseTime()}
                  className="dashboard-pro-btn-ghost shrink-0 px-4 py-2 text-sm disabled:opacity-50"
                >
                  {savingResponseTime ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ProductFormOrderCard>

      <ProductFormOrderCard
        icon={<ChatIcon className="h-4 w-4" />}
        title="Customer account"
        subtitle="How logged-in customers discover live chat"
        className="w-full"
      >
        <SettingSwitchRow
          title="Show Live chat in account menu"
          description="Adds or removes the Live chat link from the customer dashboard sidebar. The storefront chat launcher still appears for visitors when guest chat is enabled."
          checked={chatNavEnabled}
          disabled={togglesDisabled || savingChatNav}
          ariaLabel="Show Live chat in customer account menu"
          onToggle={(enabled) => void handleToggleChatNav(enabled)}
        />
      </ProductFormOrderCard>

      <ProductFormOrderCard
        icon={<MailIcon className="h-4 w-4" />}
        title="Saved replies"
        subtitle="Quick replies for staff in the live chat composer"
        className="w-full"
      >
        {isAdmin ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-foreground-muted">
              {quickReplyCount != null
                ? `${quickReplyCount.toLocaleString()} saved repl${
                    quickReplyCount === 1 ? "y" : "ies"
                  } · ${quickReplyEnabled?.toLocaleString() ?? "0"} enabled`
                : "Loading saved replies…"}
            </div>
            <Link
              href="/admin/saved-replies"
              className="dashboard-pro-btn-ghost shrink-0 px-4 py-2 text-sm"
            >
              Manage saved replies
            </Link>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">
            Saved replies are managed by administrators. Ask an admin to add or
            edit quick replies for the team.
          </p>
        )}
      </ProductFormOrderCard>
    </div>
  );
}
