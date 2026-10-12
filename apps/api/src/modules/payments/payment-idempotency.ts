export type IdempotencyLookup = 'reuse' | 'foreign' | 'none';

/** Idempotency keys are caller-scoped; a foreign key must not return another user's intent. */
export function classifyIdempotentIntent(
  existing: { userId: unknown } | null | undefined,
  userId: string,
): IdempotencyLookup {
  if (!existing) return 'none';
  return String(existing.userId) === userId ? 'reuse' : 'foreign';
}
