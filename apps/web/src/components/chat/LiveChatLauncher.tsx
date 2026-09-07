"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChatIcon, CloseIcon } from "@/components/admin/icons";
import {
  ChatHeaderRefreshButton,
  ChatPanel,
} from "@/components/chat/ChatPanel";
import { SupportTeamAvatar } from "@/components/chat/ChatRoomAvatar";
import { useStaffChatAlerts } from "@/hooks/useStaffChatAlerts";
import {
  notifyUnreadCountChanged,
  useUnreadNotifications,
} from "@/hooks/useUnreadNotifications";
import { markChatNotificationsRead, startGuestChatSession, getOnlineSupportStaff } from "@/lib/api";
import type { ChatSupportAgent } from "@/lib/api";
import { FabChatBubbleIcon } from "@/components/chat/FabChatBubbleIcon";
import { canAccessLiveChat } from "@/lib/chat-access";
import { useChatOverlayLock } from "@/hooks/useChatOverlayLock";
import { rolesFromAccessToken } from "@/lib/auth-roles";

type ChatLauncherRole = "guest" | "customer" | "staff";

function resolveLauncherRole(): ChatLauncherRole {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken")
      : null;
  if (!token) return "guest";
  const roles = rolesFromAccessToken(token);
  if (roles.includes("admin") || roles.includes("support")) return "staff";
  return "customer";
}

function isLauncherHidden(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/admin/chat") ||
    pathname === "/chat" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register")
  );
}

