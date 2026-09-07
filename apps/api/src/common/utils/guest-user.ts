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

/**
 * Active or finalized guest checkout/chat account — excluded from admin customer lists.
 * Does not match registered users soft-deleted as deleted+id@removed.local.
 */
export function isGuestSessionAccount(user: {
  isGuest?: boolean;
  email?: string;
}): boolean {
  if (user.isGuest) return true;
  const normalized = (user.email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.endsWith('@guest.local') ||
    normalized.startsWith('guest+') ||
    normalized.startsWith('guest_')
  );
}

export function guestSessionAccountEmailFilter(): {
  $nor: Array<Record<string, unknown>>;
} {
  return {
    $nor: [
      { email: { $regex: /@guest\.local$/i } },
      { email: { $regex: /^guest\+/i } },
      { email: { $regex: /^guest_/i } },
    ],
  };
}

export function isEphemeralGuestUser(user: {
  isGuest?: boolean;
  email?: string;
}): boolean {
  if (user.isGuest) return true;
  return isGuestMailbox(user.email);
}
