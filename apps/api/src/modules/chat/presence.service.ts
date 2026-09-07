import { Injectable } from '@nestjs/common';
import { CacheService } from '../../shared/cache/cache.service';

const ONLINE_SET = 'chat:online';
const socketSetKey = (userId: string): string => `chat:sockets:${userId}`;
const socketAliveKey = (userId: string, socketId: string): string =>
  `chat:alive:${userId}:${socketId}`;
const legacyConnKey = (userId: string): string => `chat:conn:${userId}`;
const typingKey = (roomId: string, userId: string): string =>
  `chat:typing:${roomId}:${userId}`;
const SOCKET_SET_TTL_SECONDS = 3_600;
const SOCKET_ALIVE_TTL_SECONDS = 75;
const TYPING_TTL_SECONDS = 8;

/**
 * Online-status + typing presence backed by Redis. Each socket id is tracked
 * per user with a short-lived alive key so stale tabs/HMR cannot keep users
 * online after they disconnect.
 */
@Injectable()
export class PresenceService {
  constructor(private readonly cache: CacheService) {}

  private get redis() {
    return this.cache.redis;
  }

  private async safeRedis<T>(fallback: T, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch {
      return fallback;
    }
  }

  private async countLiveSockets(userId: string): Promise<number> {
    const key = socketSetKey(userId);
    const socketIds = await this.redis.smembers(key);
    if (!socketIds.length) {
      return 0;
    }

    let liveCount = 0;
    for (const socketId of socketIds) {
      const alive =
        (await this.redis.exists(socketAliveKey(userId, socketId))) === 1;
      if (alive) {
        liveCount += 1;
        continue;
      }
      await this.redis.srem(key, socketId);
    }
    return liveCount;
  }

  private async syncOnlineState(userId: string): Promise<boolean> {
    const liveCount = await this.countLiveSockets(userId);
    if (liveCount > 0) {
      await this.redis.sadd(ONLINE_SET, userId);
      await this.redis.del(legacyConnKey(userId));
      return true;
    }

    await this.redis.del(socketSetKey(userId));
    await this.redis.del(legacyConnKey(userId));
    await this.redis.srem(ONLINE_SET, userId);
    return false;
  }

  async touchAlive(userId: string, socketId: string): Promise<void> {
    await this.safeRedis(undefined, async () => {
      const key = socketSetKey(userId);
      const member = (await this.redis.sismember(key, socketId)) === 1;
      if (!member) {
        return;
      }
      await this.redis.set(
        socketAliveKey(userId, socketId),
        '1',
        'EX',
        SOCKET_ALIVE_TTL_SECONDS,
      );
      await this.redis.expire(key, SOCKET_SET_TTL_SECONDS);
    });
  }

  /** Returns true when the user transitions from offline to online. */
  async connect(userId: string, socketId: string): Promise<boolean> {
    return this.safeRedis(false, async () => {
      const wasOnline = await this.syncOnlineState(userId);
      const key = socketSetKey(userId);
      await this.redis.sadd(key, socketId);
      await this.redis.set(
        socketAliveKey(userId, socketId),
        '1',
        'EX',
        SOCKET_ALIVE_TTL_SECONDS,
      );
      await this.redis.expire(key, SOCKET_SET_TTL_SECONDS);
      await this.redis.sadd(ONLINE_SET, userId);
      await this.redis.del(legacyConnKey(userId));
      return !wasOnline;
    });
  }

  /** Returns true while the user still has at least one active socket. */
  async disconnect(userId: string, socketId: string): Promise<boolean> {
    return this.safeRedis(false, async () => {
      const key = socketSetKey(userId);
      await this.redis.srem(key, socketId);
      await this.redis.del(socketAliveKey(userId, socketId));
      return this.syncOnlineState(userId);
    });
  }

  async isOnline(userId: string): Promise<boolean> {
    return this.safeRedis(false, () => this.syncOnlineState(userId));
  }

  listOnline(): Promise<string[]> {
    return this.safeRedis([], async () => {
      const ids = await this.redis.smembers(ONLINE_SET);
      const online: string[] = [];

      for (const userId of ids) {
        if (await this.syncOnlineState(userId)) {
          online.push(userId);
        }
      }

      return online;
    });
  }

  async setTyping(
    roomId: string,
    userId: string,
    isTyping: boolean,
  ): Promise<void> {
    await this.safeRedis(undefined, async () => {
      if (isTyping) {
        await this.redis.set(typingKey(roomId, userId), '1', 'EX', TYPING_TTL_SECONDS);
      } else {
        await this.redis.del(typingKey(roomId, userId));
      }
    });
  }
}
