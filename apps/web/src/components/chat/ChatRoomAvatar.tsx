import Image from "next/image";
import { ChatIcon } from "@/components/admin/icons";
import type { ChatRoomCustomer, ChatSupportAgent } from "@/lib/api";
import { resolveAvatarSrc } from "@/lib/site-appearance";

function chatCustomerInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (name.trim()[0] ?? "?").toUpperCase();
}

type Props = {
  customer?: ChatRoomCustomer;
  size?: "sm" | "md";
  online?: boolean;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
};

export function ChatRoomAvatar({
  customer,
  size = "md",
  online = false,
  className = "",
  onClick,
  ariaLabel = "View customer profile",
}: Props) {
  const label = customer?.displayName ?? customer?.email ?? "Support";
  const avatarUrl = customer?.avatarUrl;
  const sizeCls = size === "sm" ? "admin-chat-room-avatar--sm" : "";

  const avatar = (
    <span
      className={`admin-chat-room-avatar ${sizeCls} ${className}`.trim()}
      aria-hidden={onClick ? true : undefined}
    >
      <span className="admin-chat-room-avatar-inner">
        {avatarUrl ? (
          <Image
            src={resolveAvatarSrc(avatarUrl)}
            alt=""
            width={size === "sm" ? 36 : 44}
            height={size === "sm" ? 36 : 44}
            className="admin-chat-room-avatar-img"
            unoptimized
          />
        ) : (
          <span className="admin-chat-room-avatar-fallback">
            {chatCustomerInitial(label)}
          </span>
        )}
      </span>
      {online ? <span className="admin-chat-room-avatar-online" /> : null}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="admin-chat-room-avatar-btn"
        onClick={onClick}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {avatar}
      </button>
    );
  }

  return avatar;
}

export function SupportTeamAvatar({
  online = false,
  members = [],
  className = "",
  size = "md",
}: {
  online?: boolean;
  members?: ChatSupportAgent[];
  className?: string;
  size?: "sm" | "md";
}) {
  const sizeCls = size === "sm" ? "admin-chat-room-avatar--sm" : "";
  const shown = members.slice(0, 3);
  const hasMembers = shown.length > 0;
  const imageSize = size === "sm" ? 36 : 44;

  return (
    <span
      className={`admin-chat-room-avatar admin-chat-support-avatar ${sizeCls} ${className}`.trim()}
      aria-hidden
    >
      {hasMembers ? (
        <span
          className={`admin-chat-support-avatar-stack${
            shown.length > 1 ? " admin-chat-support-avatar-stack--multi" : ""
          }`}
        >
          {shown.map((member, index) => {
            const label =
              member.displayName?.trim() ||
              member.firstName?.trim() ||
              "Support";
            const avatarUrl = member.avatarUrl?.trim();
            return (
              <span
                key={member.id}
                className="admin-chat-room-avatar-inner admin-chat-support-avatar-photo"
                style={{ zIndex: shown.length - index }}
              >
                {avatarUrl ? (
                  <Image
                    src={resolveAvatarSrc(avatarUrl)}
                    alt=""
                    width={imageSize}
                    height={imageSize}
                    className="admin-chat-room-avatar-img"
                    unoptimized
                  />
                ) : (
                  <span className="admin-chat-room-avatar-fallback">
                    {chatCustomerInitial(label)}
                  </span>
                )}
              </span>
            );
          })}
        </span>
      ) : (
        <span className="admin-chat-room-avatar-inner">
          <ChatIcon className="admin-chat-support-avatar-icon" />
        </span>
      )}
      {online ? <span className="admin-chat-room-avatar-online" /> : null}
    </span>
  );
}

export function chatRoomCustomerLabel(customer?: ChatRoomCustomer): string {
  return customer?.displayName?.trim() || customer?.email || "Support";
}

export function formatChatRoomTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) {
    return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  }
  if (diff < 86_400_000) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
