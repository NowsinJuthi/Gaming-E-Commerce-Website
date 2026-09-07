import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD ?? '',
  /** Dev: skip Redis when offline (set REDIS_OPTIONAL=false to require it). */
  optional:
    process.env.NODE_ENV !== 'production' &&
    process.env.REDIS_OPTIONAL !== 'false',
}));
