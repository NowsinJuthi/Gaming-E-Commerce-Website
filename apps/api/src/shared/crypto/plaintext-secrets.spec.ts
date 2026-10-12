import { SECRET_AT_REST_PREFIX } from './secret-at-rest';
import {
  isLegacyPlaintextSecret,
  PLAINTEXT_ORDER_SECRET_FIELDS,
  plaintextSecretFieldFilter,
  plaintextSecretOrFilter,
  shouldFailClosedOnLegacyPlaintext,
  sumPlaintextCounts,
} from './plaintext-secrets';

describe('plaintext secret reconciliation', () => {
  it('detects legacy plaintext without exposing the value in the filter', () => {
    expect(isLegacyPlaintextSecret('GAME-CODE-1')).toBe(true);
    expect(isLegacyPlaintextSecret(`${SECRET_AT_REST_PREFIX}abc`)).toBe(false);
    const filter = JSON.stringify(plaintextSecretFieldFilter('value'));
    expect(filter).not.toContain('GAME-CODE');
    expect(filter).toContain('enc:v1:');
  });

  it('counts serial, pin, and manual gift cards without projecting values', () => {
    expect(PLAINTEXT_ORDER_SECRET_FIELDS).toEqual(
      expect.arrayContaining([
        'items.deliveredCodes.code',
        'items.deliveredCodes.serial',
        'items.deliveredCodes.pin',
        'manualGiftCards.code',
      ]),
    );
    const filter = JSON.stringify(
      plaintextSecretOrFilter(PLAINTEXT_ORDER_SECRET_FIELDS),
    );
    expect(filter).toContain('manualGiftCards.code');
    expect(filter).not.toContain('STEAM');
  });

  it('sums counts only', () => {
    expect(
      sumPlaintextCounts({
        inventoryItems: 2,
        orderDeliveredCodes: 3,
        resellerOrderCodes: 1,
      }),
    ).toBe(6);
  });

  it('fails production boot when plaintext remains unless an explicit hatch is set', () => {
    expect(
      shouldFailClosedOnLegacyPlaintext({ NODE_ENV: 'production' }, 3),
    ).toBe(true);
    expect(
      shouldFailClosedOnLegacyPlaintext(
        { NODE_ENV: 'production', ALLOW_LEGACY_PLAINTEXT_SECRETS: 'true' },
        3,
      ),
    ).toBe(false);
    expect(
      shouldFailClosedOnLegacyPlaintext({ NODE_ENV: 'production' }, 0),
    ).toBe(false);
    expect(
      shouldFailClosedOnLegacyPlaintext({ NODE_ENV: 'development' }, 9),
    ).toBe(false);
  });
});
