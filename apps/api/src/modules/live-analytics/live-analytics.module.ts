import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CatalogTitle,
  CatalogTitleSchema,
} from '../../database/schemas/catalog-title.schema';
import { RedisModule } from '../../shared/cache/redis.module';
import { LiveAnalyticsController } from './live-analytics.controller';
import { LiveAnalyticsGateway } from './live-analytics.gateway';
import { LiveAnalyticsService } from './live-analytics.service';

@Module({
  imports: [
    RedisModule,
    JwtModule.register({}),
    MongooseModule.forFeature([{ name: CatalogTitle.name, schema: CatalogTitleSchema }]),
  ],
  controllers: [LiveAnalyticsController],
  providers: [LiveAnalyticsService, LiveAnalyticsGateway],
  exports: [LiveAnalyticsService],
})
export class LiveAnalyticsModule {}
