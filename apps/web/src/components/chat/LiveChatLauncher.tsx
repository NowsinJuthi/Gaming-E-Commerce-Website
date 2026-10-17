"use client";
import { getSessionRoles, hasAuthSession } from "@/lib/access-token";

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
import { useLiveChatIconAlerts } from "@/hooks/useStaffChatAlerts";
import {
  notifyUnreadCountChanged,
  useStaffChatUnreadCount,
  useUnreadNotifications,
} from "@/hooks/useUnreadNotifications";
import {
  getMe,
  getOnlineSupportStaff,
  markChatNotificationsRead,
  setTokens,
  startGuestChatSession,
} from "@/lib/api";
import { isChatStaffFromRoles } from "@/lib/chat-roles";
import type { ChatSupportAgent } from "@/lib/api";
import { FabChatBubbleIcon } from "@/components/chat/FabChatBubbleIcon";
import { canAccessLiveChat } from "@/lib/chat-access";
import { useChatOverlayLock } from "@/hooks/useChatOverlayLock";

type ChatLauncherRole = "guest" | "customer" | "staff";

const CHAT_DOCK_KEY = "uniqbd.chatLauncherDock";

type ChatDock = { side: "left" | "right"; bottom: number };

function readChatDock(): ChatDock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAT_DOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatDock>;
    const bottom = Number(parsed.bottom);
    if (parsed.side !== "left" && parsed.side !== "right") return null;
    if (!Number.isFinite(bottom)) return null;
    return { side: parsed.side, bottom };
  } catch {
    return null;
  }
}

function clampChatBottom(bottom: number, height: number): number {
  const margin = 12;
  const max = Math.max(margin, window.innerHeight - height - margin);
  return Math.min(max, Math.max(margin, bottom));
}

