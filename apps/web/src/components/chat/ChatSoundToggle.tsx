"use client";

import { VolumeOffIcon, VolumeOnIcon } from "@/components/admin/icons";
import { useChatNotificationSound } from "@/hooks/useChatNotificationSound";
import { unlockChatNotificationSound } from "@/lib/chat-notification-sound";

type Props = {
  className?: string;
  compact?: boolean;
  /** Header icon button — matches topbar actions */
  iconOnly?: boolean;
  /** Segmented chat header toolbar button */
  toolbar?: boolean;
};

export function ChatSoundToggle({
  className = "",
  compact = false,
  iconOnly = false,
  toolbar = false,
}: Props) {
  const { soundEnabled, toggleSound } = useChatNotificationSound();
  const SoundIcon = soundEnabled ? VolumeOnIcon : VolumeOffIcon;
  const iconClass = iconOnly
    ? "h-5 w-5 shrink-0"
    : toolbar || compact
      ? "h-4 w-4 shrink-0"
      : "h-5 w-5 shrink-0";

  const modeClass = toolbar
    ? "admin-chat-toolbar-btn admin-chat-toolbar-btn--sound"
    : iconOnly
      ? "chat-sound-toggle-btn--icon"
      : compact
        ? "chat-sound-toggle-btn--compact"
        : "chat-sound-toggle-btn--full";

  const rootClass = toolbar
    ? `${modeClass}${soundEnabled ? "" : " admin-chat-toolbar-btn--sound-off"} ${className}`.trim()
    : `chat-sound-toggle-btn ${modeClass}${soundEnabled ? "" : " chat-sound-toggle-btn--off"}${iconOnly ? " shell-icon-btn" : ""} ${className}`.trim();

  return (
    <button
      type="button"
      onClick={() => {
        void unlockChatNotificationSound();
        toggleSound();
      }}
      className={rootClass}
      aria-pressed={soundEnabled}
      aria-label={
        soundEnabled
          ? "Turn message sound off"
          : "Turn message sound on"
      }
      title={soundEnabled ? "Message sound on" : "Message sound off"}
    >
      <SoundIcon className={iconClass} aria-hidden />
      {!toolbar && !iconOnly ? (
        <span className="chat-sound-toggle-btn__label">
          {soundEnabled ? "Sound on" : "Sound off"}
        </span>
      ) : null}
      {!compact && !iconOnly && !toolbar ? (
        <span className="chat-sound-toggle-btn__hint">
          Play a sound when support replies in live chat
        </span>
      ) : null}
    </button>
  );
}
