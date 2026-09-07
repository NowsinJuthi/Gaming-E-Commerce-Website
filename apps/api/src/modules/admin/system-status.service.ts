import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Connection } from 'mongoose';
import { CacheService } from '../../shared/cache/cache.service';
import { isRedisOptional } from '../../shared/cache/redis-options';
import {
  DELIVERY_QUEUE,
  NOTIFICATIONS_QUEUE,
  ORDERS_QUEUE,
  PAYMENTS_QUEUE,
} from '../../queues/queue.constants';
import { ApiRouteMetricsService } from './api-route-metrics.service';

export interface DependencyStatus {
  ok: boolean;
  state?: string;
  latencyMs?: number;
  error?: string;
}

export interface RedisMetrics {
  version?: string;
  uptimeSeconds?: number;
  usedMemoryMb: number;
  peakMemoryMb: number;
  maxMemoryMb: number;
  memoryUsagePercent?: number;
  connectedClients: number;
  opsPerSec: number;
  hitRate?: number;
  totalKeys: number;
}

const READY_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const QUEUE_NAMES = [
  ORDERS_QUEUE,
  PAYMENTS_QUEUE,
  DELIVERY_QUEUE,
  NOTIFICATIONS_QUEUE,
] as const;

const OFFLINE_QUEUE_COUNTS = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
} as const;

@Injectable()
export class SystemStatusService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    private readonly apiRoutes: ApiRouteMetricsService,
    @InjectQueue(ORDERS_QUEUE) private readonly ordersQueue: Queue,
    @InjectQueue(PAYMENTS_QUEUE) private readonly paymentsQueue: Queue,
    @InjectQueue(DELIVERY_QUEUE) private readonly deliveryQueue: Queue,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
  ) {}

  async status() {
    const [database, redis, queues] = await Promise.all([
      this.databaseStatus(),
      this.redisStatus(),
      this.queueStatus(),
    ]);

    const healthy = database.ok && redis.ok;
    return {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      uptimeSeconds: Math.round(process.uptime()),
      memory: this.memory(),
      node: process.version,
      apis: this.apiRoutes.getMetrics(),
      database,
      redis,
      queues,
    };
  }

  private async databaseStatus(): Promise<DependencyStatus> {
    const state = READY_STATES[this.connection.readyState] ?? 'unknown';
    try {
      const start = Date.now();
      await this.connection.db?.admin().ping();
      return { ok: this.connection.readyState === 1, state, latencyMs: Date.now() - start };
    } catch (error) {
      return { ok: false, state, error: (error as Error).message };
    }
  }

  private async redisStatus(): Promise<
    DependencyStatus & { metrics?: RedisMetrics }
  > {
    try {
      const start = Date.now();
      await this.cache.redis.ping();
      const latencyMs = Date.now() - start;
      const metrics = await this.redisMetrics();
      return {
        ok: this.cache.redis.status === 'ready',
        state: this.cache.redis.status,
        latencyMs,
        metrics,
      };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private async redisMetrics(): Promise<RedisMetrics | undefined> {
    try {
      const [info, dbSize] = await Promise.all([
        this.cache.redis.info(),
        this.cache.redis.dbsize(),
      ]);
      return this.parseRedisInfo(info, dbSize);
    } catch {
      return undefined;
    }
  }

  private parseRedisInfo(info: string, totalKeys: number): RedisMetrics {
    const map = new Map<string, string>();
    for (const line of info.split('\n')) {
      if (line.startsWith('#') || !line.includes(':')) continue;
      const idx = line.indexOf(':');
      map.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }

    const usedMemory = Number(map.get('used_memory') ?? 0);
    const peakMemory = Number(map.get('used_memory_peak') ?? 0);
    const maxMemory = Number(map.get('maxmemory') ?? 0);
    const hits = Number(map.get('keyspace_hits') ?? 0);
    const misses = Number(map.get('keyspace_misses') ?? 0);
    const hitTotal = hits + misses;

    const toMb = (bytes: number): number =>
      Math.round((bytes / 1024 / 1024) * 100) / 100;

    return {
      version: map.get('redis_version'),
      uptimeSeconds: Number(map.get('uptime_in_seconds') ?? 0),
      usedMemoryMb: toMb(usedMemory),
      peakMemoryMb: toMb(peakMemory),
      maxMemoryMb: toMb(maxMemory),
      memoryUsagePercent:
        maxMemory > 0
          ? Math.round((usedMemory / maxMemory) * 1000) / 10
          : undefined,
      connectedClients: Number(map.get('connected_clients') ?? 0),
      opsPerSec: Number(map.get('instantaneous_ops_per_sec') ?? 0),
      hitRate:
        hitTotal > 0 ? Math.round((hits / hitTotal) * 1000) / 10 : undefined,
      totalKeys,
    };
  }

  private offlineQueueStatus(
    error: string,
    redisOffline = false,
  ): Record<string, unknown> {
    return Object.fromEntries(
      QUEUE_NAMES.map((name) => [
        name,
        {
          ok: false,
          redisOffline,
          ...OFFLINE_QUEUE_COUNTS,
          error,
        },
      ]),
    );
  }

  private async queueStatus(): Promise<Record<string, unknown>> {
    const redisOptional = isRedisOptional(this.config);
    const redisReachable = await this.isRedisReachable();

    if (!redisReachable) {
      return this.offlineQueueStatus(
        redisOptional
          ? 'Redis offline — orders/delivery use sync fallback in dev'
          : 'Redis unreachable — background jobs cannot run',
        true,
      );
    }

    const queues: Record<string, Queue> = {
      [ORDERS_QUEUE]: this.ordersQueue,
      [PAYMENTS_QUEUE]: this.paymentsQueue,
      [DELIVERY_QUEUE]: this.deliveryQueue,
      [NOTIFICATIONS_QUEUE]: this.notificationsQueue,
    };

    const entries = await Promise.all(
      Object.entries(queues).map(async ([name, queue]) => {
        try {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
          );
          return [name, { ok: true, ...counts }] as const;
        } catch (error) {
          const message = (error as Error).message;
          return [
            name,
            {
              ok: false,
              ...OFFLINE_QUEUE_COUNTS,
              error:
                message === 'Connection is closed'
                  ? 'Redis connection lost'
                  : message,
            },
          ] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
  }

  private async isRedisReachable(): Promise<boolean> {
    try {
      const pong = await this.cache.redis.ping();
      return pong === 'PONG' && this.cache.redis.status === 'ready';
    } catch {
      return false;
    }
  }

  private memory(): { rssMb: number; heapUsedMb: number; heapTotalMb: number } {
    const usage = process.memoryUsage();
    const toMb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 100) / 100;
    return {
      rssMb: toMb(usage.rss),
      heapUsedMb: toMb(usage.heapUsed),
      heapTotalMb: toMb(usage.heapTotal),
    };
  }
}
