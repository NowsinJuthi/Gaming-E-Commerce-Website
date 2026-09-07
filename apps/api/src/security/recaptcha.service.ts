import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecaptchaConfig } from '../config/namespaces/security.config';
import { SecuritySettingsService } from './security-settings.service';

interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

export interface RecaptchaResult {
  success: boolean;
  score?: number;
  reason?: string;
}

const HTTP_TIMEOUT_MS = 8_000;

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly securitySettings: SecuritySettingsService,
  ) {}

  private envCfg(): RecaptchaConfig {
    return this.config.getOrThrow<RecaptchaConfig>('security.recaptcha');
  }

  /** True when admin + secret are configured; otherwise verification is skipped. */
  async isEnabled(): Promise<boolean> {
    const effective = await this.securitySettings.getEffective();
    return effective.recaptcha.enabled && Boolean(effective.recaptcha.secret);
  }

  async verify(
    token: string | undefined,
    remoteIp?: string,
  ): Promise<RecaptchaResult> {
    const effective = await this.securitySettings.getEffective();
    const envCfg = this.envCfg();
    const secret = effective.recaptcha.secret;
    const minScore = effective.recaptcha.minScore ?? envCfg.minScore;

    if (!effective.recaptcha.enabled || !secret) {
      return { success: true }; // disabled or not configured → allow (dev/sandbox)
    }
    if (!token) {
      return { success: false, reason: 'missing_token' };
    }

    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(envCfg.verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal,
      });
      const json = (await res.json()) as RecaptchaVerifyResponse;
      if (!json.success) {
        return {
          success: false,
          score: json.score,
          reason: (json['error-codes'] ?? []).join(',') || 'verification_failed',
        };
      }
      if (typeof json.score === 'number' && json.score < minScore) {
        return { success: false, score: json.score, reason: 'low_score' };
      }
      return { success: true, score: json.score };
    } catch (error) {
      this.logger.warn(
        `reCAPTCHA verification error: ${(error as Error).message}`,
      );
      return { success: false, reason: 'verification_error' };
    } finally {
      clearTimeout(timer);
    }
  }
}
