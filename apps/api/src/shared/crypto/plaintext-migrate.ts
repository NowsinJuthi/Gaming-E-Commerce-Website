import { SECRET_AT_REST_PREFIX } from './secret-at-rest';
import { isLegacyPlaintextSecret } from './plaintext-secrets';

export type PlaintextMigrateTarget = {
  collection: 'inventory_items' | 'orders' | 'reseller_orders';
  field: string;
};

export const PLAINTEXT_MIGRATE_TARGETS: readonly PlaintextMigrateTarget[] = [
  { collection: 'inventory_items', field: 'value' },
  { collection: 'orders', field: 'items.deliveredCodes.code' },
  { collection: 'orders', field: 'items.deliveredCodes.serial' },
  { collection: 'orders', field: 'items.deliveredCodes.pin' },
  { collection: 'orders', field: 'manualGiftCards.code' },
  { collection: 'reseller_orders', field: 'items.deliveredCodes.code' },
];

export type PlaintextMigrateCounts = Record<string, number>;

export function plaintextMigrateLogLine(counts: PlaintextMigrateCounts): string {
  const parts = Object.entries(counts).map(([key, value]) => `${key}=${value}`);
  return `plaintext encryption ${parts.join(' ')}`;
}

export function assertMigrationLogSafe(logLine: string, secrets: string[]): void {
  for (const secret of secrets) {
    if (secret && logLine.includes(secret)) {
      throw new Error('Migration log leaked a secret value');
    }
  }
}

export function shouldSealLegacyValue(value: unknown): value is string {
  return isLegacyPlaintextSecret(value);
}

export function sealedValueLooksEncrypted(value: string): boolean {
  return value.startsWith(SECRET_AT_REST_PREFIX);
}

/**
 * Idempotent path planner: only emit $set paths for plaintext fields.
 * Never returns the original secret in logs — callers must not print `next`.
 */
export function collectPlaintextSetPaths(doc: {
  value?: unknown;
  items?: Array<{
    deliveredCodes?: Array<{ code?: unknown; serial?: unknown; pin?: unknown }>;
  }>;
  manualGiftCards?: Array<{ code?: unknown }>;
}): string[] {
  const paths: string[] = [];
  if (shouldSealLegacyValue(doc.value)) {
    paths.push('value');
  }
  (doc.items ?? []).forEach((item, i) => {
    (item.deliveredCodes ?? []).forEach((code, j) => {
      if (shouldSealLegacyValue(code.code)) {
        paths.push(`items.${i}.deliveredCodes.${j}.code`);
      }
      if (shouldSealLegacyValue(code.serial)) {
        paths.push(`items.${i}.deliveredCodes.${j}.serial`);
      }
      if (shouldSealLegacyValue(code.pin)) {
        paths.push(`items.${i}.deliveredCodes.${j}.pin`);
      }
    });
  });
  (doc.manualGiftCards ?? []).forEach((card, i) => {
    if (shouldSealLegacyValue(card.code)) {
      paths.push(`manualGiftCards.${i}.code`);
    }
  });
  return paths;
}
