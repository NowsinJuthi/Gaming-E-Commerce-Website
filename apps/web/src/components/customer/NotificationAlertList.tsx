"use client";

import Link from "next/link";
import { CheckIcon, GridIcon } from "@/components/admin/icons";
import type { NotificationItem } from "@/lib/api";
import {
  formatNotificationWhen,
  isChatNotification,
  notificationTypeLabel,
  notificationVisual,
} from "@/components/customer/notification-alert-meta";

type Props = {
  items: NotificationItem[];
  busy?: boolean;
  onMarkRead: (id: string) => void;
  footerLink?: { href: string; label: string };
  emptyAction?: { href: string; label: string };
};

export function NotificationAlertList({
  items,
  busy = false,
  onMarkRead,
  footerLink,
  emptyAction,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="notification-alert-empty dashboard-pro-empty py-10">
        <span className="dashboard-pro-empty-icon" aria-hidden>
          <GridIcon className="h-6 w-6" />
        </span>
        <p className="text-sm font-semibold text-foreground">No notifications yet</p>
        <p className="mt-1 max-w-sm text-xs text-subtle">
          Order updates, wallet activity, and account alerts will appear here.
        </p>
        {emptyAction ? (
          <Link href={emptyAction.href as "/"} className="dashboard-pro-btn mt-4 text-xs">
            {emptyAction.label}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="notification-alert-list">
      {items.map((n) => {
        const { Icon, tone } = notificationVisual(n.type);
        const chat = isChatNotification(n);
        const when = formatNotificationWhen(n.createdAt);

        return (
          <article
            key={n._id}
            className={`notification-alert-item${
              n.read ? "" : " notification-alert-item--unread"
            }`}
          >
            <div
              className={`notification-alert-icon notification-alert-icon--${tone}`}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </div>

            <div className="notification-alert-body min-w-0">
              <div className="notification-alert-head">
                <div className="min-w-0">
                  <h3 className="notification-alert-title">{n.title}</h3>
                  <div className="notification-alert-meta">
                    <span className="notification-alert-type">
                      {notificationTypeLabel(n.type)}
                    </span>
                    {when ? (
                      <>
                        <span className="notification-alert-dot" aria-hidden />
                        <time dateTime={n.createdAt}>{when}</time>
                      </>
                    ) : null}
                  </div>
                </div>
                {!n.read ? (
                  <span className="notification-alert-unread-pill">New</span>
                ) : null}
              </div>

              {n.body ? (
                <p className="notification-alert-message">{n.body}</p>
              ) : null}

              <div className="notification-alert-actions">
                {chat ? (
                  <Link href="/chat" className="notification-alert-link">
                    Open chat
                  </Link>
                ) : null}
                {!n.read ? (
                  <button
                    type="button"
                    onClick={() => onMarkRead(n._id)}
                    disabled={busy}
                    className="notification-alert-mark-read"
                  >
                    <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                    {busy ? "Updating…" : "Mark read"}
                  </button>
                ) : (
                  <span className="notification-alert-read-label">
                    <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                    Read
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {footerLink ? (
        <div className="notification-alert-footer">
          <Link href={footerLink.href as "/"} className="dashboard-pro-btn text-xs">
            {footerLink.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
