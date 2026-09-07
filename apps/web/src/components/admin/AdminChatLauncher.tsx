"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChatIcon, CloseIcon } from "@/components/admin/icons";
import { ChatPanel } from "@/components/chat/ChatPanel";
import {
  notifyUnreadCountChanged,
  useUnreadNotifications,
} from "@/hooks/useUnreadNotifications";
import { markChatNotificationsRead } from "@/lib/api";
import { useChatOverlayLock } from "@/hooks/useChatOverlayLock";

function FabChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M7.5 4.25h9A4.75 4.75 0 0 1 21.25 9v4.2a4.75 4.75 0 0 1-4.75 4.75H12l-3.45 2.76a1 1 0 0 1-1.55-.8V18H7.5A4.75 4.75 0 0 1 2.75 13.2V9A4.75 4.75 0 0 1 7.5 4.25Z" />
      <circle cx="8.6" cy="11.8" r="1.05" fill="rgb(var(--bg-elevated))" />
      <circle cx="12" cy="11.8" r="1.05" fill="rgb(var(--bg-elevated))" />
      <circle cx="15.4" cy="11.8" r="1.05" fill="rgb(var(--bg-elevated))" />
    </svg>
  );
}

export function AdminChatLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const unread = useUnreadNotifications(true, "staff", true);

  const hidden = pathname?.startsWith("/admin/chat");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    markChatNotificationsRead("staff")
      .then(() => notifyUnreadCountChanged())
      .catch(() => undefined);
  }, [open]);

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
            <div className="admin-chat-messenger" role="dialog" aria-label="Live chat">
              <header
                className={`admin-chat-messenger-head${
                  mobileThreadOpen ? " admin-chat-messenger-head--thread-mobile" : ""
                }`}
              >
              <div className="admin-chat-messenger-brand">
                <span className="admin-chat-messenger-brand-icon" aria-hidden>
                  <FabChatBubbleIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="admin-chat-messenger-title">Chats</p>
                </div>
              </div>
              <div className="admin-chat-messenger-actions">
                <Link
                  href="/admin/chat"
                  className="admin-chat-messenger-link"
                  onClick={() => setOpen(false)}
                >
                  Dashboard view
                </Link>
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
              <ChatPanel
                isAdmin
                pro
                messenger
                onMessengerMobileViewChange={(view) =>
                  setMobileThreadOpen(view === "thread")
                }
                onMessengerClose={() => setOpen(false)}
              />
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
        <button
          type="button"
          className={`admin-chat-launcher-fab${unread > 0 ? " admin-chat-launcher-fab--alert" : ""}`}
          onClick={() => setOpen(true)}
          aria-label="Open live chat"
          aria-expanded={open}
        >
          <FabChatBubbleIcon className="h-7 w-7" />
          {unread > 0 ? (
            <span className="admin-chat-launcher-fab-badge" aria-hidden>
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
          <span className="admin-chat-launcher-fab-hint">
            <ChatIcon className="h-3.5 w-3.5" aria-hidden />
            Chat
          </span>
        </button>
      </div>
    </>
  );
}
