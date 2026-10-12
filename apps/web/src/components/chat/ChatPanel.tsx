"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeftIcon,
  ChatIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ImageAttachIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/admin/icons";
import { ChatCustomerInfoDialog } from "@/components/chat/ChatCustomerInfoDialog";
import { ChatBubbleImage } from "@/components/chat/ChatBubbleImage";
import { ChatImagePreview } from "@/components/chat/ChatImagePreview";
import { ChatSoundToggle } from "@/components/chat/ChatSoundToggle";
import { ChatQuickReplyAutocomplete } from "@/components/chat/ChatQuickReplyAutocomplete";
import { useStaffQuickReplies } from "@/components/chat/useStaffQuickReplies";
import {
  ChatRoomAvatar,
  SupportTeamAvatar,
  chatRoomCustomerLabel,
  formatChatRoomTime,
} from "@/components/chat/ChatRoomAvatar";
import { notifyUnreadCountChanged } from "@/hooks/useUnreadNotifications";
import {
  deleteChatRoom,
  getChatAdminOverview,
  getChatHistory,
  getCustomerPanelConfig,
  getMe,
  getOnlineUsers,
  getOnlineSupportStaff,
  listChatRooms,
  markChatRead,
  openSupportRoom,
  roomId,
  sendChatMessage,
  updateChatRoomStatus,
  uploadChatImage,
  type ChatAdminOverview,
  type ChatMessage,
  type ChatRoom,
  type ChatRoomStatus,
  type ChatSupportAgent,
} from "@/lib/api";
import {
  playChatNotificationSound,
  unlockChatNotificationSound,
} from "@/lib/chat-notification-sound";
import {
  acquireChatSocket,
  releaseChatSocket,
  socketEmitAck,
} from "@/lib/chat-socket";
import {
  applyQuickReplySelection,
  filterQuickReplies,
  parseQuickReplyTrigger,
} from "@/lib/chat-quick-reply-autocomplete";
import { resolveMediaSrc } from "@/lib/site-appearance";
import { isChatStaffRole, primaryChatRole } from "@/lib/chat-roles";
import type { Socket } from "socket.io-client";

type Props = {
  isAdmin?: boolean;
  showConfig?: boolean;
  dark?: boolean;
  premium?: boolean;
  /** Flat admin styling (no 3D shell) — use on /admin/chat */
  pro?: boolean;
  /** Full-height messenger overlay (admin FAB) */
  messenger?: boolean;
  /** Mobile messenger inbox vs thread (staff FAB only) */
  onMessengerMobileViewChange?: (view: "inbox" | "thread") => void;
  /** Close the full messenger overlay (FAB drawer) */
  onMessengerClose?: () => void;
  /** Embed inside account page card — no outer shell chrome */
  embedded?: boolean;
  /** Parent-owned overview — skips duplicate fetch on /admin/chat */
  overview?: ChatAdminOverview | null;
  /** Open a specific room on load (e.g. Telegram reply deep link) */
  initialRoomId?: string;
  onOverviewChange?: (overview: ChatAdminOverview) => void;
  onStatusChange?: (status: {
    connected: boolean;
    onlineCount: number;
    roomStatus: ChatRoomStatus | null;
    loading: boolean;
  }) => void;
  /** When false, hides picture upload in the composer. Defaults to panel config. */
  allowChatImages?: boolean;
  /** Fill parent height (admin console fullscreen layout) */
  fullHeight?: boolean;
  /** Parent messenger shell — wire header refresh button */
  onRefreshReady?: (api: { refresh: () => Promise<void> }) => void;
  onRefreshingChange?: (busy: boolean) => void;
  onSupportAgentsChange?: (agents: ChatSupportAgent[]) => void;
};

const DEFAULT_AVERAGE_RESPONSE_TIME = "< 15 minutes";

function sameId(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && String(a) === String(b));
}

function isUserOnline(online: string[], userId?: string | null): boolean {
  if (!userId) return false;
  return online.some((id) => sameId(id, userId));
}

function chatMessagePreview(body?: string, imageUrl?: string): string {
  const text = body?.trim() ?? "";
  if (text) return text;
  if (imageUrl?.trim()) return "[Image]";
  return "";
}

function mergeChatMessages(
  history: ChatMessage[],
  liveMessages: ChatMessage[],
): ChatMessage[] {
  const merged = [...history];
  const seen = new Set(
    history.map((message) =>
      String(message.id ?? message._id ?? message.createdAt ?? ""),
    ),
  );

  for (const message of liveMessages) {
    const key = String(message.id ?? message._id ?? message.createdAt ?? "");
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(message);
  }

  return merged.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

function chatSenderInitial(name?: string, role?: string): string {
  const label = (name ?? role ?? "?").trim();
  if (!label) return "?";
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return label.charAt(0).toUpperCase();
}

function formatChatMessageTime(value?: string): string {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function patchOverviewStatus(
  current: ChatAdminOverview,
  from: ChatRoomStatus,
  to: ChatRoomStatus,
): ChatAdminOverview {
  if (from === to) return current;
  let openRooms = current.openRooms;
  let closedRooms = current.closedRooms;
  if (from === "open") openRooms = Math.max(0, openRooms - 1);
  if (from === "closed") closedRooms = Math.max(0, closedRooms - 1);
  if (to === "open") openRooms += 1;
  if (to === "closed") closedRooms += 1;
  return { ...current, openRooms, closedRooms };
}

const MOBILE_MESSENGER_MAX = 767;

function useMobileMessengerViewport(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${MOBILE_MESSENGER_MAX}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MESSENGER_MAX}px)`);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}

function shouldSkipMessengerAutoSelect(
  isAdmin: boolean,
  messenger: boolean,
): boolean {
  if (!isAdmin || !messenger || typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${MOBILE_MESSENGER_MAX}px)`).matches;
}

function patchOverviewAfterDelete(
  current: ChatAdminOverview,
  room: ChatRoom,
): ChatAdminOverview {
  return {
    ...current,
    openRooms:
      room.status === "open"
        ? Math.max(0, current.openRooms - 1)
        : current.openRooms,
    closedRooms:
      room.status === "closed"
        ? Math.max(0, current.closedRooms - 1)
        : current.closedRooms,
  };
}

function ChatEmailCopyButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className={`admin-chat-header-email-copy${copied ? " admin-chat-header-email-copy--copied" : ""}`}
      onClick={copyEmail}
      aria-label={copied ? "Email copied" : "Copy customer email"}
      title={copied ? "Copied!" : "Copy email"}
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

export function ChatHeaderRefreshButton({
  onClick,
  disabled,
  busy,
  className = "admin-chat-toolbar-btn",
  showLabel = true,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`admin-chat-refresh-btn${
        showLabel ? " admin-chat-refresh-btn--labeled" : ""
      } ${className}`}
      aria-label="Chat Refresh"
      title="Chat Refresh"
    >
      <RefreshIcon
        className={`h-4 w-4 shrink-0${busy ? " animate-spin" : ""}`}
        aria-hidden
      />
      {showLabel ? (
        <span className="admin-chat-refresh-btn-label">Chat Refresh</span>
      ) : null}
    </button>
  );
}

