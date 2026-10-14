import { Injectable } from '@nestjs/common';
import { CacheService } from '../../shared/cache/cache.service';
import type {
  LiveAnalyticsSnapshot,
  LiveMediaRow,
  LiveVisitorRow,
} from './live-analytics.types';

const VISITOR_ZSET = 'live:visitors:z';
const MEDIA_ZSET = 'live:media:z';
const ACTIVE_WINDOW_MS = 90_000;
const HASH_TTL_SECONDS = 120;

const visitorHash = (key: string) => `live:visitor:h:${key}`;
const mediaHash = (key: string) => `live:media:h:${key}`;
const socketMap = (socketId: string) => `live:socket:${socketId}`;

@Injectable()
export class LiveAnalyticsService {
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private broadcastFn: ((snapshot: LiveAnalyticsSnapshot) => void) | null = null;

  constructor(private readonly cache: CacheService) {}

  setBroadcast(fn: (snapshot: LiveAnalyticsSnapshot) => void): void {
    this.broadcastFn = fn;
  }

  private get redis() {
    return this.cache.redis;
  }

  private async safe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch {
      return fallback;
    }
  }

  scheduleNotify(): void {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      void this.pushSnapshot();
    }, 400);
  }

  private async pushSnapshot(): Promise<void> {
    if (!this.broadcastFn) return;
    const snapshot = await this.getSnapshot();
    this.broadcastFn(snapshot);
  }

  async touchVisitor(input: {
    visitorKey: string;
    socketId: string;
    path: string;
    label: string;
    userId?: string | null;
  }): Promise<void> {
    await this.safe(undefined, async () => {
      const now = Date.now();
      const key = input.visitorKey.trim().slice(0, 64);
      if (key.length < 8) return;

      await this.redis
        .multi()
        .zadd(VISITOR_ZSET, now, key)
        .hset(visitorHash(key), {
          path: input.path.slice(0, 240),
          label: input.label.slice(0, 120),
          userId: input.userId?.trim() || '',
          socketId: input.socketId,
          lastSeen: String(now),
        })
        .expire(visitorHash(key), HASH_TTL_SECONDS)
        .set(socketMap(input.socketId), key, 'EX', HASH_TTL_SECONDS)
        .exec();

      this.scheduleNotify();
    });
  }

  async setMediaWatch(input: {
    visitorKey: string;
    socketId: string;
    titleId: string;
    titleName: string;
    episodeName?: string | null;
    label: string;
    userId?: string | null;
  }): Promise<void> {
    await this.safe(undefined, async () => {
      const now = Date.now();
      const key = input.visitorKey.trim().slice(0, 64);
      const titleId = input.titleId.trim().slice(0, 64);
      if (key.length < 8 || !titleId) return;

      await this.redis
        .multi()
        .zadd(MEDIA_ZSET, now, key)
        .hset(mediaHash(key), {
          titleId,
          titleName: input.titleName.slice(0, 200),
          episodeName: input.episodeName?.slice(0, 120) || '',
          label: input.label.slice(0, 120),
          userId: input.userId?.trim() || '',
          socketId: input.socketId,
          lastSeen: String(now),
        })
        .expire(mediaHash(key), HASH_TTL_SECONDS)
        .set(socketMap(input.socketId), key, 'EX', HASH_TTL_SECONDS)
        .exec();

      this.scheduleNotify();
    });
  }

  async clearMediaWatch(visitorKey: string): Promise<void> {
    await this.safe(undefined, async () => {
      const key = visitorKey.trim().slice(0, 64);
      if (key.length < 8) return;
      await this.redis.multi().zrem(MEDIA_ZSET, key).del(mediaHash(key)).exec();
      this.scheduleNotify();
    });
  }

  async removeSocket(socketId: string): Promise<void> {
    await this.safe(undefined, async () => {
      const key = await this.redis.get(socketMap(socketId));
      await this.redis.del(socketMap(socketId));
      if (!key) return;

      const visitorHashKey = visitorHash(key);
      const stored = await this.redis.hget(visitorHashKey, 'socketId');
      if (stored === socketId) {
        await this.redis.multi().zrem(VISITOR_ZSET, key).del(visitorHashKey).exec();
      }

      const mediaHashKey = mediaHash(key);
      const mediaSocket = await this.redis.hget(mediaHashKey, 'socketId');
      if (mediaSocket === socketId) {
        await this.redis.multi().zrem(MEDIA_ZSET, key).del(mediaHashKey).exec();
      }

      this.scheduleNotify();
    });
  }

  private async pruneZset(key: string, minScore: number): Promise<void> {
    await this.redis.zremrangebyscore(key, 0, minScore);
  }

  async getSnapshot(): Promise<LiveAnalyticsSnapshot> {
    return this.safe(
      {
        updatedAt: Date.now(),
        visitorCount: 0,
        visitors: [],
        mediaSessions: [],
      },
      async () => {
        const now = Date.now();
        const minScore = now - ACTIVE_WINDOW_MS;
        await this.pruneZset(VISITOR_ZSET, minScore);
        await this.pruneZset(MEDIA_ZSET, minScore);

        const visitorKeys = await this.redis.zrevrange(VISITOR_ZSET, 0, 99);
        const mediaKeys = await this.redis.zrevrange(MEDIA_ZSET, 0, 99);

        const visitors: LiveVisitorRow[] = [];
        for (const visitorKey of visitorKeys) {
          const row = await this.redis.hgetall(visitorHash(visitorKey));
          if (!row?.lastSeen) continue;
          const lastSeen = Number(row.lastSeen);
          if (!Number.isFinite(lastSeen) || lastSeen < minScore) continue;
          visitors.push({
            visitorKey,
            path: row.path || '/',
            label: row.label || 'Visitor',
            userId: row.userId?.trim() || null,
            lastSeen,
          });
        }

        const mediaSessions: LiveMediaRow[] = [];
        for (const visitorKey of mediaKeys) {
          const row = await this.redis.hgetall(mediaHash(visitorKey));
          if (!row?.lastSeen || !row.titleId) continue;
          const lastSeen = Number(row.lastSeen);
          if (!Number.isFinite(lastSeen) || lastSeen < minScore) continue;
          mediaSessions.push({
            visitorKey,
            label: row.label || 'Viewer',
            userId: row.userId?.trim() || null,
            titleId: row.titleId,
            titleName: row.titleName || 'Unknown title',
            episodeName: row.episodeName?.trim() || null,
            lastSeen,
          });
        }

        return {
          updatedAt: now,
          visitorCount: visitors.length,
          visitors,
          mediaSessions,
        };
      },
    );
  }
}
