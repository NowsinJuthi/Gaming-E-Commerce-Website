import type { ChatQuickReply } from "@/lib/api";

export type QuickReplyTrigger = {
  query: string;
  replaceStart: number;
  replaceEnd: number;
};

const MAX_SUGGESTIONS = 8;
const SHORTCUT_MIN = 2;
const SHORTCUT_MAX = 3;

/** Detect `/command` at end of input or a 2–3 char label shortcut. */
export function parseQuickReplyTrigger(text: string): QuickReplyTrigger | null {
  const slashMatch = text.match(/(?:^|\s)(\/[^\s]*)$/);
  if (slashMatch?.[1]) {
    const token = slashMatch[1];
    const replaceStart = text.length - token.length;
    return {
      query: token.slice(1),
      replaceStart,
      replaceEnd: text.length,
    };
  }

  if (
    text.length >= SHORTCUT_MIN &&
    text.length <= SHORTCUT_MAX &&
    !/\s/.test(text) &&
    !text.startsWith("/")
  ) {
    return {
      query: text,
      replaceStart: 0,
      replaceEnd: text.length,
    };
  }

  return null;
}

export function filterQuickReplies(
  replies: ChatQuickReply[],
  query: string,
): ChatQuickReply[] {
  const q = query.trim().toLowerCase();
  const enabled = replies.filter((r) => r.enabled !== false);
  if (!q) {
    return enabled.slice(0, MAX_SUGGESTIONS);
  }
  return enabled
    .filter((reply) => {
      const label = reply.label.toLowerCase();
      const category = (reply.category ?? "").toLowerCase();
      const body = reply.body.toLowerCase();
      return (
        label.includes(q) ||
        label.startsWith(q) ||
        category.includes(q) ||
        body.includes(q)
      );
    })
    .sort((a, b) => {
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();
      const aStarts = aLabel.startsWith(q) ? 0 : 1;
      const bStarts = bLabel.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
    })
    .slice(0, MAX_SUGGESTIONS);
}

export function applyQuickReplySelection(
  text: string,
  trigger: QuickReplyTrigger,
  body: string,
): string {
  return text.slice(0, trigger.replaceStart) + body + text.slice(trigger.replaceEnd);
}
