"use client";

import type { ChatQuickReply } from "@/lib/api";

type Props = {
  items: ChatQuickReply[];
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (reply: ChatQuickReply) => void;
  pro?: boolean;
};

export function ChatQuickReplyAutocomplete({
  items,
  highlightedIndex,
  onHighlight,
  onSelect,
  pro = false,
}: Props) {
  if (!items.length) return null;

  const safeIndex =
    highlightedIndex >= 0 && highlightedIndex < items.length
      ? highlightedIndex
      : 0;

  return (
    <div
      className={`chat-quick-reply-menu absolute bottom-full left-0 z-20 mb-2 w-full min-w-[16rem] max-w-md overflow-hidden rounded-xl border shadow-lg ${
        pro
          ? "border-border/48 bg-elevated"
          : "border-slate-200 bg-white"
      }`}
      role="listbox"
      aria-label="Saved replies"
    >
      <p
        className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${
          pro ? "text-subtle" : "text-slate-500"
        }`}
      >
        Saved replies
      </p>
      <ul className="max-h-56 overflow-y-auto overscroll-contain py-1">
        {items.map((reply, index) => {
          const active = index === safeIndex;
          const preview =
            reply.body.length > 96 ? `${reply.body.slice(0, 96)}…` : reply.body;
          return (
            <li key={reply.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={`w-full px-3 py-2 text-left transition-colors ${
                  active
                    ? pro
                      ? "bg-brand/10 text-foreground"
                      : "bg-indigo-50 text-slate-900"
                    : pro
                      ? "text-foreground hover:bg-muted/40"
                      : "text-slate-800 hover:bg-slate-50"
                }`}
                onMouseEnter={() => onHighlight(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(reply);
                }}
              >
                <span className="block text-sm font-semibold text-brand">
                  {reply.label}
                </span>
                {(reply.category ?? "").trim() ? (
                  <span
                    className={`mt-0.5 block text-[10px] uppercase tracking-wide ${
                      pro ? "text-subtle" : "text-slate-500"
                    }`}
                  >
                    {(reply.category ?? "").trim()}
                  </span>
                ) : null}
                <span
                  className={`mt-1 block text-xs line-clamp-2 ${
                    pro ? "text-foreground-muted" : "text-slate-600"
                  }`}
                >
                  {preview}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
