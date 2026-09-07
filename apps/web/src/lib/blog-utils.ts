import { toMetaText } from "@/lib/seo";

const WORDS_PER_MINUTE = 200;

export function estimateReadingTimeMinutes(
  content: string | undefined | null,
  excerpt?: string | null,
): number {
  const text = toMetaText(content || excerpt || "", 50_000);
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function formatBlogDate(value: string | Date | undefined | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
