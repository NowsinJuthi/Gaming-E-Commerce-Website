"use client";

import { useEffect, useState } from "react";
import {
  addPushToken,
  getNotifications,
  getPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  removePushToken,
  setTelegram,
  updatePreferences,
  type NotificationChannels,
  type NotificationItem,
  type NotificationPrefs,
} from "@/lib/api";
import {
  accountPanelClass,
  accountSectionStackClass,
  type AccountSectionProps,
} from "@/components/account/account-section-layout";

const CHANNELS: Array<{ key: keyof NotificationChannels; label: string }> = [
  { key: "inApp", label: "In-app" },
  { key: "email", label: "Email" },
  { key: "push", label: "Push" },
  { key: "telegram", label: "Telegram" },
];

const EVENT_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "order.placed", label: "Order placed" },
  { key: "order.paid", label: "Order paid" },
  { key: "order.delivered", label: "Order delivered" },
  { key: "order.refunded", label: "Order refunded" },
  { key: "wallet.credited", label: "Wallet credited" },
  { key: "wallet.debited", label: "Wallet debited" },
  { key: "wallet.withdrawal_processed", label: "Withdrawal updates" },
  { key: "affiliate.payout", label: "Affiliate payout" },
  { key: "ticket.reply", label: "Ticket replies" },
];