function resolveLauncherRole(): ChatLauncherRole {
  if (typeof window === "undefined" || !hasAuthSession()) return "guest";
  if (isChatStaffFromRoles(getSessionRoles())) return "staff";
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
  const [overlayRole, setOverlayRole] = useState<
    ChatLauncherRole | "loading"
  >("loading");
  const chatRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const [dock, setDock] = useState<ChatDock | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const onChatRefreshReady = useCallback(
    (api: { refresh: () => Promise<void> }) => {
      chatRefreshRef.current = api.refresh;
    },
    [],
  );

  const syncRole = useCallback(() => {
    setRole(resolveLauncherRole());
  }, []);

  useEffect(() => {
    setMounted(true);
    setDock(readChatDock());
    syncRole();
    let cancelled = false;
    if (hasAuthSession() && !isChatStaffFromRoles(getSessionRoles())) {
      getMe()
        .then((me) => {
          if (cancelled) return;
          if (isChatStaffFromRoles(me.roles ?? [])) setRole("staff");
        })
        .catch(() => undefined);
    }
    // Lets other pages (e.g. /contact) open the chat overlay programmatically.
    const openFromEvent = () => setOpen(true);
    window.addEventListener("auth-change", syncRole);
    window.addEventListener("live-chat:open", openFromEvent);
    return () => {
      cancelled = true;
      window.removeEventListener("auth-change", syncRole);
      window.removeEventListener("live-chat:open", openFromEvent);
    };
  }, [syncRole]);

  const chatAllowed = canAccessLiveChat(allowGuestChat);

  const staffUnread = useStaffChatUnreadCount(chatAllowed && role === "staff");
  const customerUnread = useUnreadNotifications(
    chatAllowed && role === "customer",
    "customer",
    true,
  );
  const unread = role === "staff" ? staffUnread : customerUnread;

  const hidden = isLauncherHidden(pathname);

  useEffect(() => {
    function onResize() {
      setDock((current) => {
        if (!current) return current;
        return {
          ...current,
          bottom: clampChatBottom(current.bottom, 60),
        };
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onDockPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDockPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 18) return;
    drag.moved = true;
    const x = Math.min(
      window.innerWidth - drag.width - 8,
      Math.max(8, drag.originX + dx),
    );
    const y = Math.min(
      window.innerHeight - drag.height - 8,
      Math.max(8, drag.originY + dy),
    );
    setDragging(true);
    setDragPoint({ x, y });
  }

  function finishDockDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved || event.type === "pointercancel") {
      setDragging(false);
      setDragPoint(null);
      if (!drag.moved && event.type !== "pointercancel") {
        const swallow = (clickEvent: Event) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
        };
        window.addEventListener("click", swallow, true);
        window.setTimeout(() => window.removeEventListener("click", swallow, true), 400);
        setOpen(true);
      }
      return;
    }
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 400);
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const x = Math.min(
      window.innerWidth - drag.width - 8,
      Math.max(8, drag.originX + dx),
    );
    const y = Math.min(
      window.innerHeight - drag.height - 8,
      Math.max(8, drag.originY + dy),
    );
    const side: ChatDock["side"] =
      x + drag.width / 2 < window.innerWidth / 2 ? "left" : "right";
    const next: ChatDock = {
      side,
      bottom: clampChatBottom(window.innerHeight - y - drag.height, drag.height),
    };
    setDock(next);
    localStorage.setItem(CHAT_DOCK_KEY, JSON.stringify(next));
    setDragPoint(null);
    setDragging(false);
  }

  function openChat(event: React.MouseEvent) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setOpen(true);
  }

  useLiveChatIconAlerts({
    enabled: chatAllowed && !hidden && role !== "guest",
    alertOn: role === "staff" ? "customer" : "staff",
    chatOpen: open,
    playSound: true,
    bumpUnread: role !== "guest",
  });

  useEffect(() => {
    if (!open || role === "staff" || !chatAllowed) return;
    getOnlineSupportStaff()
      .then(setSupportAgents)
      .catch(() => setSupportAgents([]));
  }, [open, role, chatAllowed]);

  useEffect(() => {
    if (!open || !chatAllowed) return;
    markChatNotificationsRead(role === "staff" ? "staff" : "customer")
      .then(() => notifyUnreadCountChanged(true))
      .catch(() => undefined);
  }, [open, role, chatAllowed]);

  async function handleGuestStart(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;
    setGuestStarting(true);
    setGuestError(null);
    try {
      const result = await startGuestChatSession(guestName.trim());
      setTokens(result.accessToken, result.csrfToken ?? result.refreshToken, {
        guest: true,
        roles: result.user?.roles,
        expiresIn: result.expiresIn,
      });
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

  useEffect(() => {
    if (!open) {
      setOverlayRole("loading");
      return;
    }
    let cancelled = false;
    (async () => {
      syncRole();
      const sessionRole = resolveLauncherRole();
      if (sessionRole === "staff" || sessionRole === "guest") {
        if (!cancelled) {
          setRole(sessionRole);
          setOverlayRole(sessionRole);
        }
        return;
      }
      if (!hasAuthSession()) {
        if (!cancelled) {
          setRole("guest");
          setOverlayRole("guest");
        }
        return;
      }
      try {
        const me = await getMe();
        if (cancelled) return;
        const staff = isChatStaffFromRoles(me.roles ?? []);
        const nextRole: ChatLauncherRole = staff ? "staff" : "customer";
        setRole(nextRole);
        setOverlayRole(nextRole);
      } catch {
        if (!cancelled) {
          setRole(sessionRole);
          setOverlayRole(sessionRole);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, syncRole]);

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

  const panelRole = open ? overlayRole : role;
  const isStaff = panelRole === "staff";
  const dashboardHref = isStaff ? "/admin/chat" : "/chat";
  const messengerTitle = isStaff ? "Chats" : "Live Support";
  const messengerSubtitle = isStaff ? "" : "Chat with our team in real time";

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
                  mobileThreadOpen
                    ? " admin-chat-messenger-head--thread-mobile"
                    : ""
                }`}
              >
                <div className="admin-chat-messenger-brand">
                  {isStaff ? (
                    <span
                      className="admin-chat-messenger-brand-icon"
                      aria-hidden
                    >
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
                    <p className="admin-chat-messenger-title">
                      {messengerTitle}
                    </p>
                    {messengerSubtitle ? (
                      <p className="admin-chat-messenger-subtitle">
                        {messengerSubtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="admin-chat-messenger-actions">
                  {panelRole !== "guest" && panelRole !== "loading" ? (
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
                        panelRole === "staff" ? " admin-chat-refresh-btn--staff" : ""
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
                {panelRole === "loading" ? (
                  <div className="flex flex-1 items-center justify-center p-8 text-sm text-subtle">
                    Loading chat…
                  </div>
                ) : !chatAllowed && panelRole !== "staff" ? (
                  <div className="live-chat-guest-prompt">
                    <div className="live-chat-guest-prompt-glow" aria-hidden />
                    <div className="live-chat-guest-prompt-inner">
                      <div className="live-chat-guest-prompt-icon-wrap">
                        <span
                          className="live-chat-guest-prompt-icon-ring"
                          aria-hidden
                        />
                        <span className="live-chat-guest-prompt-icon">
                          <FabChatBubbleIcon className="h-9 w-9" />
                        </span>
                      </div>

                      {allowGuestChat && panelRole === "guest" ? (
                        /* ── Guest chat form ── */
                        <>
                          <div className="live-chat-guest-prompt-copy">
                            <h3 className="live-chat-guest-prompt-title">
                              Start a conversation
                            </h3>
                            <p className="live-chat-guest-prompt-desc">
                              Enter your name to chat with our support team
                              without logging in.
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
                              <p className="text-xs text-danger">
                                {guestError}
                              </p>
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
                              onClick={() => {
                                setOpen(false);
                                router.push("/login?next=%2Fchat");
                              }}
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
                              Log in or create an account to message our support
                              team in real time.
                            </p>
                          </div>
                          <div className="live-chat-guest-prompt-actions">
                            <button
                              type="button"
                              className="live-chat-guest-prompt-btn live-chat-guest-prompt-btn--primary"
                              onClick={() => {
                                setOpen(false);
                                router.push("/login?next=%2Fchat");
                              }}
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
      <div
        className={`admin-chat-launcher${dock?.side === "left" && !dragging ? " admin-chat-launcher--left" : ""}${dragging ? " admin-chat-launcher--dragging" : ""}`}
        aria-live="polite"
        style={
          dragging && dragPoint
            ? { left: dragPoint.x, top: dragPoint.y, right: "auto", bottom: "auto" }
            : dock
              ? {
                  left: dock.side === "left" ? "max(1rem, env(safe-area-inset-left))" : "auto",
                  right: dock.side === "right" ? "max(1rem, env(safe-area-inset-right))" : "auto",
                  bottom: `max(${dock.bottom}px, env(safe-area-inset-bottom))`,
                }
              : undefined
        }
      >
        <div
          className={`admin-chat-launcher-fab-wrap${unread > 0 ? " admin-chat-launcher-fab-wrap--alert" : ""}${open ? " admin-chat-launcher-fab-wrap--open" : ""}`}
          onPointerDown={onDockPointerDown}
          onPointerMove={onDockPointerMove}
          onPointerUp={finishDockDrag}
          onPointerCancel={finishDockDrag}
          onClick={openChat}
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
            onClick={openChat}
            aria-label={
              unread > 0
                ? `Open live chat, ${unread} unread`
                : "Open live chat"
            }
            aria-expanded={open}
          >
            <span className="admin-chat-launcher-fab-border-spin" aria-hidden />
            <span
              className="admin-chat-launcher-fab-shimmer-loop"
              aria-hidden
            />
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
              <span
                className="admin-chat-launcher-fab-badge-ring"
                aria-hidden
              />
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
