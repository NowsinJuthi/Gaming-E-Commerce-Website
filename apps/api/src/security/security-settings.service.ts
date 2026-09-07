import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivityConfig,
  CloudflareConfig,
  RecaptchaConfig,
  ThrottleConfig,
} from '../config/namespaces/security.config';
import {
  SecuritySettings,
  SecuritySettingsDocument,
} from '../database/schemas/security-settings.schema';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';

const SETTINGS_KEY = 'global';
const CACHE_MS = 30_000;

export interface EffectiveSecurityConfig {
  throttle: {
    enabled: boolean;
    limit: number;
    ttlMs: number;
    blockMs: number;
    registerLimit: number;
    loginLimit: number;
    otpLimit: number;
    authTtlMs: number;
  };
  recaptcha: {
    enabled: boolean;
    siteKey?: string;
    secret?: string;
    minScore: number;
    configured: boolean;
  };
  cloudflare: {
    enabled: boolean;
    trustProxyHops: number;
    requireHeaders: boolean;
  };
  activity: {
    enabled: boolean;
    retentionDays: number;
    sampleRate: number;
  };
  helmet: {
    enabled: boolean;
    hstsMaxAgeSeconds: number;
  };
  audit: {
    enabled: boolean;
  };
}

export interface SecuritySettingsResponse {
  throttle: EffectiveSecurityConfig['throttle'];
  recaptcha: Omit<EffectiveSecurityConfig['recaptcha'], 'secret'> & {
    hasSecret: boolean;
    secretFromEnv: boolean;
  };
  cloudflare: EffectiveSecurityConfig['cloudflare'];
  activity: EffectiveSecurityConfig['activity'];
  helmet: EffectiveSecurityConfig['helmet'];
  audit: EffectiveSecurityConfig['audit'];
  updatedAt?: Date;
}

@Injectable()
export class SecuritySettingsService {
  private cache: { value: EffectiveSecurityConfig; expires: number } | null =
    null;

  constructor(
    @InjectModel(SecuritySettings.name)
    private readonly settingsModel: Model<SecuritySettingsDocument>,
    private readonly config: ConfigService,
  ) {}

  invalidateCache(): void {
    this.cache = null;
  }

  async getEffective(): Promise<EffectiveSecurityConfig> {
    if (this.cache && Date.now() < this.cache.expires) {
      return this.cache.value;
    }
    const doc = await this.getOrCreate();
    const merged = this.merge(doc);
    this.cache = { value: merged, expires: Date.now() + CACHE_MS };
    return merged;
  }

  async getSettingsResponse(): Promise<SecuritySettingsResponse> {
    const doc = await this.getOrCreate();
    const effective = this.merge(doc);
    const envSecret = this.config.get<RecaptchaConfig>(
      'security.recaptcha',
    )?.secret;

    return {
      throttle: effective.throttle,
      recaptcha: {
        enabled: effective.recaptcha.enabled,
        siteKey: effective.recaptcha.siteKey,
        minScore: effective.recaptcha.minScore,
        configured: effective.recaptcha.configured,
        hasSecret: Boolean(effective.recaptcha.secret),
        secretFromEnv: Boolean(envSecret),
      },
      cloudflare: effective.cloudflare,
      activity: effective.activity,
      helmet: effective.helmet,
      audit: effective.audit,
      updatedAt: doc.updatedAt,
    };
  }

  async updateSettings(
    dto: UpdateSecuritySettingsDto,
  ): Promise<SecuritySettingsResponse> {
    const doc = await this.getOrCreate();
    if (dto.throttle) {
      Object.assign(doc.throttle, dto.throttle);
    }
    if (dto.recaptcha) {
      const { secretKey, ...rest } = dto.recaptcha;
      Object.assign(doc.recaptcha, rest);
      if (secretKey !== undefined && secretKey.trim()) {
        doc.recaptcha.secretKey = secretKey.trim();
      }
    }
    if (dto.cloudflare) {
      Object.assign(doc.cloudflare, dto.cloudflare);
    }
    if (dto.activity) {
      Object.assign(doc.activity, dto.activity);
    }
    if (dto.helmet) {
      Object.assign(doc.helmet, dto.helmet);
    }
    if (dto.audit) {
      Object.assign(doc.audit, dto.audit);
    }
    await doc.save();
    this.invalidateCache();
    return this.getSettingsResponse();
  }

  async getPublicRecaptcha(): Promise<{ enabled: boolean; siteKey?: string }> {
    const effective = await this.getEffective();
    if (!effective.recaptcha.enabled || !effective.recaptcha.configured) {
      return { enabled: false };
    }
    return {
      enabled: true,
      siteKey: effective.recaptcha.siteKey,
    };
  }

  private async getOrCreate(): Promise<SecuritySettingsDocument> {
    const doc = await this.settingsModel
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $setOnInsert: { key: SETTINGS_KEY } },
        { upsert: true, new: true },
      )
      .select('+recaptcha.secretKey')
      .exec();
    if (!doc) {
      throw new Error('Failed to load security settings');
    }
    return doc;
  }

  private merge(doc: SecuritySettingsDocument): EffectiveSecurityConfig {
    const envThrottle = this.config.getOrThrow<ThrottleConfig>(
      'security.throttle',
    );
    const envRecaptcha = this.config.getOrThrow<RecaptchaConfig>(
      'security.recaptcha',
    );
    const envCloudflare = this.config.getOrThrow<CloudflareConfig>(
      'security.cloudflare',
    );
    const envActivity = this.config.getOrThrow<ActivityConfig>(
      'security.activity',
    );

    const secret =
      envRecaptcha.secret?.trim() || doc.recaptcha.secretKey?.trim();
    const siteKey =
      doc.recaptcha.siteKey?.trim() ||
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ||
      process.env.RECAPTCHA_SITE_KEY?.trim();

    const recaptchaEnabled = doc.recaptcha.enabled && Boolean(secret);

    return {
      throttle: {
        enabled: doc.throttle.enabled ?? true,
        limit: doc.throttle.limit ?? envThrottle.limit,
        ttlMs: doc.throttle.ttlMs ?? envThrottle.ttlMs,
        blockMs: doc.throttle.blockMs ?? envThrottle.blockMs,
        registerLimit: doc.throttle.registerLimit ?? 5,
        loginLimit: doc.throttle.loginLimit ?? envThrottle.authLimit,
        otpLimit: doc.throttle.otpLimit ?? 3,
        authTtlMs: doc.throttle.authTtlMs ?? envThrottle.authTtlMs,
      },
      recaptcha: {
        enabled: recaptchaEnabled,
        siteKey,
        secret,
        minScore: doc.recaptcha.minScore ?? envRecaptcha.minScore,
        configured: Boolean(secret && siteKey),
      },
      cloudflare: {
        enabled: doc.cloudflare.enabled ?? true,
        trustProxyHops:
          doc.cloudflare.trustProxyHops ?? envCloudflare.trustProxyHops,
        requireHeaders: doc.cloudflare.requireHeaders ?? false,
      },
      activity: {
        enabled: doc.activity.enabled ?? envActivity.enabled,
        retentionDays:
          doc.activity.retentionDays ?? envActivity.retentionDays,
        sampleRate: doc.activity.sampleRate ?? 1,
      },
      helmet: {
        enabled: doc.helmet.enabled ?? true,
        hstsMaxAgeSeconds: doc.helmet.hstsMaxAgeSeconds ?? 15_552_000,
      },
      audit: {
        enabled: doc.audit.enabled ?? true,
      },
    };
  }
}