function ToggleSwitch({
  pressed,
  onToggle,
}: {
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pressed}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        pressed ? "bg-brand" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-[left] duration-200 ${
          pressed ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function NotificationsSection({ embedded = false }: AccountSectionProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [telegramId, setTelegramId] = useState("");
  const [pushToken, setPushToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      getPreferences(),
      getNotifications({ audience: "customer", excludeChat: true }),
    ])
      .then(([prefResult, notifResult]) => {
        if (cancelled) return;
        if (prefResult.status === "fulfilled") {
          setPrefs(prefResult.value);
          setTelegramId(prefResult.value.telegramChatId ?? "");
        } else {
          setPrefs(null);
          setMsg({
            text: "Could not load notification preferences.",
            ok: false,
          });
        }
        if (notifResult.status === "fulfilled") {
          setItems(notifResult.value.items);
        } else {
          setItems([]);
          setMsg(
            (current) =>
              current ?? {
                text: "Could not load recent notifications.",
                ok: false,
              },
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleEvent(eventKey: string) {
    if (!prefs) return;
    const prevPrefs = prefs;
    const mutedEvents = prefs.mutedEvents ?? [];
    const muted = mutedEvents.includes(eventKey);
    const nextMuted = muted
      ? mutedEvents.filter((e) => e !== eventKey)
      : [...mutedEvents, eventKey];
    setPrefs({ ...prefs, mutedEvents: nextMuted });
    try {
      const updated = await updatePreferences({ mutedEvents: nextMuted });
      setPrefs(updated);
    } catch {
      setMsg({ text: "Could not update event preference.", ok: false });
      setPrefs(prevPrefs);
    }
  }

  async function toggleChannel(key: keyof NotificationChannels) {
    if (!prefs) return;
    const prevPrefs = prefs;
    const next = !prefs.channels[key];
    setPrefs({ ...prefs, channels: { ...prefs.channels, [key]: next } });
    try {
      const updated = await updatePreferences({ channels: { [key]: next } });
      setPrefs(updated);
    } catch {
      setMsg({ text: "Could not update channel.", ok: false });
      setPrefs(prevPrefs);
    }
  }

  async function saveTelegram(clear = false) {
    setMsg(null);
    const value = clear ? "" : telegramId.trim();
    try {
      const updated = await setTelegram(value);
      setPrefs(updated);
      if (clear) {
        setTelegramId("");
        setMsg({ text: "Telegram disconnected.", ok: true });
      } else {
        setMsg({
          text: "Telegram connected. You will now receive alerts on Telegram.",
          ok: true,
        });
      }
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Could not save Telegram chat ID.";
      setMsg({ text: detail, ok: false });
    }
  }

  async function onAddPush() {
    if (!pushToken.trim()) return;
    setMsg(null);
    try {
      const updated = await addPushToken(pushToken.trim());
      setPrefs(updated);
      setPushToken("");
      setMsg({ text: "Push token added.", ok: true });
    } catch {
      setMsg({ text: "Could not add push token.", ok: false });
    }
  }

  async function onRemovePush(token: string) {
    setMsg(null);
    try {
      const updated = await removePushToken(token);
      setPrefs(updated);
      setMsg({ text: "Push token removed.", ok: true });
    } catch {
      setMsg({ text: "Could not remove push token.", ok: false });
    }
  }

  async function onMarkRead(id: string) {
    const prev = items;
    setItems((cur) =>
      cur.map((n) => (n._id === id ? { ...n, read: true } : n)),
    );
    try {
      await markNotificationRead(id);
    } catch {
      setItems(prev);
    }
  }

  async function onMarkAll() {
    const prev = items;
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead("customer");
    } catch {
      setItems(prev);
    }
  }

  if (loading) {
    return (
      <div
        className={accountPanelClass(
          embedded,
          "p-10 text-center text-sm text-foreground-muted",
        )}
      >
        Loading notifications…
      </div>
    );
  }

  const sectionPanel = (extra?: string) => accountPanelClass(embedded, extra);

  return (
    <div className={accountSectionStackClass(embedded)}>
      {msg ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.ok
              ? "border-brand/30 bg-brand/10 text-brand"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      {!prefs ? (
        <div className={sectionPanel("text-sm text-foreground-muted")}>
          Notification preferences could not be loaded. Recent notifications are
          still shown below.
        </div>
      ) : null}

      <div className="grid w-full gap-5 lg:grid-cols-2">
        <section className={sectionPanel()}>
          <h3 className="text-sm font-semibold text-foreground">Channels</h3>
          <p className="mt-1 text-xs text-foreground-muted">
            Choose how you want to receive notifications.
          </p>
          <div className="mt-3 space-y-2">
            {prefs ? (
              CHANNELS.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between rounded-lg border border-border bg-elevated px-4 py-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {c.label}
                  </span>
                  <ToggleSwitch
                    pressed={prefs.channels[c.key]}
                    onToggle={() => toggleChannel(c.key)}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-foreground-muted">
                Preferences unavailable.
              </p>
            )}
          </div>
        </section>

        <section className={sectionPanel()}>
          <h3 className="text-sm font-semibold text-foreground">Event alerts</h3>
          <p className="mt-1 text-xs text-foreground-muted">
            Mute specific event types across all enabled channels.
          </p>
          <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {prefs ? (
              EVENT_OPTIONS.map((ev) => {
                const enabled = !(prefs.mutedEvents ?? []).includes(ev.key);
                return (
                  <div
                    key={ev.key}
                    className="flex items-center justify-between rounded-lg border border-border bg-elevated px-4 py-3"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {ev.label}
                    </span>
                    <ToggleSwitch
                      pressed={enabled}
                      onToggle={() => toggleEvent(ev.key)}
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-foreground-muted">
                Preferences unavailable.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid w-full gap-5 lg:grid-cols-2">
        <section className={sectionPanel()}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Telegram</h3>
            {prefs?.telegramChatId ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                Not set
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            Enter your Telegram chat ID to receive order and account alerts directly in Telegram.
          </p>
          {/* How-to guide */}
          <ol className="mt-2 list-inside list-decimal space-y-0.5 text-xs text-foreground-muted">
            <li>Open Telegram and search for our store bot.</li>
            <li>Send <code className="rounded bg-elevated px-1 font-mono">/start</code> to the bot.</li>
            <li>The bot will reply with your Chat ID — paste it below.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="e.g. 123456789"
              className="admin-input min-w-[180px] flex-1"
              type="text"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => saveTelegram()}
              className="btn-primary btn-primary-sm"
            >
              {prefs?.telegramChatId ? "Update" : "Connect"}
            </button>
            {prefs?.telegramChatId ? (
              <button
                type="button"
                onClick={() => saveTelegram(true)}
                className="btn-primary btn-primary-sm border-danger/40 bg-danger/10 text-danger hover:bg-danger/20"
              >
                Remove
              </button>
            ) : null}
          </div>
          {prefs?.telegramChatId ? (
            <p className="mt-2 text-xs text-foreground-muted">
              Connected ID:{" "}
              <code className="rounded bg-elevated px-1 font-mono">
                {prefs.telegramChatId}
              </code>
            </p>
          ) : null}
        </section>

        <section className={sectionPanel()}>
          <h3 className="text-sm font-semibold text-foreground">Push devices</h3>
          <p className="mt-1 text-xs text-foreground-muted">
            Register device tokens (e.g. FCM) for push notifications.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={pushToken}
              onChange={(e) => setPushToken(e.target.value)}
              placeholder="Device push token"
              className="admin-input min-w-[200px] flex-1"
            />
            <button
              type="button"
              onClick={onAddPush}
              className="btn-primary btn-primary-sm"
            >
              Add
            </button>
          </div>
          {prefs && prefs.pushTokens.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {prefs.pushTokens.map((t) => (
                <li
                  key={t}
                  className="flex items-center justify-between rounded-lg border border-border bg-elevated px-3 py-2 text-sm"
                >
                  <span className="truncate font-mono text-xs text-foreground-muted">
                    {t}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemovePush(t)}
                    className="ml-3 shrink-0 text-rose-300 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className={sectionPanel()}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Recent notifications
          </h3>
          {items.some((n) => !n.read) ? (
            <button
              type="button"
              onClick={onMarkAll}
              className="text-sm font-medium text-brand hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground-muted">
            No notifications yet.
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {items.map((n) => (
              <li
                key={n._id}
                className={`rounded-lg border px-4 py-3 ${
                  n.read
                    ? "border-border bg-elevated"
                    : "border-brand/30 bg-brand/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 text-sm text-foreground-muted">
                        {n.body}
                      </p>
                    ) : null}
                    {n.createdAt ? (
                      <p className="mt-1 text-xs text-subtle">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  {!n.read ? (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n._id)}
                      className="shrink-0 text-xs font-medium text-brand hover:underline"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
