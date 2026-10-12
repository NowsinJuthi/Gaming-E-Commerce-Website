import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { Public } from '../../common/decorators/public.decorator';
import { CacheService } from '../../shared/cache/cache.service';
import { isRedisOptional } from '../../shared/cache/redis-options';
import { isProductionNodeEnv } from '../../config/production-env';
import { PaymentInvariantService } from '../payments/payment-invariant.service';
import {
  publicLivenessBody,
  publicReadinessOkBody,
  publicReadinessRequiresPayments,
  publicReadinessUnavailableBody,
  type PublicHealthBody,
} from './health-public';

/**
 * Unauthenticated probes for load balancers / orchestrators.
 * `GET /api/health`        -> liveness (process is up)
 * `GET /api/health/ready`  -> readiness (Mongo + Redis + payment index in production)
 */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    private readonly payments: PaymentInvariantService,
  ) {}

  @Get()
  liveness(): PublicHealthBody {
    return publicLivenessBody();
  }

  @Get('ready')
  async readiness(): Promise<PublicHealthBody> {
    const redisOptional = isRedisOptional(this.config);
    const [db, redis] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);
    const production = isProductionNodeEnv(
      this.config.get<string>('app.env') ?? process.env.NODE_ENV,
    );
    const paymentsReady = publicReadinessRequiresPayments({
      production,
      paymentsReady: this.payments.isReady(),
    });
    if (!db || (!redisOptional && !redis) || !paymentsReady) {
      throw new ServiceUnavailableException(publicReadinessUnavailableBody());
    }
    return publicReadinessOkBody();
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
