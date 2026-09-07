import type { OrderTimelineEntry } from "@/lib/api";

/** Removes back-to-back duplicate status rows (legacy orders may have two "processing" entries). */
export function dedupeConsecutiveTimelineEntries(
  entries: OrderTimelineEntry[],
): OrderTimelineEntry[] {
  return entries.filter((entry, index) => {
    const prev = entries[index - 1];
    if (!prev) {
      return true;
    }
    return (
      entry.status !== prev.status ||
      (entry.note ?? "") !== (prev.note ?? "")
    );
  });
}
