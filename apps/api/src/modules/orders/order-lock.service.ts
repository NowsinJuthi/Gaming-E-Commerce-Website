import { Injectable } from '@nestjs/common';
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import { EventsService } from '../../shared/events/events.service';
import { AppEvent } from '../../shared/events/events.types';

export interface OrderLockInfo {
  orderId: string;
  userId: string;
  userName: string;
  lockedAt: string;
}

export interface AcquireResult {
  acquired: boolean;
  /** Present when acquired = false — who currently holds the lock. */
  lock?: OrderLockInfo;
}

@Injectable()
export class OrderLockService {
  constructor(
    private readonly cache: CacheService,
    private readonly events: EventsService,
  ) {}

  /**
   * Try to acquire an edit lock for an order.
   *
   * - If no lock exists → creates one, returns { acquired: true }.
   * - If the same user already holds the lock → refreshes TTL, returns { acquired: true }.
   * - If a different user holds a valid lock → returns { acquired: false, lock }.
   */
  async acquireLock(
    orderId: string,
    userId: string,
    userName: string,
  ): Promise<AcquireResult> {
    const key = CacheKeys.order.lock(orderId);
    const existing = await this.cache.getJson<OrderLockInfo>(key);

    if (existing && existing.userId !== userId) {
      return { acquired: false, lock: existing };
    }

    const lock: OrderLockInfo = {
      orderId,
      userId,
      userName,
      lockedAt: existing?.lockedAt ?? new Date().toISOString(),
    };
    await this.cache.setJson(key, lock, CacheKeys.ttl.orderLock);

    if (!existing) {
      this.events.emit(AppEvent.OrderLocked, { orderId, userId, userName });
    }

    return { acquired: true };
  }

  /**
   * Release the lock. Only the owner can release their own lock.
   * Silently no-ops if caller does not hold the lock.
   */
  async releaseLock(orderId: string, userId: string): Promise<void> {
    const key = CacheKeys.order.lock(orderId);
    const existing = await this.cache.getJson<OrderLockInfo>(key);
    if (!existing || existing.userId !== userId) return;
    await this.cache.del(key);
    this.events.emit(AppEvent.OrderUnlocked, { orderId });
  }

  /**
   * Extend the TTL while the user is still viewing the order.
   * Returns false if the caller no longer holds the lock (expired / stolen).
   */
  async refreshLock(orderId: string, userId: string): Promise<boolean> {
    const key = CacheKeys.order.lock(orderId);
    const existing = await this.cache.getJson<OrderLockInfo>(key);
    if (!existing || existing.userId !== userId) return false;
    await this.cache.setJson(key, existing, CacheKeys.ttl.orderLock);
    return true;
  }

  /** Return the current lock holder for a single order, or null. */
  async getLock(orderId: string): Promise<OrderLockInfo | null> {
    return this.cache.getJson<OrderLockInfo>(CacheKeys.order.lock(orderId));
  }

  /**
   * Return all currently active locks (for the admin orders list).
   * Uses Redis SCAN to find all `order:lock:*` keys.
   */
  async getAllLocks(): Promise<OrderLockInfo[]> {
    const redis = this.cache.redis;
    const prefix = CacheKeys.order.lockPrefix;
    const keys: string[] = [];

    let cursor = '0';
    do {
      const [next, batch] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length === 0) return [];

    const values = await redis.mget(...keys);
    const locks: OrderLockInfo[] = [];
    for (const raw of values) {
      if (!raw) continue;
      try {
        locks.push(JSON.parse(raw) as OrderLockInfo);
      } catch {
        // malformed entry — skip
      }
    }
    return locks;
  }
}
