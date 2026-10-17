/** Module-level FAB unread count — updated by LiveChatFabSync, read by LiveChatLauncher. */

type Listener = () => void;

let fabUnread = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getLiveChatFabUnread(): number {
  return fabUnread;
}

export function subscribeLiveChatFabUnread(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Instant +1 when a relevant message:new arrives (before REST catches up). */
export function bumpLiveChatFabUnread(): void {
  fabUnread += 1;
  emit();
}

/** Replace count after mark-read, or merge with server poll. */
export function syncLiveChatFabUnread(count: number, exact = false): void {
  fabUnread = exact ? count : Math.max(fabUnread, count);
  emit();
}

export function resetLiveChatFabUnread(): void {
  fabUnread = 0;
  emit();
}
