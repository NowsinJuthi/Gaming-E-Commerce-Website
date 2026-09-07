import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { Public } from '../../common/decorators/public.decorator';
import { CacheService } from '../../shared/cache/cache.service';
import { isRedisOptional } from '../../shared/cache/redis-options';

/**
 * Unauthenticated probes for load balancers / orchestrators.
 * `GET /api/health`        -> liveness (process is up)
 * `GET /api/health/ready`  -> readiness (Mongo + Redis reachable, 503 if not)
 */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  liveness(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; db: boolean; redis: boolean }> {
    const redisOptional = isRedisOptional(this.config);
    const [db, redis] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);
    if (!db || (!redisOptional && !redis)) {
      throw new ServiceUnavailableException({ status: 'unavailable', db, redis });
    }
    return { status: 'ok', db, redis };
  }

  private async checkDb(): Promise<boolean> {
    try {
      if (this.connection.readyState !== 1) {
        return false;
      }
      await this.connection.db?.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.cache.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
