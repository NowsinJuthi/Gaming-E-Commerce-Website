import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivityLog,
  ActivityLogDocument,
} from '../database/schemas/activity-log.schema';
import {
  AuditLog,
  AuditLogDocument,
} from '../database/schemas/audit-log.schema';
import { CacheService } from '../shared/cache/cache.service';
import { PlaintextSecretsService } from '../shared/crypto/plaintext-secrets.service';
import { sumPlaintextCounts } from '../shared/crypto/plaintext-secrets';
import { AccessBlockService } from './access-block.service';
import { SecuritySettingsService } from './security-settings.service';

@Injectable()
export class SecurityAdminService {
  constructor(
    private readonly settings: SecuritySettingsService,
    private readonly blocks: AccessBlockService,
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(ActivityLog.name)
    private readonly activityModel: Model<ActivityLogDocument>,
    private readonly cache: CacheService,
    private readonly plaintextSecrets: PlaintextSecretsService,
  ) {}

  async overview(): Promise<{
    rateLimit: {
      enabled: boolean;
      limit: number;
      ttlMs: number;
      storage: string;
    };
    recaptcha: {
      enabled: boolean;
      configured: boolean;
      minScore: number;
    };
    cloudflare: {
      enabled: boolean;
      trustProxyHops: number;
      requireHeaders: boolean;
    };
    helmet: {
      enabled: boolean;
      protections: string[];
    };
    audit: {
      enabled: boolean;
      total: number;
      last24h: number;
      recaptchaFailures24h: number;
    };
    activity: {
      enabled: boolean;
      sampleRate: number;
      total: number;
      last24h: number;
    };
    accessBlocks: {
      ip: number;
      country: number;
      total: number;
    };
    optimization: {
      redisThrottle: boolean;
      estimatedMonthlyVisitors: string;
      recommendation: string;
    };
    encryption: {
      legacyPlaintext: {
        inventoryItems: number;
        orderDeliveredCodes: number;
        resellerOrderCodes: number;
        total: number;
      };
    };
  }> {
    const effective = await this.settings.getEffective();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      auditTotal,
      audit24h,
      recaptchaFails24h,
      activityTotal,
      activity24h,
      redisPing,
      blockCounts,
      legacyPlaintext,
    ] = await Promise.all([
      this.auditModel.countDocuments().exec(),
      this.auditModel.countDocuments({ createdAt: { $gte: since } }).exec(),
      this.auditModel
        .countDocuments({ action: 'recaptcha.failed', createdAt: { $gte: since } })
        .exec(),
      this.activityModel.countDocuments().exec(),
      this.activityModel.countDocuments({ createdAt: { $gte: since } }).exec(),
      this.cache.redis.ping().catch(() => null),
      this.blocks.counts(),
      this.plaintextSecrets.countLegacyPlaintext(),
    ]);

    const samplePct = Math.round(effective.activity.sampleRate * 100);

    return {
      rateLimit: {
        enabled: effective.throttle.enabled,
        limit: effective.throttle.limit,
        ttlMs: effective.throttle.ttlMs,
        storage: redisPing === 'PONG' ? 'redis' : 'memory-fallback',
      },
      recaptcha: {
        enabled: effective.recaptcha.enabled,
        configured: effective.recaptcha.configured,
        minScore: effective.recaptcha.minScore,
      },
      cloudflare: {
        enabled: effective.cloudflare.enabled,
        trustProxyHops: effective.cloudflare.trustProxyHops,
        requireHeaders: effective.cloudflare.requireHeaders,
      },
      helmet: {
        enabled: effective.helmet.enabled,
        protections: [
          'HSTS',
          'X-Content-Type-Options',
          'X-Frame-Options',
          'Referrer-Policy',
          'Cross-Origin-Resource-Policy',
        ],
      },
      audit: {
        enabled: effective.audit.enabled,
        total: auditTotal,
        last24h: audit24h,
        recaptchaFailures24h: recaptchaFails24h,
      },
      activity: {
        enabled: effective.activity.enabled,
        sampleRate: effective.activity.sampleRate,
        total: activityTotal,
        last24h: activity24h,
      },
      accessBlocks: blockCounts,
      optimization: {
        redisThrottle: redisPing === 'PONG',
        estimatedMonthlyVisitors: '400K+',
        recommendation:
          effective.activity.sampleRate < 1
            ? `Activity sampled at ${samplePct}% — good for high traffic.`
            : samplePct === 100 && activity24h > 50_000
              ? 'Consider lowering activity sample rate (e.g. 0.25) to reduce DB writes.'
              : 'Redis-backed rate limiting active — suitable for multi-instance deployment.',
      },
      encryption: {
        legacyPlaintext: {
          ...legacyPlaintext,
          total: sumPlaintextCounts(legacyPlaintext),
        },
      },
    };
  }
}
