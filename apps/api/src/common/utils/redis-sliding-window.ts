import type { Redis } from 'ioredis';
import { SlidingWindowLimiter } from './sliding-window-limiter';

const LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= max then
  return 0
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return 1
`;

/**
 * Shared sliding window. Production uses Redis so multiple API instances share
 * the same buckets. Dev falls back to in-process memory when Redis is optional.
 */
export class RedisSlidingWindowLimiter {
  private readonly memory: SlidingWindowLimiter;

  constructor(
    private readonly redis: Redis | undefined,
    private readonly max: number,
    private readonly windowMs: number,
    private readonly prefix: string,
    private readonly failClosedWithoutRedis: boolean,
  ) {
    this.memory = new SlidingWindowLimiter(max, windowMs);
  }

  async allow(key: string): Promise<boolean> {
    if (!this.redis) {
      return this.failClosedWithoutRedis ? false : this.memory.allow(key);
    }
    try {
      const now = Date.now();
      const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
      const result = await this.redis.eval(
        LUA,
        1,
        `${this.prefix}:${key}`,
        String(now),
        String(this.windowMs),
        String(this.max),
        member,
      );
      return result === 1;
    } catch {
      return this.failClosedWithoutRedis ? false : this.memory.allow(key);
    }
  }
}
