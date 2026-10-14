import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../../shared/cache/redis.module';
import { LiveAnalyticsController } from './live-analytics.controller';
import { LiveAnalyticsGateway } from './live-analytics.gateway';
import { LiveAnalyticsService } from './live-analytics.service';

@Module({
  imports: [RedisModule, JwtModule.register({})],
  controllers: [LiveAnalyticsController],
  providers: [LiveAnalyticsService, LiveAnalyticsGateway],
  exports: [LiveAnalyticsService],
})
export class LiveAnalyticsModule {}
