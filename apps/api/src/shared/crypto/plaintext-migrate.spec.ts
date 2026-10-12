import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECRET_AT_REST_PREFIX } from './secret-at-rest';
import {
  assertMigrationLogSafe,
  collectPlaintextSetPaths,
  PLAINTEXT_MIGRATE_TARGETS,
  plaintextMigrateLogLine,
  sealedValueLooksEncrypted,
  shouldSealLegacyValue,
} from './plaintext-migrate';

describe('plaintext secret migration planner', () => {
  it('covers inventory, order delivered codes, and reseller codes', () => {
    const collections = new Set(PLAINTEXT_MIGRATE_TARGETS.map((row) => row.collection));
    expect(collections.has('inventory_items')).toBe(true);
    expect(collections.has('orders')).toBe(true);
    expect(collections.has('reseller_orders')).toBe(true);
  });

  it('is idempotent: already-sealed values are skipped', () => {
    expect(shouldSealLegacyValue('STEAM-XXXX')).toBe(true);
    expect(shouldSealLegacyValue(`${SECRET_AT_REST_PREFIX}abc`)).toBe(false);
    expect(sealedValueLooksEncrypted(`${SECRET_AT_REST_PREFIX}abc`)).toBe(true);
    expect(
      collectPlaintextSetPaths({
        value: `${SECRET_AT_REST_PREFIX}abc`,
        items: [{ deliveredCodes: [{ code: `${SECRET_AT_REST_PREFIX}x` }] }],
      }),
    ).toEqual([]);
  });

  it('plans inventory + nested order fields without putting secrets in the log', () => {
    const paths = collectPlaintextSetPaths({
      value: 'INV-SECRET',
      items: [
        {
          deliveredCodes: [{ code: 'ORDER-SECRET', serial: 'SN-1', pin: 'PIN-9' }],
        },
      ],
      manualGiftCards: [{ code: 'CARD-SECRET' }],
    });
    expect(paths).toEqual([
      'value',
      'items.0.deliveredCodes.0.code',
      'items.0.deliveredCodes.0.serial',
      'items.0.deliveredCodes.0.pin',
      'manualGiftCards.0.code',
    ]);
    const log = plaintextMigrateLogLine({ inventory_items: 1, orders: 2 });
    expect(log).toBe('plaintext encryption inventory_items=1 orders=2');
    expect(() =>
      assertMigrationLogSafe(log, [
        'INV-SECRET',
        'ORDER-SECRET',
        'SN-1',
        'PIN-9',
        'CARD-SECRET',
      ]),
    ).not.toThrow();
  });

  it('keeps the operator script backup-safe, idempotent, and secret-silent', () => {
    const src = readFileSync(
      join(__dirname, '../../../scripts/encrypt-delivered-codes.cjs'),
      'utf8',
    );
    expect(src).toContain('inventory_items');
    expect(src).toContain('Take a Mongo backup');
    expect(src).toContain("process.argv.includes('--apply')");
    expect(src).toContain('startsWith(PREFIX)');
    expect(src).not.toMatch(/console\.log\([^)]*doc\./);
    expect(src).not.toMatch(/console\.log\([^)]*next\.(code|value|serial|pin)/);
  });
});
