import { SECRET_AT_REST_PREFIX } from './secret-at-rest';

export type PlaintextSecretCounts = {
  inventoryItems: number;
  orderDeliveredCodes: number;
  resellerOrderCodes: number;
};

export function isLegacyPlaintextSecret(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && !value.startsWith(SECRET_AT_REST_PREFIX);
}

/** Mongo filter: stored secret exists and is not AES-GCM sealed. Never projects values. */
export function plaintextSecretFieldFilter(field: string): Record<string, unknown> {
  return {
    [field]: {
      $type: 'string',
      $not: { $regex: `^${SECRET_AT_REST_PREFIX}` },
    },
  };
}

export const PLAINTEXT_ORDER_SECRET_FIELDS = [
  'items.deliveredCodes.code',
  'items.deliveredCodes.serial',
  'items.deliveredCodes.pin',
  'manualGiftCards.code',
] as const;

export const PLAINTEXT_RESELLER_SECRET_FIELDS = [
  'items.deliveredCodes.code',
  'items.deliveredCodes.serial',
  'items.deliveredCodes.pin',
] as const;

export function plaintextSecretOrFilter(
  fields: readonly string[],
): Record<string, unknown> {
  return { $or: fields.map((field) => plaintextSecretFieldFilter(field)) };
}

export function sumPlaintextCounts(counts: PlaintextSecretCounts): number {
  return (
    counts.inventoryItems +
    counts.orderDeliveredCodes +
    counts.resellerOrderCodes
  );
}

/** Production fails closed on leftover plaintext unless an explicit migration hatch is set. */
export function shouldFailClosedOnLegacyPlaintext(
  env: {
    NODE_ENV?: string;
    ALLOW_LEGACY_PLAINTEXT_SECRETS?: string;
  },
  total: number,
): boolean {
  if (env.NODE_ENV !== 'production' || total <= 0) {
    return false;
  }
  return env.ALLOW_LEGACY_PLAINTEXT_SECRETS !== 'true';
}
