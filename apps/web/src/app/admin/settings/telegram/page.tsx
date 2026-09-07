"use client";

import { adminToast, hideAdminToast } from "@/lib/admin-toast";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminOrderPageIntro,
  AdminOrderTwoColumnLayout,
  SETTINGS_QUICK_LINKS,
} from "@/components/admin/admin-order-page-shell";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ProductFormOrderCard } from "@/components/admin/product-form-section";
import { ChatIcon, CheckIcon, PulseIcon } from "@/components/admin/icons";
import {
  discoverTelegramChats,
  getTelegramSettings,
  testTelegramSettings,
  updateTelegramSettings,
  type TelegramDiscoveredChat,
  type TelegramSettingsView,
} from "@/lib/api";

const inputCls = "admin-input w-full";
const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-subtle";

export default function AdminTelegramSettingsPage() {
  const [settings, setSettings] = useState<TelegramSettingsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [notifyOnOrderPlaced, setNotifyOnOrderPlaced] = useState(true);
  const [notifyOnCustomerChat, setNotifyOnCustomerChat] = useState(true);
  const [chatId, setChatId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredChats, setDiscoveredChats] = useState<TelegramDiscoveredChat[]>(
    [],
  );
  const [discoverHint, setDiscoverHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getTelegramSettings();
      setSettings(data);
      setEnabled(data.enabled);
      setNotifyOnOrderPlaced(data.notifyOnOrderPlaced);
      setNotifyOnCustomerChat(data.notifyOnCustomerChat);
      setChatId(data.chatId);
      setBotToken("");
    } catch (err) {
      setSettings(null);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load Telegram settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    setSaving(true);
    hideAdminToast();
    try {
      const updated = await updateTelegramSettings({
        enabled,
        chatId: chatId.trim(),
        notifyOnOrderPlaced,
        notifyOnCustomerChat,
        ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
      });
      setSettings(updated);
      setBotToken("");
      adminToast("Telegram settings saved.", true);
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Failed to save Telegram settings.",
        false,
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDiscoverChats() {
    setDiscovering(true);
    hideAdminToast();
    setDiscoverHint(null);
    try {
      if (botToken.trim()) {
        const updated = await updateTelegramSettings({
          enabled,
          chatId: chatId.trim(),
          notifyOnOrderPlaced,
          notifyOnCustomerChat,
          botToken: botToken.trim(),
        });
        setSettings(updated);
        setBotToken("");
      }

      const result = await discoverTelegramChats();
      setDiscoveredChats(result.chats);
      if (result.chats.length === 1) {
        setChatId(result.chats[0]!.chatId);
      }
      if (result.hint) {
        setDiscoverHint(result.hint);
        adminToast(result.hint, false);
        return;
      }
      if (result.webhookWasCleared) {
        setDiscoverHint(
          "An old Telegram webhook was cleared so chat discovery could run.",
        );
      }
      adminToast(
        result.chats.length === 1
          ? "Chat ID found and filled in automatically."
          : `Found ${result.chats.length} chats. Select the one you want below.`,
        true,
      );
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Could not find Telegram chats.",
        false,
      );
    } finally {
      setDiscovering(false);
    }
  }

  async function onTest() {
    setTesting(true);
    hideAdminToast();
    try {
      const updated = await updateTelegramSettings({
        enabled,
        chatId: chatId.trim(),
        notifyOnOrderPlaced,
        notifyOnCustomerChat,
        ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
      });
      setSettings(updated);
      setBotToken("");

      const result = await testTelegramSettings();
      if (!result.success) {
        adminToast(result.error ?? "Test message failed.", false);
        return;
      }
      adminToast(
        result.botUsername
          ? `Test message sent via ${result.botUsername}.`
          : "Test message sent to Telegram.",
        true,
      );
    } catch (err) {
      adminToast(
        err instanceof Error ? err.message : "Test message failed.",
        false,
      );
    } finally {
      setTesting(false);
    }
  }

  const configured = settings?.configured ?? false;

  return (
    <AdminPageLayout
      section="Settings"
      title="Telegram bot"
      description="Connect a Telegram bot for order status alerts and live chat notifications."
      icon={ChatIcon}
      backHref="/admin/settings"
      backLabel="General"
      loading={loading}
      loadingText="Loading Telegram settings…"
      action={
        !loading && settings ? (
          <span
            className={`dashboard-pro-status${
              configured
                ? " dashboard-pro-status--green"
                : " dashboard-pro-status--amber"
            }`}
          >
            {configured ? "Connected" : "Not connected"}
          </span>
        ) : null
      }
    >
      {loadError && !settings ? (
        <ProductFormOrderCard
          title="Could not load Telegram settings"
          subtitle={loadError}
          className="admin-product-form-section"
        >
          <button
            type="button"
            onClick={() => void load()}
            className="dashboard-pro-btn-ghost text-xs"
          >
            Retry
          </button>
        </ProductFormOrderCard>
      ) : (
        <>
          <AdminOrderPageIntro
            icon={<ChatIcon className="h-4 w-4" />}
            title="Order alerts on Telegram"
            subtitle={
              configured
                ? "New orders will be sent to your Telegram chat."
                : "Add bot token and chat ID to start receiving order alerts."
            }
            quickLinks={SETTINGS_QUICK_LINKS}
            quickNavLabel="Settings shortcuts"
          />

          <AdminOrderTwoColumnLayout
            main={
              <ProductFormOrderCard
                icon={<ChatIcon className="h-4 w-4" />}
                title="Telegram connection"
                subtitle="Bot token, chat ID, and order alert toggle"
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Status</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-4">
                    {settings?.botUsername ? (
                      <p className="text-xs text-foreground-muted">
                        Bot:{" "}
                        <span className="font-semibold text-foreground">
                          {settings.botUsername}
                        </span>
                      </p>
                    ) : null}
                    <label className="flex items-center gap-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="rounded border-border-strong"
                      />
                      Enable Telegram bot
                    </label>
                    <label className="flex items-center gap-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={notifyOnOrderPlaced}
                        onChange={(e) => setNotifyOnOrderPlaced(e.target.checked)}
                        className="rounded border-border-strong"
                      />
                      Send alert when an order is paid, processing, or auto-fulfilled
                      (not on pending checkout or manual admin complete)
                    </label>
                    <label className="flex items-center gap-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={notifyOnCustomerChat}
                        onChange={(e) => setNotifyOnCustomerChat(e.target.checked)}
                        className="rounded border-border-strong"
                      />
                      Send notification when a customer sends a live chat message
                    </label>
                  </dd>
                </div>

                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Bot token</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-2">
                    <label className={labelCls}>Telegram bot token</label>
                    <input
                      type="password"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder={
                        settings?.hasBotToken
                          ? settings.botTokenMasked || "Token saved"
                          : "123456789:ABCdefGHI..."
                      }
                      className={inputCls}
                      autoComplete="off"
                    />
                    {settings?.botTokenFromEnv ? (
                      <p className="text-xs text-foreground-muted">
                        Using <code>TELEGRAM_BOT_TOKEN</code> from server env as
                        fallback. Saving a token here overrides the env value.
                      </p>
                    ) : null}
                  </dd>
                </div>

                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Chat ID</dt>
                  <dd className="admin-product-form-sidebar-fields space-y-3">
                    <label className={labelCls}>Telegram chat ID</label>
                    <input
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      placeholder="123456789 or -1001234567890"
                      className={inputCls}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void onDiscoverChats()}
                        disabled={discovering || saving}
                        className="dashboard-pro-btn-ghost text-xs disabled:opacity-50"
                      >
                        {discovering ? "Finding…" : "Find chat ID"}
                      </button>
                    </div>
                    {discoverHint ? (
                      <p className="text-xs text-foreground-muted">{discoverHint}</p>
                    ) : null}
                    {discoveredChats.length > 1 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
                          Select a chat
                        </p>
                        <div className="flex flex-col gap-2">
                          {discoveredChats.map((chat) => (
                            <button
                              key={chat.chatId}
                              type="button"
                              onClick={() => setChatId(chat.chatId)}
                              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                chatId === chat.chatId
                                  ? "border-brand/40 bg-brand/10 text-foreground"
                                  : "border-border/45 bg-elevated/40 text-foreground-muted hover:border-border/70"
                              }`}
                            >
                              <span className="block font-semibold text-foreground">
                                {chat.title}
                              </span>
                              <span className="mt-0.5 block text-xs">
                                {chat.type}
                                {chat.username ? ` · ${chat.username}` : ""} · ID{" "}
                                {chat.chatId}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <p className="text-xs text-foreground-muted">
                      Use <strong>message.chat.id</strong>, not{" "}
                      <strong>from.id</strong>. Private chats are usually a positive
                      number; groups start with <code>-100</code>.
                    </p>
                  </dd>
                </div>

                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Actions</dt>
                  <dd className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void onSave()}
                      disabled={saving}
                      className="btn-primary disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save settings"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onTest()}
                      disabled={testing || saving}
                      className="dashboard-pro-btn-ghost disabled:opacity-50"
                    >
                      {testing ? "Sending…" : "Send test message"}
                    </button>
                  </dd>
                </div>
              </ProductFormOrderCard>
            }
            sidebar={
              <ProductFormOrderCard
                icon={<PulseIcon className="h-4 w-4" />}
                title="Setup guide"
                subtitle="How to connect Telegram"
                className="admin-product-form-section"
              >
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>1. Create bot</dt>
                  <dd className="text-sm text-foreground-muted">
                    Open Telegram, search <strong>@BotFather</strong>, send{" "}
                    <code>/newbot</code>, and copy the bot token.
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>2. Get chat ID</dt>
                  <dd className="text-sm text-foreground-muted">
                    Open your bot in Telegram, press <strong>Start</strong>, send
                    any message, then open{" "}
                    <code>
                      https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
                    </code>{" "}
                    and copy the <code>message.chat.id</code> value. For groups,
                    add the bot to the group first.
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>3. Live chat alerts</dt>
                  <dd className="text-sm text-foreground-muted">
                    When a customer sends a message in live chat, the same Telegram
                    bot can notify you instantly with the message preview.
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>4. Order alerts</dt>
                  <dd className="text-sm text-foreground-muted">
                    Telegram alerts fire when payment succeeds (paid), when
                    fulfillment starts (processing), and when all items are
                    auto-delivered. Pending checkout and manual admin complete do
                    not send Telegram — customer delivery email is configured in{" "}
                    <Link
                      href="/admin/settings/email"
                      className="text-accent hover:underline"
                    >
                      Email settings
                    </Link>
                    .
                  </dd>
                </div>
                <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                  <dt>Notifications</dt>
                  <dd className="text-sm text-foreground-muted">
                    Customer Telegram delivery is managed separately under{" "}
                    <Link
                      href="/admin/settings/notifications"
                      className="text-accent hover:underline"
                    >
                      Settings → Notifications
                    </Link>
                    .
                  </dd>
                </div>
                {settings?.configured ? (
                  <div className="admin-order-view-detail-row admin-order-view-detail-row--stacked">
                    <dt>Connected</dt>
                    <dd className="inline-flex items-center gap-2 text-sm text-emerald-300">
                      <CheckIcon className="h-4 w-4" aria-hidden />
                      Telegram bot is ready for order alerts.
                    </dd>
                  </div>
                ) : null}
              </ProductFormOrderCard>
            }
          />
        </>
      )}
    </AdminPageLayout>
  );
}
