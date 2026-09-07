import type { ComponentType } from "react";
import {
  BellIcon,
  CartIcon,
  ChatIcon,
  DollarIcon,
  GridIcon,
  PulseIcon,
} from "@/components/admin/icons";
import type { NotificationItem } from "@/lib/api";

type IconProps = { className?: string };

export function formatNotificationWhen(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function notificationTypeLabel(type: string | undefined): string {
  if (!type) return "Alert";
  return type.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function notificationVisual(type: string | undefined): {
  Icon: ComponentType<IconProps>;
  tone: "order" | "wallet" | "support" | "system";
} {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized.includes("order")) {
    return { Icon: CartIcon, tone: "order" };
  }
  if (normalized.includes("wallet")) {
    return { Icon: DollarIcon, tone: "wallet" };
  }
  if (normalized.includes("support") || normalized.includes("ticket")) {
    return { Icon: ChatIcon, tone: "support" };
  }
  if (normalized.includes("security")) {
    return { Icon: PulseIcon, tone: "system" };
  }
  if (normalized.includes("promo")) {
    return { Icon: GridIcon, tone: "system" };
  }
  return { Icon: BellIcon, tone: "system" };
}

export function isChatNotification(item: NotificationItem): boolean {
  if (item.data?.chat === true) return true;
  const title = item.title.toLowerCase();
  return (
    title.includes("new chat:") ||
    title.includes("support replied") ||
    title.includes("live chat")
  );
}

export function isInboxNotification(item: NotificationItem): boolean {
  return !isChatNotification(item);
}
