import { classifyIdempotentIntent } from './payment-idempotency';

describe('classifyIdempotentIntent', () => {
  it('reuses the same user intent', () => {
    expect(
      classifyIdempotentIntent({ userId: 'user-a' }, 'user-a'),
    ).toBe('reuse');
  });

  it('rejects a key owned by another user', () => {
    expect(
      classifyIdempotentIntent({ userId: 'user-a' }, 'user-b'),
    ).toBe('foreign');
  });

  it('allows a first-time key', () => {
    expect(classifyIdempotentIntent(null, 'user-a')).toBe('none');
  });
});
