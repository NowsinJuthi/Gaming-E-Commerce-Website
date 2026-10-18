"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChatIcon, MailIcon, SettingsIcon } from "@/components/admin/icons";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import {
  getChatWelcomeAutoReply,
  getChatQuickReplies,
  getCustomerPanelAdminSettings,
  getMe,
  updateChatWelcomeAutoReply,
  updateCustomerPanelSettings,
} from "@/lib/api";
import { isChatStaffFromRoles } from "@/lib/chat-roles";
import { getSessionRoles } from "@/lib/access-token";
import { resolveNavItemEnabled } from "@/lib/customer-panel";

const DEFAULT_WELCOME_AUTO_REPLY =
  "Welcome to UniQbd Support! Thanks for reaching out. Our support team will reply as soon as possible.";

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
  const [chatNavEnabled, setChatNavEnabled] = useState(true);
  const [averageResponseTime, setAverageResponseTime] = useState("< 15 minutes");
  const [savedAverageResponseTime, setSavedAverageResponseTime] =
    useState("< 15 minutes");
  const [savingChatNav, setSavingChatNav] = useState(false);
  const [savingResponseTime, setSavingResponseTime] = useState(false);
  const [canManageReplies, setCanManageReplies] = useState(() =>
    isChatStaffFromRoles(getSessionRoles()),
  );
  const [quickReplyCount, setQuickReplyCount] = useState<number | null>(null);
  const [quickReplyEnabled, setQuickReplyEnabled] = useState<number | null>(null);
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState(
    DEFAULT_WELCOME_AUTO_REPLY,
  );
  const [savedWelcomeEnabled, setSavedWelcomeEnabled] = useState(false);
  const [savedWelcomeMessage, setSavedWelcomeMessage] = useState(
    DEFAULT_WELCOME_AUTO_REPLY,
  );
  const [welcomeLoading, setWelcomeLoading] = useState(true);
  const [savingWelcome, setSavingWelcome] = useState(false);

  useEffect(() => {
    const syncFromSession = () => {
      setCanManageReplies(isChatStaffFromRoles(getSessionRoles()));
    };
    syncFromSession();
    window.addEventListener("auth-change", syncFromSession);
    return () => window.removeEventListener("auth-change", syncFromSession);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setCanManageReplies(isChatStaffFromRoles(me.roles ?? []));
      })
      .catch(() => {
        if (!cancelled) setCanManageReplies(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCustomerPanelAdminSettings()
      .then((data) => {
        if (!cancelled) {
          setChatNavEnabled(resolveNavItemEnabled(data.nav, "chat"));
          const responseTime =
            data.chat?.averageResponseTime?.trim() || "< 15 minutes";
          setAverageResponseTime(responseTime);
          setSavedAverageResponseTime(responseTime);
        }
      })
      .catch(() => {
        if (!cancelled) {
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
    if (!canManageReplies) {
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
  }, [canManageReplies]);

  useEffect(() => {
    if (!canManageReplies) {
      setWelcomeLoading(false);
      return;
    }

    let cancelled = false;
    setWelcomeLoading(true);
    getChatWelcomeAutoReply()
      .then((result) => {
        if (cancelled) return;
        const message = result.message.trim() || DEFAULT_WELCOME_AUTO_REPLY;
        setWelcomeEnabled(result.enabled);
        setSavedWelcomeEnabled(result.enabled);
        setWelcomeMessage(message);
        setSavedWelcomeMessage(message);
      })
      .catch(() => {
        if (cancelled) return;
        setWelcomeEnabled(false);
        setSavedWelcomeEnabled(false);
        setWelcomeMessage(DEFAULT_WELCOME_AUTO_REPLY);
        setSavedWelcomeMessage(DEFAULT_WELCOME_AUTO_REPLY);
      })
      .finally(() => {
        if (!cancelled) setWelcomeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canManageReplies]);

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

  const handleSaveWelcomeAutoReply = useCallback(async () => {
    const message = welcomeMessage.trim();
    if (!message) {
      adminToast("Welcome message is required.", false);
      return;
    }

    setSavingWelcome(true);
    hideAdminToast();
    try {
      const updated = await updateChatWelcomeAutoReply({
        enabled: welcomeEnabled,
        message,
      });
      setWelcomeEnabled(updated.enabled);
      setSavedWelcomeEnabled(updated.enabled);
      setWelcomeMessage(updated.message);
      setSavedWelcomeMessage(updated.message);
      adminToast("Welcome auto-reply updated.", true);
    } catch (err) {
      adminToast(err instanceof Error ? err.message : "Update failed.", false);
    } finally {
      setSavingWelcome(false);
    }
  }, [welcomeEnabled, welcomeMessage]);

  const togglesDisabled = settingsLoading;
  const responseTimeDirty =
    averageResponseTime.trim() !== savedAverageResponseTime.trim();
  const welcomeDirty =
    welcomeEnabled !== savedWelcomeEnabled ||
    welcomeMessage.trim() !== savedWelcomeMessage.trim();

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
          <p className="text-sm text-foreground-muted">
            Picture uploads and chat without login are managed per role under{" "}
            <Link
              href="/admin/settings/roles"
              className="text-accent hover:underline"
            >
              Settings → Roles &amp; permissions
            </Link>{" "}
            (LIVE CHAT group). On the Guest role, &quot;without login&quot;
            controls site-wide anonymous chat.
          </p>
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
        title="Automatic welcome reply"
        subtitle="Reply instantly when a customer starts a new conversation"
        className="w-full"
      >
        {canManageReplies ? (
          <div className="space-y-3">
            <SettingSwitchRow
              title="Enable welcome auto-reply"
              description="After the first customer message in a support conversation, send this reply once. It will not repeat for every message."
              checked={welcomeEnabled}
              disabled={welcomeLoading || savingWelcome}
              ariaLabel="Enable live chat welcome auto-reply"
              onToggle={setWelcomeEnabled}
            />
            <div>
              <label
                htmlFor="chat-welcome-auto-reply"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Welcome message
              </label>
              <textarea
                id="chat-welcome-auto-reply"
                rows={4}
                maxLength={1000}
                value={welcomeMessage}
                disabled={welcomeLoading || savingWelcome}
                onChange={(event) => setWelcomeMessage(event.target.value)}
                className="admin-input min-h-24 w-full resize-y"
                placeholder={DEFAULT_WELCOME_AUTO_REPLY}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-foreground-muted">
                  {welcomeMessage.length.toLocaleString()} / 1,000 characters
                </span>
                <button
                  type="button"
                  disabled={
                    welcomeLoading ||
                    savingWelcome ||
                    !welcomeDirty ||
                    !welcomeMessage.trim()
                  }
                  onClick={() => void handleSaveWelcomeAutoReply()}
                  className="dashboard-pro-btn-ghost shrink-0 px-4 py-2 text-sm disabled:opacity-50"
                >
                  {savingWelcome ? "Saving…" : "Save welcome reply"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">
            Welcome auto-replies can be edited by chat staff (admin or support).
            Ask a team lead to grant chat access if you need to change this message.
          </p>
        )}
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
        {canManageReplies ? (
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
