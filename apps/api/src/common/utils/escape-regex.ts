/**
 * Escapes special regex characters in a user-supplied string so it can be
 * safely embedded in a MongoDB `$regex` query without ReDoS or injection risk.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