export function LiveChatLauncher({
  allowGuestChat = false,
}: {
  allowGuestChat?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<ChatLauncherRole>("guest");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestStarting, setGuestStarting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [refreshingChat, setRefreshingChat] = useState(false);
  const [supportAgents, setSupportAgents] = useState<ChatSupportAgent[]>([]);
  const chatRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const onChatRefreshReady = useCallback((api: { refresh: () => Promise<void> }) => {
    chatRefreshRef.current = api.refresh;
  }, []);

  const syncRole = useCallback(() => {
    setRole(resolveLauncherRole());
  }, []);

  useEffect(() => {
    setMounted(true);
    syncRole();
    // Lets other pages (e.g. /contact) open the chat overlay programmatically.
    const openFromEvent = () => setOpen(true);
    window.addEventListener("auth-change", syncRole);
    window.addEventListener("live-chat:open", openFromEvent);
    return () => {
      window.removeEventListener("auth-change", syncRole);
      window.removeEventListener("live-chat:open", openFromEvent);
    };
  }, [syncRole]);

  useStaffChatAlerts(role === "staff" && !pathname?.startsWith("/admin"));

  const chatAllowed = canAccessLiveChat(allowGuestChat);

  const unread = useUnreadNotifications(
    chatAllowed,
    role === "staff" ? "staff" : "customer",
    true,
  );

  const hidden = isLauncherHidden(pathname);

  useEffect(() => {
    if (!open || role === "staff" || !chatAllowed) return;
    getOnlineSupportStaff()
      .then(setSupportAgents)
      .catch(() => setSupportAgents([]));
  }, [open, role, chatAllowed]);

  useEffect(() => {
    if (!open || !chatAllowed) return;
    markChatNotificationsRead(role === "staff" ? "staff" : "customer")
      .then(() => notifyUnreadCountChanged())
      .catch(() => undefined);
  }, [open, role, chatAllowed]);

  async function handleGuestStart(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;
    setGuestStarting(true);
    setGuestError(null);
    try {
      const result = await startGuestChatSession(guestName.trim());
      localStorage.setItem("accessToken", result.accessToken);
      localStorage.setItem("refreshToken", result.refreshToken);
      window.dispatchEvent(new Event("auth-change"));
      syncRole();
    } catch {
      setGuestError("Could not start chat. Please try again.");
    } finally {
      setGuestStarting(false);
    }
  }

  useEffect(() => {
    setOpen(false);
    setMobileThreadOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) setMobileThreadOpen(false);
  }, [open]);

  useChatOverlayLock(open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (hidden) return null;

  const isStaff = role === "staff";
  const dashboardHref = isStaff ? "/admin/chat" : "/chat";
  const messengerTitle = isStaff ? "Chats" : "Live Support";
  const messengerSubtitle = isStaff
    ? ""
    : "Chat with our team in real time";

  const overlay =
    open && mounted
      ? createPortal(
          <div className="admin-chat-messenger-root">
            <button
              type="button"
              className="admin-chat-messenger-backdrop"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            />
            <div
              className="admin-chat-messenger"
              role="dialog"
              aria-label={messengerTitle}
            >
              <header
                className={`admin-chat-messenger-head${
                  mobileThreadOpen ? " admin-chat-messenger-head--thread-mobile" : ""
                }`}
              >
                <div className="admin-chat-messenger-brand">
                  {isStaff ? (
                    <span className="admin-chat-messenger-brand-icon" aria-hidden>
                      <FabChatBubbleIcon className="h-5 w-5" />
                    </span>
                  ) : (
                    <SupportTeamAvatar
                      members={supportAgents}
                      online={supportAgents.length > 0}
                      className="admin-chat-messenger-brand-avatar"
                      size="sm"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="admin-chat-messenger-title">{messengerTitle}</p>
                    {messengerSubtitle ? (
                      <p className="admin-chat-messenger-subtitle">
                        {messengerSubtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="admin-chat-messenger-actions">
                  {role !== "guest" ? (
                    <Link
                      href={dashboardHref}
                      className="admin-chat-messenger-link"
                      onClick={() => setOpen(false)}
                    >
                      Dashboard view
                    </Link>
                  ) : null}
                  {chatAllowed ? (
                    <ChatHeaderRefreshButton
                      onClick={() => void chatRefreshRef.current?.()}
                      busy={refreshingChat}
                      className={`admin-chat-messenger-refresh${
                        role === "staff" ? " admin-chat-refresh-btn--staff" : ""
                      }`}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="admin-chat-messenger-close"
                    onClick={() => setOpen(false)}
                    aria-label="Close chat"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>
              </header>
              <div className="admin-chat-messenger-body">
                {!chatAllowed && role !== "staff" ? (
                  <div className="live-chat-guest-prompt">
                    <div className="live-chat-guest-prompt-glow" aria-hidden />
                    <div className="live-chat-guest-prompt-inner">
                      <div className="live-chat-guest-prompt-icon-wrap">
                        <span className="live-chat-guest-prompt-icon-ring" aria-hidden />
                        <span className="live-chat-guest-prompt-icon">
                          <FabChatBubbleIcon className="h-9 w-9" />
                        </span>
                      </div>

                      {allowGuestChat && role === "guest" ? (
                        /* ── Guest chat form ── */
                        <>
                          <div className="live-chat-guest-prompt-copy">
                            <h3 className="live-chat-guest-prompt-title">
                              Start a conversation
                            </h3>
                            <p className="live-chat-guest-prompt-desc">
                              Enter your name to chat with our support team without logging in.
                            </p>
                          </div>
                          <form
                            onSubmit={(e) => void handleGuestStart(e)}
                            className="w-full space-y-3"
                          >
                            <input
                              type="text"
                              className="admin-input w-full"
                              placeholder="Your name…"
                              value={guestName}
                              onChange={(e) => setGuestName(e.target.value)}
                              maxLength={60}
                              autoFocus
                            />
                            {guestError ? (
                              <p className="text-xs text-danger">{guestError}</p>
                            ) : null}
                            <button
                              type="submit"
                              disabled={guestStarting || !guestName.trim()}
                              className="live-chat-guest-prompt-btn live-chat-guest-prompt-btn--primary w-full disabled:opacity-50"
                            >
                              {guestStarting ? "Starting…" : "Start chat"}
                            </button>
                          </form>
                          <p className="live-chat-guest-prompt-foot">
                            Or{" "}
                            <button
                              type="button"
                              className="underline"
                              onClick={() => { setOpen(false); router.push("/login?next=%2Fchat"); }}
                            >
                              sign in
                            </button>{" "}
                            for full access
                          </p>
                        </>
                      ) : (
                        /* ── Login required ── */
                        <>
                          <div className="live-chat-guest-prompt-copy">
                            <h3 className="live-chat-guest-prompt-title">
                              Sign in to chat
                            </h3>
                            <p className="live-chat-guest-prompt-desc">
                              Log in or create an account to message our support team in real time.
                            </p>
                          </div>
                          <div className="live-chat-guest-prompt-actions">
                            <button
                              type="button"
                              className="live-chat-guest-prompt-btn live-chat-guest-prompt-btn--primary"
                              onClick={() => { setOpen(false); router.push("/login?next=%2Fchat"); }}
                            >
                              Sign in
                            </button>
                            <Link
                              href="/register"
                              className="live-chat-guest-prompt-btn live-chat-guest-prompt-btn--ghost"
                              onClick={() => setOpen(false)}
                            >
                              Create account
                            </Link>
                          </div>
                          <p className="live-chat-guest-prompt-foot">
                            Fast replies · Secure &amp; private
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : isStaff ? (
                  <ChatPanel
                    isAdmin
                    pro
                    messenger
                    onMessengerMobileViewChange={(view) =>
                      setMobileThreadOpen(view === "thread")
                    }
                    onMessengerClose={() => setOpen(false)}
                    onRefreshReady={onChatRefreshReady}
                    onRefreshingChange={setRefreshingChat}
                  />
                ) : (
                  <ChatPanel
                    embedded
                    messenger
                    onMessengerMobileViewChange={(view) =>
                      setMobileThreadOpen(view === "thread")
                    }
                    onMessengerClose={() => setOpen(false)}
                    onRefreshReady={onChatRefreshReady}
                    onRefreshingChange={setRefreshingChat}
                    onSupportAgentsChange={setSupportAgents}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {overlay}
      <div className="admin-chat-launcher" aria-live="polite">
        <div
          className={`admin-chat-launcher-fab-wrap${unread > 0 ? " admin-chat-launcher-fab-wrap--alert" : ""}${open ? " admin-chat-launcher-fab-wrap--open" : ""}`}
        >
          <span className="admin-chat-launcher-fab-aura" aria-hidden />
          <span className="admin-chat-launcher-fab-halo" aria-hidden />
          <span
            className="admin-chat-launcher-fab-halo admin-chat-launcher-fab-halo--reverse"
            aria-hidden
          />
          <span className="admin-chat-launcher-fab-orbit" aria-hidden>
            <span className="admin-chat-launcher-fab-spark admin-chat-launcher-fab-spark--1" />
            <span className="admin-chat-launcher-fab-spark admin-chat-launcher-fab-spark--2" />
            <span className="admin-chat-launcher-fab-spark admin-chat-launcher-fab-spark--3" />
          </span>
          <span
            className="admin-chat-launcher-fab-orbit admin-chat-launcher-fab-orbit--outer"
            aria-hidden
          >
            <span className="admin-chat-launcher-fab-spark admin-chat-launcher-fab-spark--4" />
            <span className="admin-chat-launcher-fab-spark admin-chat-launcher-fab-spark--5" />
            <span className="admin-chat-launcher-fab-spark admin-chat-launcher-fab-spark--6" />
          </span>
          <span
            className="admin-chat-launcher-fab-orbit admin-chat-launcher-fab-orbit--reverse"
            aria-hidden
          >
            <span className="admin-chat-launcher-fab-spark admin-chat-launcher-fab-spark--7" />
            <span className="admin-chat-launcher-fab-spark admin-chat-launcher-fab-spark--8" />
          </span>
          <span className="admin-chat-launcher-fab-ring" aria-hidden />
          <span
            className="admin-chat-launcher-fab-ring admin-chat-launcher-fab-ring--delayed"
            aria-hidden
          />
          <span
            className="admin-chat-launcher-fab-ring admin-chat-launcher-fab-ring--slow"
            aria-hidden
          />
          <span
            className="admin-chat-launcher-fab-ring admin-chat-launcher-fab-ring--outer"
            aria-hidden
          />
          <button
            type="button"
            className="admin-chat-launcher-fab"
            onClick={() => setOpen(true)}
            aria-label="Open live chat"
            aria-expanded={open}
          >
            <span className="admin-chat-launcher-fab-border-spin" aria-hidden />
            <span className="admin-chat-launcher-fab-shimmer-loop" aria-hidden />
            <span className="admin-chat-launcher-fab-icon-shell">
              <FabChatBubbleIcon
                className="admin-chat-launcher-fab-icon"
                animated
              />
            </span>
            <span className="admin-chat-launcher-fab-hint">
              <ChatIcon className="h-3.5 w-3.5" aria-hidden />
              Chat
            </span>
          </button>
          {unread > 0 ? (
            <>
              <span className="admin-chat-launcher-fab-badge-ring" aria-hidden />
              <span
                key={unread}
                className="admin-chat-launcher-fab-badge"
                aria-hidden
              >
                {unread > 99 ? "99+" : unread}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
