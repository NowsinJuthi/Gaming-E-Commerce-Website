const ROOM_ID_RE = /^[a-f0-9]{24}$/i;

function pathnameOf(imageUrl: string): string | null {
  const raw = imageUrl.trim();
  if (!raw || raw.length > 500) return null;
  if (raw.startsWith('//') || raw.includes('\\')) return null;

  if (raw.startsWith('/')) {
    return raw.split('?')[0] ?? null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.pathname;
  } catch {
    return null;
  }
}

/** Chat image URLs must be our upload path for this room, not a substring decoy. */
export function isValidChatImageUrl(imageUrl: string, roomId: string): boolean {
  if (!ROOM_ID_RE.test(roomId)) return false;
  const pathname = pathnameOf(imageUrl);
  if (!pathname) return false;

  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (decoded.includes('..') || decoded.includes('\\')) return false;

  const prefixes = [
    `/api/uploads/live-chat/${roomId}/`,
    `/uploads/live-chat/${roomId}/`,
  ];
  return prefixes.some((prefix) => decoded.startsWith(prefix));
}
