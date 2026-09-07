import { ConfigService } from '@nestjs/config';
import type { Redis, RedisOptions } from 'ioredis';

/** In dev, Redis is optional unless REDIS_OPTIONAL=false. */
export function isRedisOptional(config: ConfigService): boolean {
  if (config.get<string>('app.env') === 'production') {
    return false;
  }
  return config.get<boolean>('redis.optional') !== false;
}

export function buildRedisConnectionOptions(
  config: ConfigService,
  forBull = false,
): RedisOptions {
  const password = config.get<string>('redis.password');
  const optional = isRedisOptional(config);

  const base: RedisOptions = {
    host: config.get<string>('redis.host') ?? '127.0.0.1',
    port: config.get<number>('redis.port') ?? 6379,
    password: password ? password : undefined,
    // Avoid duplicate ::1 + 127.0.0.1 connection attempts on Windows.
    family: 4,
  };

  if (!optional) {
    return {
      ...base,
      maxRetriesPerRequest: forBull ? null : 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    };
  }

  // Cache client: lazy + memory fallback when Redis is down.
  if (!forBull) {
    return {
      ...base,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    };
  }

  // BullMQ: eager connect with short retries so queues work when Redis is up in dev.
  return {
    ...base,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
  };
}

/** Wait until the shared Redis client is ready (handles async eager connect). */
export async function waitForRedisReady(
  client: Redis,
  timeoutMs = 5000,
): Promise<void> {
  if (client.status === 'ready') {
    await client.ping();
    return;
  }

  if (
    client.status === 'wait' ||
    client.status === 'end' ||
    client.status === 'close'
  ) {
    await client.connect();
  }
  // connecting | connect | reconnecting — wait below; do not call connect() again

  try {
    await client.ping();
    return;
  } catch {
    // Still connecting — wait for ready below.
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Redis connect timeout')),
      timeoutMs,
    );

    const cleanup = () => {
      clearTimeout(timer);
      client.off('ready', onReady);
      client.off('error', onError);
    };

    const onReady = () => {
      cleanup();
      void client.ping().then(() => resolve()).catch(reject);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    client.once('ready', onReady);
    client.once('error', onError);
  });
}

/** Suppress repeated Redis ECONNREFUSED noise in optional dev mode. */
export function installOptionalRedisDevSilencer(): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.REDIS_OPTIONAL === 'false') return;

  let warned = false;
  const isOptionalRedisNoise = (value: unknown): boolean => {
    const text = value instanceof Error ? `${value.name} ${value.message}` : String(value);
    return (
      (text.includes('ECONNREFUSED') && text.includes('6379')) ||
      text.includes('Connection is closed')
    );
  };

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (args.some(isOptionalRedisNoise)) {
      if (!warned) {
        warned = true;
        console.warn(
          '[redis] Dev mode: Redis is not running on port 6379. API works without it; start Redis only if you need queues/chat scale-out.',
        );
      }
      return;
    }
    original(...args);
  };
}
