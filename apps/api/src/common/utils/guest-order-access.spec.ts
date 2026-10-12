import {
  createGuestOrderAccessToken,
  verifyGuestOrderAccessToken,
} from './guest-order-access';

describe('guest order access tokens', () => {
  const secret = 'unit-test-guest-order-secret-value-32ch';
  const orderId = '507f1f77bcf86cd799439011';
  const orderNumber = '1001';

  it('round-trips a valid token', () => {
    const token = createGuestOrderAccessToken(orderId, orderNumber, secret);
    expect(verifyGuestOrderAccessToken(token, secret)).toEqual({
      orderId,
      orderNumber,
    });
  });

  it('rejects a token signed with a different secret', () => {
    const token = createGuestOrderAccessToken(orderId, orderNumber, secret);
    expect(verifyGuestOrderAccessToken(token, 'other-secret-value-32-chars!!')).toBeNull();
  });

  it('rejects an empty token', () => {
    expect(verifyGuestOrderAccessToken('', secret)).toBeNull();
  });
});
