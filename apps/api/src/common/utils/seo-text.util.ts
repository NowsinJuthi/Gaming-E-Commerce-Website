export function toMetaText(input: string | undefined | null, max = 160): string {
  if (!input) return '';
  const text = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
