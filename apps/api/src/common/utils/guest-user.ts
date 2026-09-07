/** Ephemeral checkout mailbox — not a registered customer account. */
export function isGuestMailbox(email: string | undefined | null): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.endsWith('@guest.local') ||
    normalized.includes('@removed.local') ||
    normalized.startsWith('guest+')
  );
}

export function isEphemeralGuestUser(user: {
  isGuest?: boolean;
  email?: string;
}): boolean {
  if (user.isGuest) return true;
  return isGuestMailbox(user.email);
}
