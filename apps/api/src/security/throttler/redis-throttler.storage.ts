import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { CacheService } from '../../shared/cache/cache.service';

/** Shape returned by ThrottlerStorage.increment (not re-exported by the package). */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Redis-backed throttler storage so rate limits are shared across every API
 * instance (horizontal scaling for 300K+ visitors). Fixed-window counter with
 * a separate block key once the limit is exceeded.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly cache: CacheService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redis = this.cache.redis;
    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${hitKey}:block`;

    const blockTtl = await redis.pttl(blockKey);
    if (blockTtl > 0) {
      const seconds = Math.ceil(blockTtl / 1000);
      return {
        totalHits: limit + 1,
        timeToExpire: seconds,
        isBlocked: true,
        timeToBlockExpire: seconds,
      };
    }

    const totalHits = await redis.incr(hitKey);
    let windowTtl = await redis.pttl(hitKey);
    if (totalHits === 1 || windowTtl < 0) {
      await redis.pexpire(hitKey, ttl);
      windowTtl = ttl;
    }

    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (totalHits > limit) {
      await redis.set(blockKey, '1', 'PX', blockDuration);
      isBlocked = true;
      timeToBlockExpire = Math.ceil(blockDuration / 1000);
    }

    return {
      totalHits,
      timeToExpire: Math.ceil(windowTtl / 1000),
      isBlocked,
      timeToBlockExpire,
    };
  }
}
