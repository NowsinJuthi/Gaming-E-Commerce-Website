import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  AccessBlock,
  AccessBlockSchema,
} from '../database/schemas/access-block.schema';
import {
  AuditLog,
  AuditLogSchema,
} from '../database/schemas/audit-log.schema';
import {
  ActivityLog,
  ActivityLogSchema,
} from '../database/schemas/activity-log.schema';
import {
  SecuritySettings,
  SecuritySettingsSchema,
} from '../database/schemas/security-settings.schema';
import { ThrottleConfig } from '../config/namespaces/security.config';
import { AuditModule } from '../shared/audit/audit.module';
import { CacheService } from '../shared/cache/cache.service';
import { AccessBlockGuard } from './access-block.guard';
import { AccessBlockService } from './access-block.service';
import { ActivityInterceptor } from './activity.interceptor';
import { ActivityService } from './activity.service';
import { CloudflareGuard } from './cloudflare.guard';
import { RecaptchaGuard } from './recaptcha.guard';
import { RecaptchaService } from './recaptcha.service';
import { SecurityAdminController } from './security-admin.controller';
import { SecurityAdminService } from './security-admin.service';
import { SecurityController } from './security.controller';
import { SecuritySettingsService } from './security-settings.service';
import { AppThrottlerGuard } from './throttler/app-throttler.guard';
import { RedisThrottlerStorage } from './throttler/redis-throttler.storage';

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: AccessBlock.name, schema: AccessBlockSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: SecuritySettings.name, schema: SecuritySettingsSchema },
    ]),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, CacheService],
      useFactory: (config: ConfigService, cache: CacheService) => {
        const cfg = config.getOrThrow<ThrottleConfig>('security.throttle');
        const isProduction = config.get<string>('app.env') === 'production';
        return {
          throttlers: [
            {
              name: 'default',
              ttl: cfg.ttlMs,
              limit: cfg.limit,
              blockDuration: cfg.blockMs,
            },
          ],
          // Dev without Redis: in-memory throttler avoids hung API requests.
          ...(isProduction
            ? { storage: new RedisThrottlerStorage(cache) }
            : {}),
        };
      },
    }),
  ],
  controllers: [SecurityController, SecurityAdminController],
  providers: [
    AccessBlockService,
    SecuritySettingsService,
    SecurityAdminService,
    RecaptchaService,
    RecaptchaGuard,
    ActivityService,
    { provide: APP_GUARD, useClass: AccessBlockGuard },
    { provide: APP_GUARD, useClass: CloudflareGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
  ],
  exports: [
    AccessBlockService,
    RecaptchaService,
    RecaptchaGuard,
    ActivityService,
    SecuritySettingsService,
  ],
})
export class SecurityModule {}