export function ChatPanel({
  isAdmin = false,
  showConfig = false,
  dark = false,
  premium = false,
  pro = false,
  messenger = false,
  onMessengerMobileViewChange,
  onMessengerClose,
  embedded = false,
  overview: overviewProp,
  initialRoomId,
  onOverviewChange,
  onStatusChange,
  allowChatImages: allowChatImagesProp,
  fullHeight = false,
  onRefreshReady,
  onRefreshingChange,
  onSupportAgentsChange,
}: Props) {
  const isMobileMessenger = useMobileMessengerViewport();
  const initialRoomIdRef = useRef(initialRoomId);
  initialRoomIdRef.current = initialRoomId;
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [active, setActive] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshingChat, setRefreshingChat] = useState(false);
  const [text, setText] = useState("");
  const [quickReplyHighlight, setQuickReplyHighlight] = useState(0);
  const staffQuickReplies = useStaffQuickReplies(isAdmin);
  const [online, setOnline] = useState<string[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localOverview, setLocalOverview] = useState<ChatAdminOverview | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [supportAgents, setSupportAgents] = useState<ChatSupportAgent[]>([]);
  const [customerInfoOpen, setCustomerInfoOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [allowChatImages, setAllowChatImages] = useState(
    allowChatImagesProp ?? true,
  );
  const [averageResponseTime, setAverageResponseTime] = useState(
    DEFAULT_AVERAGE_RESPONSE_TIME,
  );
  const [meId, setMeId] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomsReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  // Tracks recently seen message IDs to prevent duplicate sounds/actions when
  // the server emits message:new via multiple channels (room + user + staff).
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const overviewRef = useRef<ChatAdminOverview | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<string>("");
  const meRoleRef = useRef<string>("customer");
  const activeIdRef = useRef<string>("");
  const historyLoadSeqRef = useRef(0);
  const pendingRoomJoinRef = useRef<string | null>(null);
  const roomJoinRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const roomJoinRetryRef = useRef({ roomId: "", attempts: 0 });
  const isAdminRef = useRef(isAdmin);
  const messagePollRef = useRef<number | null>(null);
  const messageSafetyPollRef = useRef<number | null>(null);

  const visibleOnlineCount = useMemo(() => {
    if (isAdmin) {
      const customerIds = rooms
        .map((room) => room.customer?.id ?? room.createdBy)
        .filter((id): id is string => Boolean(id));
      if (!customerIds.length) return 0;
      return customerIds.filter((customerId) =>
        isUserOnline(online, customerId),
      ).length;
    }
    return online.filter((id) => !sameId(id, meId)).length;
  }, [isAdmin, meId, online, rooms]);

  const overview = overviewProp ?? localOverview;
  overviewRef.current = overview;

  useEffect(() => {
    if (allowChatImagesProp !== undefined) {
      setAllowChatImages(allowChatImagesProp);
    }
    let cancelled = false;
    getCustomerPanelConfig()
      .then((config) => {
        if (!cancelled) {
          if (allowChatImagesProp === undefined) {
            setAllowChatImages(config.chat?.allowImageUpload !== false);
          }
          setAverageResponseTime(
            config.chat?.averageResponseTime?.trim() ||
              DEFAULT_AVERAGE_RESPONSE_TIME,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (allowChatImagesProp === undefined) {
            setAllowChatImages(true);
          }
          setAverageResponseTime(DEFAULT_AVERAGE_RESPONSE_TIME);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [allowChatImagesProp]);

  const applyOverview = useCallback(
    (next: ChatAdminOverview) => {
      if (onOverviewChange) {
        onOverviewChange(next);
      } else {
        setLocalOverview(next);
      }
    },
    [onOverviewChange],
  );

  const refreshOverview = useCallback(() => {
    getChatAdminOverview()
      .then(applyOverview)
      .catch(() => undefined);
  }, [applyOverview]);

  const useAdminPro = isAdmin && pro;
  const useCustomerPro = !isAdmin && embedded;
  const useChatPro = useAdminPro || useCustomerPro;
  const showAverageResponseHeader = Boolean(
    (useChatPro || messenger) && (isAdmin ? active?.customer : true),
  );
  const hideCustomerMessengerHeader = messenger && useCustomerPro;
  const mobileRoomSplit =
    isAdmin && isMobileMessenger && (messenger || useAdminPro);
  const mobileInbox = mobileRoomSplit && !active;
  const mobileThread = mobileRoomSplit && active;
  const messengerInboxUi = messenger && mobileInbox;
  const useFlatPro = !isAdmin || useAdminPro;
  const use3d = isAdmin && !pro && (premium || dark);

  const quickReplyTrigger = useMemo(
    () => (isAdmin ? parseQuickReplyTrigger(text) : null),
    [isAdmin, text],
  );
  const quickReplySuggestions = useMemo(() => {
    if (!quickReplyTrigger) return [];
    return filterQuickReplies(staffQuickReplies, quickReplyTrigger.query);
  }, [quickReplyTrigger, staffQuickReplies]);
  const quickReplyOpen = isAdmin && quickReplySuggestions.length > 0;

  useEffect(() => {
    setQuickReplyHighlight(0);
  }, [quickReplyTrigger?.query, quickReplySuggestions.length]);

  const bg = useFlatPro || use3d ? "" : "bg-white";
  const border = useFlatPro || use3d ? "border-border/48" : "border-slate-200";
  const textMain = useFlatPro || use3d ? "text-foreground" : "text-slate-900";
  const textMuted =
    useFlatPro || use3d ? "text-foreground-muted" : "text-subtle";
  const inputCls = "admin-chat-composer min-w-0 flex-1 w-full";
  const composerLocked =
    !activeIdRef.current || imageUploading || active?.status === "closed";
  const sendLocked =
    !text.trim() ||
    !activeIdRef.current ||
    imageUploading ||
    active?.status === "closed";
  const sendCls = `admin-chat-send-btn shrink-0 disabled:opacity-50${
    use3d ? " chat-3d-send" : ""
  }`;

  const scrollBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = messagesScrollRef.current;
    const anchor = bottomRef.current;
    if (el && anchor) {
      anchor.scrollIntoView({ behavior, block: "end", inline: "nearest" });
      return;
    }
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  }, []);

  const scheduleScrollBottom = useCallback(() => {
    const run = () => scrollBottom("auto");
    run();
    requestAnimationFrame(run);
    window.setTimeout(run, 50);
    window.setTimeout(run, 150);
    window.setTimeout(run, 320);
  }, [scrollBottom]);

  const onSupportAgentsChangeRef = useRef(onSupportAgentsChange);
  onSupportAgentsChangeRef.current = onSupportAgentsChange;

  const applySupportAgents = useCallback((agents: ChatSupportAgent[]) => {
    setSupportAgents(agents);
    onSupportAgentsChangeRef.current?.(agents);
  }, []);

  const refreshSupportAgents = useCallback(async () => {
    if (isAdmin) return;
    try {
      const agents = await getOnlineSupportStaff();
      applySupportAgents(agents);
    } catch {
      applySupportAgents([]);
    }
  }, [applySupportAgents, isAdmin]);

  const refreshSupportAgentsRef = useRef(refreshSupportAgents);
  refreshSupportAgentsRef.current = refreshSupportAgents;

  const resizeMessageInput = useCallback(() => {
    const el = messageInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 192;
    const scrollHeight = el.scrollHeight;
    const nextHeight = Math.min(scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  const markRoomRead = useCallback(async (id: string) => {
    await markChatRead(id);
    if (isAdminRef.current) {
      setRooms((prev) =>
        prev.map((room) =>
          roomId(room) === id ? { ...room, unreadFromCustomer: false } : room,
        ),
      );
    }
    notifyUnreadCountChanged();
  }, []);

  const [roomSearch, setRoomSearch] = useState("");
  const [roomSearchOpen, setRoomSearchOpen] = useState(false);
  const roomSearchRef = useRef("");
  roomSearchRef.current = roomSearch;

  const loadRooms = useCallback(async () => {
    const list = await listChatRooms(1, 50, roomSearchRef.current);
    setRooms(list);
    return list;
  }, []);
  const loadRoomsRef = useRef(loadRooms);
  loadRoomsRef.current = loadRooms;

  // Debounced staff inbox search (name / email / phone).
  const roomSearchInitRef = useRef(false);
  useEffect(() => {
    if (!isAdmin) return;
    if (!roomSearchInitRef.current) {
      roomSearchInitRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      loadRooms().catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [roomSearch, isAdmin, loadRooms]);

  const scheduleRoomsReload = useCallback(() => {
    if (roomsReloadTimer.current) {
      clearTimeout(roomsReloadTimer.current);
    }
    roomsReloadTimer.current = setTimeout(() => {
      loadRooms().catch(() => undefined);
    }, 700);
  }, [loadRooms]);

  const overviewReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const scheduleOverviewReload = useCallback(() => {
    if (!showConfig || onOverviewChange) return;
    if (overviewReloadTimer.current) {
      clearTimeout(overviewReloadTimer.current);
    }
    overviewReloadTimer.current = setTimeout(() => {
      refreshOverview();
    }, 1200);
  }, [onOverviewChange, refreshOverview, showConfig]);

  const scheduleOverviewSync = useCallback(() => {
    if (!onOverviewChange) return;
    if (overviewReloadTimer.current) {
      clearTimeout(overviewReloadTimer.current);
    }
    overviewReloadTimer.current = setTimeout(() => {
      getChatAdminOverview()
        .then(onOverviewChange)
        .catch(() => undefined);
    }, 1200);
  }, [onOverviewChange]);

  overviewRef.current = overview;

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  const appendMessageToRoom = useCallback(
    (rid: string, msg: ChatMessage) => {
      const msgId = msg.id ?? (msg as ChatMessage & { _id?: string })._id ?? "";
      const normalized: ChatMessage = {
        ...msg,
        id: msgId || msg.id,
        roomId: String(msg.roomId ?? rid),
        senderId: String(msg.senderId ?? ""),
      };

      const cached = historyCacheRef.current.get(rid) ?? [];
      if (msgId && cached.some((m) => (m.id ?? m._id) === msgId)) {
        return;
      }
      const next = [...cached, normalized];
      historyCacheRef.current.set(rid, next);

      if (sameId(rid, activeIdRef.current)) {
        setMessages(next);
        scheduleScrollBottom();
      }
    },
    [scheduleScrollBottom],
  );

  const appendMessageToRoomRef = useRef(appendMessageToRoom);
  appendMessageToRoomRef.current = appendMessageToRoom;
  const applyOverviewRef = useRef(applyOverview);
  applyOverviewRef.current = applyOverview;
  const onOverviewChangeRef = useRef(onOverviewChange);
  onOverviewChangeRef.current = onOverviewChange;
  const scheduleOverviewReloadRef = useRef(scheduleOverviewReload);
  scheduleOverviewReloadRef.current = scheduleOverviewReload;
  const scheduleOverviewSyncRef = useRef(scheduleOverviewSync);
  scheduleOverviewSyncRef.current = scheduleOverviewSync;
  const scheduleRoomsReloadRef = useRef(scheduleRoomsReload);
  scheduleRoomsReloadRef.current = scheduleRoomsReload;

  const joinActiveSocketRoomRef = useRef<(roomIdValue: string) => void>(
    () => undefined,
  );

  const joinActiveSocketRoom = useCallback((roomIdValue: string) => {
    if (!roomIdValue) return;
    if (activeIdRef.current && activeIdRef.current !== roomIdValue) {
      return;
    }
    pendingRoomJoinRef.current = roomIdValue;
    const socket = socketRef.current;
    if (!socket?.connected) return;

    const scheduleRetry = () => {
      if (activeIdRef.current !== roomIdValue) return;
      const state = roomJoinRetryRef.current;
      const attempts = state.roomId === roomIdValue ? state.attempts + 1 : 1;
      roomJoinRetryRef.current = { roomId: roomIdValue, attempts };
      if (attempts > 5) return;
      if (roomJoinRetryTimerRef.current) {
        clearTimeout(roomJoinRetryTimerRef.current);
      }
      roomJoinRetryTimerRef.current = setTimeout(
        () => {
          roomJoinRetryTimerRef.current = null;
          joinActiveSocketRoomRef.current(roomIdValue);
        },
        Math.min(1_000 * 2 ** (attempts - 1), 8_000),
      );
    };

    void socketEmitAck<{ ok?: boolean; error?: string }>(socket, "room:join", {
      roomId: roomIdValue,
    })
      .then((res) => {
        if (res?.ok) {
          pendingRoomJoinRef.current = null;
          roomJoinRetryRef.current = { roomId: roomIdValue, attempts: 0 };
          setError(null);
          if (roomJoinRetryTimerRef.current) {
            clearTimeout(roomJoinRetryTimerRef.current);
            roomJoinRetryTimerRef.current = null;
          }
          return;
        }
        setError(res?.error ?? "Could not join chat room");
        scheduleRetry();
      })
      .catch(scheduleRetry);
  }, []);

  joinActiveSocketRoomRef.current = joinActiveSocketRoom;

  const selectRoom = useCallback(
    async (room: ChatRoom) => {
      const id = roomId(room);
      const cached = historyCacheRef.current.get(id);
      if (roomJoinRetryTimerRef.current) {
        clearTimeout(roomJoinRetryTimerRef.current);
        roomJoinRetryTimerRef.current = null;
      }
      roomJoinRetryRef.current = { roomId: id, attempts: 0 };

      if (activeIdRef.current === id && cached) {
        setActive(room);
        setTyping(null);
        setHistoryLoading(false);
        setMessages(cached);
        await markRoomRead(id);
        joinActiveSocketRoom(id);
        scheduleScrollBottom();
        return;
      }

      const loadSeq = ++historyLoadSeqRef.current;
      activeIdRef.current = id;
      setActive(room);
      setTyping(null);
      joinActiveSocketRoom(id);

      if (cached) {
        setHistoryLoading(false);
        setMessages(cached);
        await markRoomRead(id);
        scheduleScrollBottom();
        return;
      }

      setMessages([]);
      setHistoryLoading(true);

      try {
        const hist = await getChatHistory(id, 1, 100);
        if (
          historyLoadSeqRef.current !== loadSeq ||
          activeIdRef.current !== id
        ) {
          return;
        }
        const normalized = hist.items.map((m) => ({
          ...m,
          id: m.id ?? m._id,
          roomId: String(m.roomId ?? id),
          senderId: String(m.senderId ?? ""),
        }));
        const merged = mergeChatMessages(
          normalized,
          historyCacheRef.current.get(id) ?? [],
        );
        historyCacheRef.current.set(id, merged);
        setMessages(merged);
        await markRoomRead(id);
        joinActiveSocketRoom(id);
        scheduleScrollBottom();
      } catch {
        if (
          historyLoadSeqRef.current === loadSeq &&
          activeIdRef.current === id
        ) {
          setMessages([]);
          setError("Failed to load messages for this room.");
        }
      } finally {
        if (
          historyLoadSeqRef.current === loadSeq ||
          activeIdRef.current === id
        ) {
          setHistoryLoading(false);
        }
      }
    },
    [joinActiveSocketRoom, markRoomRead, scheduleScrollBottom],
  );

  const syncActiveRoomMessages = useCallback(async () => {
    const rid = activeIdRef.current;
    if (!rid) return;
    try {
      const hist = await getChatHistory(rid, 1, 100);
      const normalized = hist.items.map((m) => ({
        ...m,
        id: m.id ?? m._id,
        roomId: String(m.roomId ?? rid),
        senderId: String(m.senderId ?? ""),
      }));
      const prev = historyCacheRef.current.get(rid) ?? [];
      const merged = mergeChatMessages(normalized, prev);
      const prevLast = prev.at(-1)?.id;
      const nextLast = merged.at(-1)?.id;
      if (prev.length === merged.length && prevLast === nextLast) {
        return;
      }
      const prevIds = new Set(
        prev.map((m) => String(m.id ?? m._id ?? "")).filter(Boolean),
      );
      const newFromOther = merged.filter(
        (m) =>
          !prevIds.has(String(m.id ?? "")) &&
          !sameId(String(m.senderId ?? ""), meRef.current),
      );
      historyCacheRef.current.set(rid, merged);
      if (sameId(rid, activeIdRef.current)) {
        setMessages(merged);
        if (newFromOther.length > 0) {
          playChatNotificationSound();
        }
        scheduleScrollBottom();
      }
    } catch {
      /* REST sync blip — socket may recover */
    }
  }, [scheduleScrollBottom]);

  const syncActiveRoomMessagesRef = useRef(syncActiveRoomMessages);
  syncActiveRoomMessagesRef.current = syncActiveRoomMessages;

  const clearActiveRoom = useCallback(() => {
    activeIdRef.current = "";
    setActive(null);
    setTyping(null);
    setMessages([]);
    setHistoryLoading(false);
    setError(null);
  }, []);

  const refreshChat = useCallback(async () => {
    setRefreshingChat(true);
    setError(null);
    try {
      const socket = socketRef.current;
      if (socket && !socket.connected) {
        socket.connect();
      } else if (socket?.connected) {
        socket.emit("presence:heartbeat", {});
      }

      if (isAdmin) {
        const onlineUsers = await getOnlineUsers().catch(() => [] as string[]);
        setOnline(onlineUsers);
      } else {
        await refreshSupportAgents();
      }

      if (isAdmin) {
        refreshOverview();
        const list = await loadRooms();
        const current = active;
        if (current) {
          const id = roomId(current);
          historyCacheRef.current.delete(id);
          const updated = list.find((room) => roomId(room) === id) ?? current;
          await selectRoom(updated);
        }
        return;
      }

      const current = active;
      if (current) {
        historyCacheRef.current.delete(roomId(current));
        await selectRoom(current);
        return;
      }

      const room = await openSupportRoom();
      const normalized = {
        ...room,
        id: roomId(room),
        participants: room.participants ?? [],
      };
      setRooms([normalized]);
      historyCacheRef.current.delete(roomId(normalized));
      await selectRoom(normalized);
    } catch {
      setError("Could not refresh chat.");
    } finally {
      setRefreshingChat(false);
    }
  }, [
    active,
    isAdmin,
    loadRooms,
    refreshOverview,
    refreshSupportAgents,
    selectRoom,
  ]);

  useEffect(() => {
    onRefreshReady?.({ refresh: refreshChat });
  }, [onRefreshReady, refreshChat]);

  useEffect(() => {
    onRefreshingChange?.(refreshingChat);
  }, [onRefreshingChange, refreshingChat]);

  useEffect(() => {
    const unlock = () => {
      void unlockChatNotificationSound();
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const socket = acquireChatSocket();
    if (!socket) return;

    socketRef.current = socket;

    const stopMessagePoll = () => {
      if (messagePollRef.current) {
        window.clearInterval(messagePollRef.current);
        messagePollRef.current = null;
      }
    };

    const startMessagePoll = () => {
      if (messagePollRef.current !== null) return;
      void syncActiveRoomMessagesRef.current();
      if (isAdminRef.current) {
        void loadRoomsRef.current().catch(() => undefined);
      }
      messagePollRef.current = window.setInterval(() => {
        void syncActiveRoomMessagesRef.current();
        if (isAdminRef.current) {
          void loadRoomsRef.current().catch(() => undefined);
        }
      }, 3_000);
    };

    const onConnect = () => {
      setConnected(true);
      setError(null);
      stopMessagePoll();
      void syncActiveRoomMessagesRef.current();
      if (isAdminRef.current) {
        void loadRoomsRef.current().catch(() => undefined);
        getOnlineUsers()
          .then((ids) => setOnline(ids))
          .catch(() => undefined);
      } else {
        void refreshSupportAgentsRef.current();
      }
      const rid = activeIdRef.current || pendingRoomJoinRef.current;
      if (rid) {
        roomJoinRetryRef.current = { roomId: rid, attempts: 0 };
        joinActiveSocketRoomRef.current(rid);
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      startMessagePoll();
    };
    const onConnectError = (error: Error) => {
      setConnected(false);
      setError(error.message || "Could not connect to live chat");
      startMessagePoll();
    };
    const onSocketError = (e: { message?: string }) =>
      setError(e?.message ?? "Socket error");

    const onMessageNew = (msg: ChatMessage) => {
      // Deduplicate: server may deliver the same message via multiple channels
      // (room socket, per-user room, staff:chat). Only process each ID once.
      const msgId = msg.id ?? (msg as ChatMessage & { _id?: string })._id ?? "";
      if (msgId) {
        if (seenMessageIdsRef.current.has(msgId)) return;
        seenMessageIdsRef.current.add(msgId);
        // Evict old entries to prevent unbounded growth (keep last 200)
        if (seenMessageIdsRef.current.size > 200) {
          const first = seenMessageIdsRef.current.values().next().value;
          if (first) seenMessageIdsRef.current.delete(first);
        }
      }

      const rid = activeIdRef.current;
      const msgRoomId = String(msg.roomId ?? "");
      const msgSenderId = String(msg.senderId ?? "");
      const fromOther = !sameId(msgSenderId, meRef.current);
      const isActiveRoom = sameId(msgRoomId, rid);

      if (fromOther && isActiveRoom) {
        playChatNotificationSound();
      }

      if (isActiveRoom) {
        appendMessageToRoomRef.current(rid, msg);
        if (fromOther) {
          markRoomRead(rid).catch(() => undefined);
        }
      } else if (msgRoomId) {
        const cached = historyCacheRef.current.get(msgRoomId) ?? [];
        const msgId =
          msg.id ?? (msg as ChatMessage & { _id?: string })._id ?? "";
        if (!msgId || !cached.some((m) => (m.id ?? m._id) === msgId)) {
          historyCacheRef.current.set(msgRoomId, [
            ...cached,
            {
              ...msg,
              id: msgId || msg.id,
              roomId: msgRoomId,
              senderId: msgSenderId,
            },
          ]);
        }
      }

      const fromCustomer = !isChatStaffRole(msg.senderRole);

      setRooms((prev) =>
        prev.map((room) =>
          roomId(room) === msgRoomId
            ? {
                ...room,
                lastMessage:
                  chatMessagePreview(msg.body, msg.imageUrl) ||
                  room.lastMessage,
                unreadFromCustomer:
                  isAdminRef.current && fromCustomer
                    ? !isActiveRoom
                    : room.unreadFromCustomer,
              }
            : room,
        ),
      );
      const currentOverview = overviewRef.current;
      if (onOverviewChangeRef.current) {
        scheduleOverviewSyncRef.current();
      } else if (
        currentOverview &&
        chatMessagePreview(msg.body, msg.imageUrl)
      ) {
        applyOverviewRef.current({
          ...currentOverview,
          totalMessages: currentOverview.totalMessages + 1,
        });
      } else {
        scheduleOverviewReloadRef.current();
      }
      scheduleRoomsReloadRef.current();
    };

    const onTyping = (p: {
      roomId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (
        sameId(String(p.roomId), activeIdRef.current) &&
        !sameId(p.userId, meRef.current)
      ) {
        setTyping(p.isTyping ? p.userId : null);
      }
    };

    const onPresence = (payload?: { userId?: string; online?: boolean }) => {
      const userId = payload?.userId ? String(payload.userId) : "";
      if (userId && typeof payload?.online === "boolean") {
        setOnline((prev) => {
          if (payload.online) {
            return isUserOnline(prev, userId) ? prev : [...prev, userId];
          }
          return prev.filter((id) => !sameId(id, userId));
        });
        if (!isAdminRef.current) {
          void refreshSupportAgentsRef.current();
        }
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("error", onSocketError);
    socket.on("message:new", onMessageNew);
    socket.on("typing", onTyping);
    socket.on("presence:update", onPresence);

    // Shared socket may already be connected (e.g. AdminShell staff alerts).
    if (socket.connected) {
      onConnect();
    }

    const refreshOnline = () => {
      if (isAdminRef.current) {
        getOnlineUsers()
          .then((ids) => setOnline(ids))
          .catch(() => undefined);
      } else {
        void refreshSupportAgentsRef.current();
      }
    };
    const heartbeat = window.setInterval(() => {
      if (socket.connected) {
        socket.emit("presence:heartbeat", {});
      }
    }, 30_000);
    const onlinePoll = window.setInterval(refreshOnline, 45_000);
    messageSafetyPollRef.current = window.setInterval(() => {
      if (activeIdRef.current) {
        void syncActiveRoomMessagesRef.current();
      }
      if (isAdminRef.current) {
        void loadRoomsRef.current().catch(() => undefined);
      }
    }, 10_000);

    const onVisibilityChange = () => {
      if (document.hidden) return;
      void syncActiveRoomMessagesRef.current();
      if (!socket.connected) {
        socket.connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopMessagePoll();
      if (messageSafetyPollRef.current) {
        window.clearInterval(messageSafetyPollRef.current);
        messageSafetyPollRef.current = null;
      }
      window.clearInterval(heartbeat);
      window.clearInterval(onlinePoll);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onSocketError);
      socket.off("message:new", onMessageNew);
      socket.off("typing", onTyping);
      socket.off("presence:update", onPresence);
      if (roomJoinRetryTimerRef.current) {
        clearTimeout(roomJoinRetryTimerRef.current);
        roomJoinRetryTimerRef.current = null;
      }
      releaseChatSocket();
      socketRef.current = null;
    };
  }, [markRoomRead]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const me = await getMe();
        if (cancelled) return;
        meRef.current = me.id;
        // Determine the primary role for use in optimistic message inserts
        meRoleRef.current = primaryChatRole(me.roles);
        setMeId(me.id);

        const [on, list] = await Promise.all([
          isAdmin ? getOnlineUsers() : Promise.resolve([] as string[]),
          isAdmin ? loadRooms() : Promise.resolve([] as ChatRoom[]),
        ]);
        if (cancelled) return;
        setOnline(on);
        if (!isAdmin) {
          try {
            const agents = await getOnlineSupportStaff();
            if (!cancelled) applySupportAgents(agents);
          } catch {
            if (!cancelled) applySupportAgents([]);
          }
        }

        if (isAdmin) {
          if (showConfig && !onOverviewChange) {
            refreshOverview();
          }
          const targetId = initialRoomIdRef.current?.trim();
          const skipDefault =
            shouldSkipMessengerAutoSelect(isAdmin, messenger) && !targetId;
          if (list.length > 0 && !skipDefault) {
            const target = targetId
              ? (list.find((room) => sameId(roomId(room), targetId)) ?? list[0])
              : list[0];
            if (target) {
              await selectRoom(target);
            }
          }
        } else {
          const room = await openSupportRoom();
          if (cancelled) return;
          const normalized = {
            ...room,
            id: roomId(room),
            participants: room.participants ?? [],
          };
          setRooms([normalized]);
          await selectRoom(normalized);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load chat");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isAdmin,
    messenger,
    initialRoomId,
    onOverviewChange,
    refreshOverview,
    showConfig,
    loadRooms,
    selectRoom,
    applySupportAgents,
  ]);

  useEffect(() => {
    if (!messenger || !onMessengerMobileViewChange || !isMobileMessenger)
      return;
    onMessengerMobileViewChange(mobileThread ? "thread" : "inbox");
  }, [isMobileMessenger, messenger, mobileThread, onMessengerMobileViewChange]);

  useEffect(() => {
    if (!mobileRoomSplit || !isMobileMessenger) return;
    const input = messageInputRef.current;
    if (!input) return;

    const onFocus = () => {
      scheduleScrollBottom();
    };

    input.addEventListener("focus", onFocus);
    return () => input.removeEventListener("focus", onFocus);
  }, [active, isMobileMessenger, mobileRoomSplit, scheduleScrollBottom]);

  useLayoutEffect(() => {
    if (!mobileRoomSplit || messages.length === 0) return;
    scheduleScrollBottom();
  }, [messages.length, mobileRoomSplit, scheduleScrollBottom]);

  useEffect(() => {
    if (!mobileRoomSplit || !isMobileMessenger) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onViewportChange = () => scheduleScrollBottom();
    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
    return () => {
      vv.removeEventListener("resize", onViewportChange);
      vv.removeEventListener("scroll", onViewportChange);
    };
  }, [isMobileMessenger, mobileRoomSplit, scheduleScrollBottom]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      if (roomsReloadTimer.current) {
        clearTimeout(roomsReloadTimer.current);
      }
      if (overviewReloadTimer.current) {
        clearTimeout(overviewReloadTimer.current);
      }
    };
  }, []);

  function onTyping(val: string) {
    setText(val);
    const rid = activeIdRef.current;
    if (!rid || !socketRef.current) return;
    socketRef.current.emit("typing", { roomId: rid, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("typing", { roomId: rid, isTyping: false });
    }, 1200);
    requestAnimationFrame(resizeMessageInput);
  }

  function applyQuickReply(body: string) {
    if (!quickReplyTrigger) return;
    const next = applyQuickReplySelection(text, quickReplyTrigger, body);
    onTyping(next);
    setQuickReplyHighlight(0);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (quickReplyOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setQuickReplyHighlight((i) =>
          i + 1 >= quickReplySuggestions.length ? 0 : i + 1,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setQuickReplyHighlight((i) =>
          i <= 0 ? quickReplySuggestions.length - 1 : i - 1,
        );
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const reply = quickReplySuggestions[quickReplyHighlight];
        if (reply) applyQuickReply(reply.body);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuickReplyHighlight(0);
        if (quickReplyTrigger?.replaceStart === 0) {
          onTyping("");
        } else if (quickReplyTrigger) {
          onTyping(
            text.slice(0, quickReplyTrigger.replaceStart) +
              text.slice(quickReplyTrigger.replaceEnd),
          );
        }
        return;
      }
    }

    if (
      (e.key === "Enter" || e.code === "Enter") &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      void send();
    }
  }

  function onComposerKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (quickReplyOpen) return;
    if (
      (e.key === "Enter" || e.code === "Enter") &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !e.defaultPrevented
    ) {
      e.preventDefault();
      void send();
    }
  }

  function handleComposerSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send();
  }

  useLayoutEffect(() => {
    resizeMessageInput();
  }, [text, resizeMessageInput, active, composerLocked]);

  async function emitChatMessage(payload: {
    body?: string;
    imageUrl?: string;
  }): Promise<boolean> {
    const rid = activeIdRef.current;
    const socket = socketRef.current;
    if (!rid) {
      throw new Error("Select a chat room before sending.");
    }
    const body = payload.body?.trim() ?? "";
    const imageUrl = payload.imageUrl?.trim() ?? "";
    if (!body && !imageUrl) return false;

    const applySentMessage = (message?: ChatMessage, id?: string) => {
      const preview = chatMessagePreview(body, imageUrl);
      if (message) {
        appendMessageToRoomRef.current(rid, message);
      } else if (id) {
        appendMessageToRoomRef.current(rid, {
          id,
          roomId: rid,
          senderId: meRef.current,
          senderRole: meRoleRef.current,
          body,
          imageUrl: imageUrl || undefined,
          createdAt: new Date().toISOString(),
        });
      }
      setRooms((prev) =>
        prev.map((room) =>
          roomId(room) === rid ? { ...room, lastMessage: preview } : room,
        ),
      );
    };

    if (socket?.connected) {
      socket.emit("typing", { roomId: rid, isTyping: false });
      try {
        const res = await socketEmitAck<{
          ok?: boolean;
          id?: string;
          message?: ChatMessage;
          error?: string;
        }>(socket, "message:send", {
          roomId: rid,
          body: body || undefined,
          imageUrl: imageUrl || undefined,
        });
        if (res?.ok) {
          applySentMessage(res.message, res.id);
          return true;
        }
        if (res?.error) {
          setError(res.error);
        }
      } catch {
        // Fall through to REST when the socket ack fails.
      }
    }

    try {
      const res = await sendChatMessage(rid, body, imageUrl);
      if (res?.ok) {
        applySentMessage(res.message, res.id);
        return true;
      }
      setError(res?.error ?? "Send failed");
      return false;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Chat is not connected. Please try again.",
      );
      return false;
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setText("");
    requestAnimationFrame(resizeMessageInput);
    try {
      const ok = await emitChatMessage({ body });
      if (ok) {
        scheduleScrollBottom();
      } else {
        setText(body);
      }
    } catch (err) {
      setText(body);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      sendingRef.current = false;
    }
  }

  async function onImageSelected(file: File | null) {
    if (!file || !allowChatImages) return;
    const rid = activeIdRef.current;
    if (!rid || composerLocked) {
      return;
    }

    setImageUploading(true);
    setError(null);
    const caption = text.trim();
    try {
      const { url } = await uploadChatImage(rid, file);
      setText("");
      const ok = await emitChatMessage({
        body: caption || undefined,
        imageUrl: url,
      });
      if (!ok && caption) setText(caption);
    } catch (err) {
      // Restore caption text so the user can retry without retyping.
      if (caption) setText(caption);
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      scheduleScrollBottom();
    }
  }

  async function toggleRoomStatus(status: ChatRoomStatus) {
    if (!active) return;
    const previousStatus = active.status;
    try {
      const updated = await updateChatRoomStatus(roomId(active), status);
      setActive(updated);
      setRooms((current) =>
        current.map((room) =>
          roomId(room) === roomId(updated) ? updated : room,
        ),
      );
      if (overview && previousStatus && previousStatus !== status) {
        applyOverview(patchOverviewStatus(overview, previousStatus, status));
      } else if (showConfig && !onOverviewChange) {
        refreshOverview();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function removeRoom(id: string, label?: string) {
    if (
      !confirm(
        `Delete "${label ?? "this chat"}"? All messages will be permanently removed.`,
      )
    ) {
      return;
    }
    setDeletingRoomId(id);
    setError(null);
    const deletedRoom =
      active && roomId(active) === id
        ? active
        : (rooms.find((room) => roomId(room) === id) ?? null);
    try {
      await deleteChatRoom(id);
      historyCacheRef.current.delete(id);
      const list = await loadRooms();
      if (active && roomId(active) === id) {
        activeIdRef.current = "";
        setActive(null);
        setMessages([]);
        if (list.length > 0) {
          const firstRoom = list[0];
          if (firstRoom) {
            await selectRoom(firstRoom);
          }
        }
      }
      if (overview && deletedRoom) {
        applyOverview(patchOverviewAfterDelete(overview, deletedRoom));
      } else if (showConfig && !onOverviewChange) {
        refreshOverview();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingRoomId(null);
    }
  }

  useEffect(() => {
    onStatusChange?.({
      connected,
      onlineCount: visibleOnlineCount,
      roomStatus: active?.status ?? null,
      loading,
    });
  }, [active?.status, connected, loading, onStatusChange, visibleOnlineCount]);

  useEffect(() => {
    setCustomerInfoOpen(false);
  }, [active]);

  if (loading) {
    if (use3d) {
      return (
        <div className="chat-3d-loading">
          <p className="text-sm text-foreground-muted">
            Connecting to live chat…
          </p>
        </div>
      );
    }
    if (useChatPro) {
      return (
        <div className="dashboard-pro-empty p-10">
          <p className="text-sm text-subtle">Connecting to live chat…</p>
        </div>
      );
    }
    return (
      <p className={`py-12 text-center text-sm ${textMuted}`}>
        Connecting to live chat…
      </p>
    );
  }

  const shellCls = messenger
    ? `admin-chat-shell admin-chat-shell--messenger flex h-full min-h-0 flex-1 overflow-hidden${
        mobileInbox ? " admin-chat-shell--messenger-inbox" : ""
      }${mobileThread ? " admin-chat-shell--messenger-thread" : ""}`
    : use3d
      ? "chat-3d-shell flex h-[min(72vh,640px)]"
      : useChatPro
        ? `admin-chat-shell flex overflow-hidden${
            fullHeight ? " h-full min-h-0 flex-1" : " h-[min(72vh,640px)]"
          }${mobileInbox ? " admin-chat-shell--messenger-inbox" : ""}${
            mobileThread ? " admin-chat-shell--messenger-thread" : ""
          }${mobileRoomSplit ? " admin-chat-shell--messenger" : ""}`
        : useFlatPro
          ? "flex h-[min(72vh,640px)] overflow-hidden rounded-2xl border border-border/48 bg-elevated"
          : `flex h-[min(70vh,600px)] overflow-hidden rounded-2xl border ${border} ${bg}`;

  return (
    <div className={shellCls}>
      {isAdmin && (
        <aside
          className={`admin-chat-rooms relative z-10 shrink-0 overflow-y-auto border-r border-border/45 p-3${
            messenger || mobileRoomSplit
              ? ` admin-chat-rooms--messenger${
                  messenger ? " w-[13rem] shrink-0 sm:w-60" : ""
                }${mobileInbox ? " admin-chat-rooms--messenger-inbox" : ""}`
              : " w-72"
          }`}
        >
          <div className="admin-chat-rooms-head">
            <div className="admin-chat-rooms-head-row">
              <p className="admin-chat-rooms-title">
                {messengerInboxUi ? "Messages" : `Rooms (${rooms.length})`}
              </p>
              <button
                type="button"
                className={`admin-chat-rooms-search-toggle${
                  roomSearchOpen
                    ? " admin-chat-rooms-search-toggle--active"
                    : ""
                }`}
                onClick={() => {
                  if (roomSearchOpen) {
                    setRoomSearchOpen(false);
                    if (roomSearch) setRoomSearch("");
                  } else {
                    setRoomSearchOpen(true);
                  }
                }}
                aria-label={
                  roomSearchOpen ? "Close chat search" : "Search chats"
                }
                title={roomSearchOpen ? "Close search" : "Search chats"}
              >
                {roomSearchOpen ? (
                  <CloseIcon className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <SearchIcon className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
            {roomSearchOpen ? (
              <div className="admin-chat-rooms-search">
                <SearchIcon
                  className="admin-chat-rooms-search-icon"
                  aria-hidden
                />
                <input
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  name="uniqbd-chat-room-filter"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Name, email or mobile"
                  className="admin-chat-rooms-search-input"
                  aria-label="Search chats by name, email or mobile number"
                  autoFocus
                />
              </div>
            ) : null}
          </div>
          <div className="admin-chat-rooms-list">
            {rooms.length === 0 && roomSearch.trim() ? (
              <p className="admin-chat-rooms-search-empty">
                No chats matched your search
              </p>
            ) : null}
            {rooms.map((r) => {
              const id = roomId(r);
              const sel = active && roomId(active) === id;
              const customerUserId = r.customer?.id ?? r.createdBy;
              const customerOnline = isUserOnline(online, customerUserId);
              const customerLabel = chatRoomCustomerLabel(r.customer);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectRoom(r)}
                  className={`admin-chat-room-card${
                    sel ? " admin-chat-room-card--active" : ""
                  }${r.unreadFromCustomer ? " admin-chat-room-card--unread" : ""}${
                    messengerInboxUi
                      ? " admin-chat-room-card--messenger-inbox"
                      : ""
                  }`}
                >
                  <ChatRoomAvatar
                    customer={r.customer}
                    online={customerOnline}
                    className={
                      messengerInboxUi ? "admin-chat-room-avatar--inbox" : ""
                    }
                  />
                  <span className="admin-chat-room-card-body">
                    <span className="admin-chat-room-card-top">
                      <span className="admin-chat-room-card-name">
                        {customerLabel}
                      </span>
                      <span
                        className={`admin-chat-room-card-status${
                          r.status === "open"
                            ? " admin-chat-room-card-status--open"
                            : ""
                        }`}
                      >
                        {r.status}
                      </span>
                    </span>
                    <span className="admin-chat-room-card-preview">
                      {r.lastMessage ?? "No messages yet"}
                    </span>
                    <span className="admin-chat-room-card-meta">
                      <span>{r.subject ?? "Support"}</span>
                      {r.lastMessageAt ? (
                        <span>{formatChatRoomTime(r.lastMessageAt)}</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      <div
        className={`admin-chat-thread relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden${
          mobileInbox ? " admin-chat-thread--messenger-hidden" : ""
        }`}
      >
        {hideCustomerMessengerHeader ? null : (
          <div
            className={
              use3d
                ? "chat-3d-header"
                : useChatPro || messenger
                  ? `admin-chat-header${
                      mobileThread ? " admin-chat-header--messenger-thread" : ""
                    }`
                  : `flex items-center justify-between border-b px-4 py-3 ${border}`
            }
          >
            <div
              className={
                useChatPro || messenger
                  ? "admin-chat-header-row"
                  : "flex min-h-0 w-full items-center justify-between gap-3"
              }
            >
              <div
                className={
                  useChatPro || messenger
                    ? "admin-chat-header-main"
                    : "flex min-w-0 items-center gap-3"
                }
              >
                {mobileThread ? (
                  <button
                    type="button"
                    className="admin-chat-messenger-back-btn"
                    onClick={clearActiveRoom}
                    aria-label="Back to messages"
                  >
                    <ArrowLeftIcon className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}
                {useCustomerPro ? (
                  <SupportTeamAvatar
                    online={supportAgents.length > 0}
                    members={supportAgents}
                  />
                ) : isAdmin && active?.customer ? (
                  <ChatRoomAvatar
                    customer={active.customer}
                    online={isUserOnline(
                      online,
                      active.customer.id ?? active.createdBy,
                    )}
                    onClick={() => setCustomerInfoOpen(true)}
                  />
                ) : null}
                <div
                  className={
                    useChatPro || messenger
                      ? "admin-chat-header-identity"
                      : "min-w-0"
                  }
                >
                  <p
                    className={
                      useChatPro || messenger
                        ? useCustomerPro
                          ? "admin-chat-header-email admin-chat-header-email--primary"
                          : isAdmin && active?.customer
                            ? "admin-chat-header-email admin-chat-header-email--primary"
                            : "admin-chat-header-name"
                        : `font-semibold ${textMain}`
                    }
                  >
                    {useCustomerPro ? (
                      "UniQbd Support"
                    ) : isAdmin && active?.customer ? (
                      <span className="admin-chat-header-email-primary-row">
                        <span className="min-w-0 truncate">
                          {chatRoomCustomerLabel(active.customer)}
                        </span>
                        {!active.customer.displayName?.trim() &&
                        active.customer.email?.trim() ? (
                          <ChatEmailCopyButton
                            email={active.customer.email.trim()}
                          />
                        ) : null}
                      </span>
                    ) : (
                      (active?.subject ?? "Support chat")
                    )}
                  </p>
                  {useCustomerPro ? (
                    <p className="admin-chat-header-email">
                      {visibleOnlineCount > 0
                        ? "Our team is online — we usually reply in a few minutes"
                        : "Leave a message — we will reply when our team is back"}
                    </p>
                  ) : null}
                  {!useChatPro && !messenger ? (
                    <div
                      className={
                        use3d
                          ? "admin-chat-header-meta"
                          : "mt-1 flex flex-wrap items-center gap-2"
                      }
                    >
                      {use3d ? (
                        <span className="chat-3d-status">
                          <span
                            className={
                              connected
                                ? "chat-3d-status-dot"
                                : "chat-3d-status-dot chat-3d-status-dot-off"
                            }
                            aria-hidden
                          />
                          {connected ? "Connected" : "Disconnected"}
                        </span>
                      ) : (
                        <p className={`text-xs ${textMuted}`}>
                          {connected ? (
                            <span className="text-brand">● Connected</span>
                          ) : (
                            <span className="text-rose-400">
                              ● Disconnected
                            </span>
                          )}
                        </p>
                      )}
                      {online.length > 0 ? (
                        <span className={`text-xs ${textMuted}`}>
                          · {online.length} online
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              {useChatPro || messenger ? (
                <div className="admin-chat-header-end">
                  <div
                    className="admin-chat-toolbar"
                    role="toolbar"
                    aria-label="Chat actions"
                  >
                    {visibleOnlineCount > 0 || (useCustomerPro && active) ? (
                      <div className="admin-chat-toolbar-meta">
                        {visibleOnlineCount > 0 ? (
                          <span
                            className="admin-chat-toolbar-status admin-chat-toolbar-status--online"
                            aria-live="polite"
                          >
                            <span
                              className="admin-chat-toolbar-status-dot"
                              aria-hidden
                            />
                            {visibleOnlineCount} online
                          </span>
                        ) : null}
                        {useCustomerPro && active ? (
                          <span
                            className={`admin-chat-toolbar-status${
                              active.status === "open"
                                ? " admin-chat-toolbar-status--online"
                                : " admin-chat-toolbar-status--closed"
                            }`}
                          >
                            {active.status}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="admin-chat-toolbar-actions">
                      <ChatHeaderRefreshButton
                        onClick={() => void refreshChat()}
                        busy={refreshingChat}
                        disabled={loading}
                        className={`admin-chat-toolbar-btn${
                          isAdmin ? " admin-chat-refresh-btn--staff" : ""
                        }`}
                      />
                      {isAdmin && active ? (
                        <>
                          <ChatSoundToggle toolbar />
                          <button
                            type="button"
                            disabled={deletingRoomId === roomId(active)}
                            onClick={() =>
                              void removeRoom(
                                roomId(active),
                                active.subject ?? "Support",
                              )
                            }
                            className="admin-chat-toolbar-btn admin-chat-toolbar-btn--danger"
                            aria-label="Delete chat room"
                            title="Delete chat"
                          >
                            <TrashIcon className="h-4 w-4" aria-hidden />
                          </button>
                          {active.status === "open" ? (
                            <button
                              type="button"
                              onClick={() => toggleRoomStatus("closed")}
                              className="admin-chat-toolbar-btn admin-chat-toolbar-btn--close"
                              aria-label="Close room"
                              title="Close room"
                            >
                              <CloseIcon className="h-4 w-4" aria-hidden />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleRoomStatus("open")}
                              className="admin-chat-toolbar-btn admin-chat-toolbar-btn--reopen"
                              aria-label="Reopen room"
                              title="Reopen room"
                            >
                              <CheckIcon className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                  {mobileThread && onMessengerClose ? (
                    <button
                      type="button"
                      className="admin-chat-messenger-close admin-chat-messenger-close--thread"
                      onClick={onMessengerClose}
                      aria-label="Close chat"
                      title="Close chat"
                    >
                      <CloseIcon className="h-5 w-5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : !isAdmin ? (
                <div className="flex items-center gap-2">
                  <ChatHeaderRefreshButton
                    onClick={() => void refreshChat()}
                    busy={refreshingChat}
                    disabled={loading}
                    className="shell-icon-btn"
                    showLabel={false}
                  />
                </div>
              ) : isAdmin && active ? (
                <div className="flex items-center gap-2">
                  <ChatHeaderRefreshButton
                    onClick={() => void refreshChat()}
                    busy={refreshingChat}
                    disabled={loading}
                    className="shell-icon-btn"
                    showLabel={false}
                  />
                  <button
                    type="button"
                    disabled={deletingRoomId === roomId(active)}
                    onClick={() =>
                      void removeRoom(
                        roomId(active),
                        active.subject ?? "Support",
                      )
                    }
                    className="chat-3d-room-delete chat-3d-room-delete-header"
                    aria-label="Delete chat room"
                    title="Delete chat"
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden />
                  </button>
                  {active.status === "open" ? (
                    <button
                      type="button"
                      onClick={() => toggleRoomStatus("closed")}
                      className="chat-3d-room-delete chat-3d-room-delete-action"
                    >
                      <CloseIcon className="h-4 w-4 shrink-0" aria-hidden />
                      Close room
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleRoomStatus("open")}
                      className="panel-3d-btn-ghost panel-3d-btn-sm"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {showAverageResponseHeader && (useChatPro || messenger) ? (
          <div className="admin-chat-header-response" role="note">
            <span className="admin-chat-header-response-label">
              Average Response Time:
            </span>
            <strong className="admin-chat-header-response-value">
              {averageResponseTime}
            </strong>
          </div>
        ) : null}

        {error && (
          <div className="mx-4 mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div
          ref={messagesScrollRef}
          className={
            use3d
              ? "chat-3d-messages min-h-0"
              : useChatPro
                ? "admin-chat-messages chat-messages-3d min-h-0 flex-1 overflow-y-auto p-4"
                : "chat-messages-3d min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
          }
        >
          {historyLoading ? (
            <div
              className={
                useChatPro ? "dashboard-pro-empty py-16" : "py-16 text-center"
              }
            >
              <p className={`text-sm ${textMuted}`}>Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div
              className={
                use3d
                  ? "chat-3d-empty"
                  : useChatPro
                    ? "dashboard-pro-empty py-16"
                    : "py-16 text-center"
              }
            >
              {use3d ? (
                <>
                  <span className="chat-3d-empty-icon" aria-hidden>
                    <ChatIcon className="h-9 w-9" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">
                      Start the conversation
                    </p>
                    <p className="mt-1 text-sm text-foreground-muted">
                      Send a message — our team will reply shortly.
                    </p>
                  </div>
                </>
              ) : useChatPro ? (
                <>
                  <span className="dashboard-pro-empty-icon" aria-hidden>
                    <ChatIcon className="h-6 w-6" />
                  </span>
                  <p className="mt-3 font-semibold text-foreground">
                    Start the conversation
                  </p>
                  <p className="mt-1 text-sm text-subtle">
                    Send a message — our team will reply shortly.
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <ChatIcon
                    className="mx-auto h-9 w-9 text-brand/70"
                    aria-hidden
                  />
                  <p className="font-semibold text-foreground">
                    Start the conversation
                  </p>
                  <p className={`text-sm ${textMuted}`}>
                    Send a message — our team will reply shortly.
                  </p>
                </div>
              )}
            </div>
          ) : (
            messages.map((m) => {
              const mine = sameId(String(m.senderId ?? ""), meRef.current);
              const isStaffMsg = isChatStaffRole(m.senderRole);
              const alignRight = isAdmin ? isStaffMsg : mine;
              const isOtherStaff = isAdmin && isStaffMsg && !mine;
              const useBubble3d = use3d || useFlatPro;
              const senderLabel = m.senderName ?? m.senderRole ?? "User";
              const displayName =
                m.senderFirstName?.trim() ||
                (senderLabel.split(/\s+/)[0] ?? senderLabel);
              const showSenderLabel = isOtherStaff;
              const showAvatar = !alignRight && useBubble3d;

              const bubble3dClass = isAdmin
                ? isStaffMsg
                  ? isOtherStaff
                    ? "chat-bubble-staff"
                    : "chat-bubble-mine"
                  : "chat-bubble-theirs"
                : mine
                  ? "chat-bubble-mine"
                  : "chat-bubble-theirs";

              const bubbleFlatClass = isAdmin
                ? isStaffMsg
                  ? isOtherStaff
                    ? "bg-teal-100 text-teal-900"
                    : "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-800"
                : mine
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-800";

              return (
                <div
                  key={m.id ?? m.createdAt}
                  className={`chat-bubble-row${alignRight ? " chat-bubble-row--mine" : " chat-bubble-row--theirs"}`}
                >
                  {showAvatar ? (
                    <span
                      className={`chat-bubble-avatar${isOtherStaff ? " chat-bubble-avatar--staff" : ""}`}
                      title={senderLabel}
                      aria-label={senderLabel}
                    >
                      {chatSenderInitial(m.senderName, m.senderRole)}
                    </span>
                  ) : null}
                  {showSenderLabel ? (
                    <div className="chat-bubble-with-label">
                      <span
                        className={`chat-bubble-sender-name${isOtherStaff ? " chat-bubble-sender-name--staff" : ""}`}
                      >
                        {displayName}
                      </span>
                      <article
                        className={
                          useBubble3d
                            ? bubble3dClass
                            : `max-w-[75%] rounded-2xl px-4 py-2 text-sm ${bubbleFlatClass}`
                        }
                      >
                        {m.imageUrl ? (
                          <ChatBubbleImage
                            src={resolveMediaSrc(m.imageUrl)}
                            onOpen={() =>
                              setPreviewImageUrl(resolveMediaSrc(m.imageUrl!))
                            }
                          />
                        ) : null}
                        {m.body?.trim() ? (
                          <p className="chat-bubble-body">{m.body}</p>
                        ) : null}
                        {m.createdAt ? (
                          <time
                            className="chat-bubble-time"
                            dateTime={m.createdAt}
                          >
                            {formatChatMessageTime(m.createdAt)}
                          </time>
                        ) : null}
                      </article>
                    </div>
                  ) : (
                    <article
                      className={
                        useBubble3d
                          ? bubble3dClass
                          : `max-w-[75%] rounded-2xl px-4 py-2 text-sm ${bubbleFlatClass}`
                      }
                    >
                      {m.imageUrl ? (
                        <ChatBubbleImage
                          src={resolveMediaSrc(m.imageUrl)}
                          onOpen={() =>
                            setPreviewImageUrl(resolveMediaSrc(m.imageUrl!))
                          }
                        />
                      ) : null}
                      {m.body?.trim() ? (
                        <p className="chat-bubble-body">{m.body}</p>
                      ) : null}
                      {m.createdAt ? (
                        <time
                          className="chat-bubble-time"
                          dateTime={m.createdAt}
                        >
                          {formatChatMessageTime(m.createdAt)}
                        </time>
                      ) : null}
                    </article>
                  )}
                </div>
              );
            })
          )}
          {typing && (
            <div className="chat-bubble-row chat-bubble-row--theirs">
              {use3d || useFlatPro ? (
                <span className="chat-typing-dots" aria-label="Typing">
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                </span>
              ) : (
                <p className={`text-xs italic ${textMuted}`}>Typing…</p>
              )}
            </div>
          )}
          <div
            ref={bottomRef}
            className="chat-messages-scroll-anchor"
            aria-hidden
          />
        </div>

        <div
          className={
            use3d
              ? "chat-3d-input-bar admin-chat-composer-bar"
              : useChatPro
                ? "admin-chat-composer-bar flex gap-2 border-t border-border/45 bg-elevated p-3"
                : `admin-chat-composer-bar flex gap-2 border-t p-3 ${border} ${useFlatPro ? "bg-elevated" : ""}`
          }
        >
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void onImageSelected(file);
            }}
          />
          <form
            className="admin-chat-composer-row"
            onSubmit={handleComposerSubmit}
            noValidate
          >
            {allowChatImages ? (
              <button
                type="button"
                className={`admin-chat-action-btn admin-chat-action-btn--icon admin-chat-action-btn--attach admin-chat-composer-attach${imageUploading ? " admin-chat-action-btn--loading" : ""}`}
                onClick={() => imageInputRef.current?.click()}
                disabled={composerLocked}
                aria-label="Send image"
                title="Send image"
              >
                <ImageAttachIcon className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <div className="admin-chat-composer-input-wrap relative min-w-0 flex-1">
              {quickReplyOpen ? (
                <ChatQuickReplyAutocomplete
                  items={quickReplySuggestions}
                  highlightedIndex={quickReplyHighlight}
                  onHighlight={setQuickReplyHighlight}
                  onSelect={(reply) => applyQuickReply(reply.body)}
                  pro={useChatPro}
                />
              ) : null}
              <textarea
                ref={messageInputRef}
                value={text}
                rows={1}
                name="chat-message"
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                spellCheck
                enterKeyHint="send"
                inputMode="text"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                onChange={(e) => onTyping(e.target.value)}
                onInput={resizeMessageInput}
                onKeyDown={onComposerKeyDown}
                onKeyUp={onComposerKeyUp}
                placeholder="Type a message…"
                title={isAdmin ? "Type / for saved replies" : undefined}
                disabled={composerLocked}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={sendLocked}
              className={sendCls}
              aria-label="Send message"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {showConfig && overview && (
        <aside
          className={`relative z-10 w-52 shrink-0 overflow-y-auto border-l p-3 text-xs ${border} ${textMuted}`}
        >
          <p className={`mb-2 font-semibold uppercase ${textMain}`}>Config</p>
          <p>
            <span className="text-subtle">Transport:</span> {overview.transport}
          </p>
          <p className="mt-1">
            <span className="text-subtle">Namespace:</span> {overview.namespace}
          </p>
          <p className="mt-1">
            <span className="text-subtle">Storage:</span> MongoDB + Redis
          </p>
          <hr className={`my-3 ${border}`} />
          <p>Open rooms: {overview.openRooms}</p>
          <p>Closed: {overview.closedRooms}</p>
          <p>Messages: {overview.totalMessages}</p>
          <hr className={`my-3 ${border}`} />
          <p className={`font-semibold ${textMain}`}>
            Online ({online.length})
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
            {online.slice(0, 8).map((id) => (
              <li key={id}>…{id.slice(-6)}</li>
            ))}
          </ul>
        </aside>
      )}
      {isAdmin && active?.customer ? (
        <ChatCustomerInfoDialog
          customerId={active.customer.id ?? active.createdBy ?? null}
          open={customerInfoOpen}
          onClose={() => setCustomerInfoOpen(false)}
          fallback={{
            displayName: active.customer.displayName,
            email: active.customer.email,
            avatarUrl: active.customer.avatarUrl,
          }}
        />
      ) : null}
      <ChatImagePreview
        src={previewImageUrl}
        open={Boolean(previewImageUrl)}
        onClose={() => setPreviewImageUrl(null)}
      />
    </div>
  );
}
