import { RedisSlidingWindowLimiter } from './redis-sliding-window';

describe('Redis sliding window limiter', () => {
  it('falls back to in-process limits when Redis is optional', async () => {
    const limiter = new RedisSlidingWindowLimiter(
      undefined,
      2,
      60_000,
      'test',
      false,
    );
    await expect(limiter.allow('user-1')).resolves.toBe(true);
    await expect(limiter.allow('user-1')).resolves.toBe(true);
    await expect(limiter.allow('user-1')).resolves.toBe(false);
  });

  it('fail-closes without Redis in production', async () => {
    const limiter = new RedisSlidingWindowLimiter(
      undefined,
      10,
      60_000,
      'test',
      true,
    );
    await expect(limiter.allow('user-1')).resolves.toBe(false);
  });

  it('fail-closes when Redis eval fails in production', async () => {
    const redis = {
      eval: async () => {
        throw new Error('READONLY');
      },
    } as never;
    const limiter = new RedisSlidingWindowLimiter(
      redis,
      10,
      60_000,
      'test',
      true,
    );
    await expect(limiter.allow('user-1')).resolves.toBe(false);
  });
});
