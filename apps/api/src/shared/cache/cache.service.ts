import { Inject, Injectable } from '@nestjs/common';

import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';



type MemoryEntry = { value: string; expiresAt?: number };



@Injectable()

export class CacheService {

  private readonly memory = new Map<string, MemoryEntry>();



  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}



  /** Direct access to the underlying ioredis client for advanced operations. */

  get redis(): Redis {

    return this.client;

  }



  private pruneExpiredMemory(): void {

    const now = Date.now();

    for (const [key, entry] of this.memory) {

      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {

        this.memory.delete(key);

      }

    }

  }



  private memoryGet(key: string): string | null {

    this.pruneExpiredMemory();

    const entry = this.memory.get(key);

    if (!entry) return null;

    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {

      this.memory.delete(key);

      return null;

    }

    return entry.value;

  }



  private memorySet(key: string, value: string, ttlSeconds?: number): void {

    this.pruneExpiredMemory();

    const expiresAt =

      ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;

    this.memory.set(key, { value, expiresAt });

  }



  private async withRedis<T>(fn: () => Promise<T>): Promise<T | undefined> {

    try {

      return await fn();

    } catch {

      return undefined;

    }

  }



  async get(key: string): Promise<string | null> {

    const fromRedis = await this.withRedis(() => this.client.get(key));

    if (fromRedis !== undefined) return fromRedis;

    return this.memoryGet(key);

  }



  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {

    const wrote = await this.withRedis(async () => {

      if (ttlSeconds && ttlSeconds > 0) {

        await this.client.set(key, value, 'EX', ttlSeconds);

      } else {

        await this.client.set(key, value);

      }

    });

    if (wrote === undefined) {

      this.memorySet(key, value, ttlSeconds);

    }

  }



  async del(key: string): Promise<void> {

    await this.withRedis(() => this.client.del(key));

    this.memory.delete(key);

  }



  /** Delete every key starting with `prefix` from both Redis (SCAN + pipeline) and memory fallback. */

  async delByPrefix(prefix: string): Promise<void> {

    await this.withRedis(async () => {

      let cursor = '0';

      do {

        const [next, keys] = await this.client.scan(

          cursor,

          'MATCH',

          `${prefix}*`,

          'COUNT',

          100,

        );

        cursor = next;

        if (keys.length > 0) {

          // Pipeline all DEL commands in one round-trip instead of one DEL per batch.

          const pipeline = this.client.pipeline();

          for (const key of keys) pipeline.del(key);

          await pipeline.exec();

        }

      } while (cursor !== '0');

    });

    for (const key of this.memory.keys()) {

      if (key.startsWith(prefix)) {

        this.memory.delete(key);

      }

    }

  }



  async getJson<T>(key: string): Promise<T | null> {

    const raw = await this.get(key);

    if (!raw) {

      return null;

    }

    try {

      return JSON.parse(raw) as T;

    } catch {

      return null;

    }

  }



  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {

    await this.set(key, JSON.stringify(value), ttlSeconds);

  }

}

