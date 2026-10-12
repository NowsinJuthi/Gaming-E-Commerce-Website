import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentGateway } from '../../common/enums';
import { GatewayConfig } from '../../config/namespaces/payments.config';
import {
  PaymentGatewaySettingsDoc,
  PaymentSettings,
  PaymentSettingsDocument,
} from '../../database/schemas/payment-settings.schema';
import { isSandboxIntegrationsAllowed } from '../../common/utils/sandbox-integrations';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { resolvePaymentGatewayMode } from './payment-gateway-mode';
import {
  PAYMENT_GATEWAY_HINTS,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_GATEWAY_ORDER,
  PAYMENT_SETTINGS_KEY,
} from './payment-settings.constants';

const CACHE_MS = 30_000;

type EffectiveGateway = GatewayConfig & {
  enabled: boolean;
  sandbox: boolean;
  configured: boolean;
};

type EffectiveSettings = {
  defaultGateway: PaymentGateway;
  callbackBaseUrl: string;
  appUrl: string;
  gateways: Record<PaymentGateway, EffectiveGateway>;
};

export type PaymentGatewaySettingsView = {
  id: PaymentGateway;
  label: string;
  hint: string;
  enabled: boolean;
  sandbox: boolean;
  configured: boolean;
  mode: 'live' | 'sandbox' | 'disabled' | 'misconfigured';
  baseUrl?: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasWebhookSecret: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  apiKeyFromEnv: boolean;
  apiSecretFromEnv: boolean;
  webhookSecretFromEnv: boolean;
  usernameFromEnv: boolean;
  passwordFromEnv: boolean;
};

export type PaymentSettingsResponse = {
  defaultGateway: PaymentGateway;
  callbackBaseUrl: string;
  appUrl: string;
  gateways: PaymentGatewaySettingsView[];
  updatedAt?: Date;
};

@Injectable()
export class PaymentSettingsService implements OnModuleInit {
  private cache: { value: EffectiveSettings; expires: number } | null = null;

  constructor(
    @InjectModel(PaymentSettings.name)
    private readonly settingsModel: Model<PaymentSettingsDocument>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCache();
  }

  invalidateCache(): void {
    this.cache = null;
  }

  getGatewayConfig(cfgKey: string): GatewayConfig {
    const gateway = cfgKey as PaymentGateway;
    const entry = this.getEffectiveSync().gateways[gateway];
    if (!entry) {
      return this.config.get<GatewayConfig>(`payments.${cfgKey}`) ?? {};
    }
    return {
      baseUrl: entry.baseUrl,
      apiKey: entry.apiKey,
      apiSecret: entry.apiSecret,
      webhookSecret: entry.webhookSecret,
      username: entry.username,
      password: entry.password,
    };
  }

  isSandbox(cfgKey: string): boolean {
    if (!isSandboxIntegrationsAllowed()) {
      return false;
    }
    const gateway = cfgKey as PaymentGateway;
    const entry = this.getEffectiveSync().gateways[gateway];
    if (!entry?.enabled) return true;
    if (entry.sandbox) return true;
    return !entry.configured;
  }

  isEnabled(cfgKey: string): boolean {
    const gateway = cfgKey as PaymentGateway;
    return this.getEffectiveSync().gateways[gateway]?.enabled ?? true;
  }

  async getSettingsResponse(): Promise<PaymentSettingsResponse> {
    const doc = await this.getOrCreate();
    const effective = await this.getEffective();
    return {
      defaultGateway: effective.defaultGateway,
      callbackBaseUrl: effective.callbackBaseUrl,
      appUrl: effective.appUrl,
      gateways: PAYMENT_GATEWAY_ORDER.map((id) =>
        this.toGatewayView(id, doc[id], effective.gateways[id]),
      ),
      updatedAt: doc.updatedAt,
    };
  }

  async updateSettings(
    dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponse> {
    const doc = await this.getOrCreate();
    if (dto.defaultGateway) {
      doc.defaultGateway = dto.defaultGateway;
    }
    for (const id of PAYMENT_GATEWAY_ORDER) {
      const patch = dto[id];
      if (!patch) continue;
      const target = this.ensureGatewayDoc(doc, id);
      this.applyGatewayPatch(target, patch);
      doc.markModified(id);
    }
    await doc.save();
    this.invalidateCache();
    await this.refreshCache();
    return this.getSettingsResponse();
  }

  async getEffective(): Promise<EffectiveSettings> {
    if (this.cache && Date.now() < this.cache.expires) {
      return this.cache.value;
    }
    return this.refreshCache();
  }

  private getEffectiveSync(): EffectiveSettings {
    if (this.cache && Date.now() < this.cache.expires) {
      return this.cache.value;
    }
    void this.refreshCache();
    if (this.cache) return this.cache.value;
    return this.buildFromEnvOnly();
  }

  private async refreshCache(): Promise<EffectiveSettings> {
    const doc = await this.getOrCreate();
    const value = this.mergeDocument(doc);
    this.cache = { value, expires: Date.now() + CACHE_MS };
    return value;
  }

  private buildFromEnvOnly(): EffectiveSettings {
    const gateways = {} as Record<PaymentGateway, EffectiveGateway>;
    for (const id of PAYMENT_GATEWAY_ORDER) {
      gateways[id] = this.mergeGateway(id, undefined);
    }
    return {
      defaultGateway: PaymentGateway.UddoktaPay,
      callbackBaseUrl:
        this.config.get<string>('payments.callbackBaseUrl') ??
        'http://localhost:4000/api',
      appUrl:
        this.config.get<string>('payments.appUrl') ??
        'http://localhost:3000',
      gateways,
    };
  }

  private mergeDocument(doc: PaymentSettingsDocument): EffectiveSettings {
    const gateways = {} as Record<PaymentGateway, EffectiveGateway>;
    for (const id of PAYMENT_GATEWAY_ORDER) {
      gateways[id] = this.mergeGateway(id, doc[id]);
    }
    return {
      defaultGateway: doc.defaultGateway ?? PaymentGateway.UddoktaPay,
      callbackBaseUrl:
        this.config.get<string>('payments.callbackBaseUrl') ??
        'http://localhost:4000/api',
      appUrl:
        this.config.get<string>('payments.appUrl') ??
        'http://localhost:3000',
      gateways,
    };
  }

  private mergeGateway(
    id: PaymentGateway,
    stored: PaymentGatewaySettingsDoc | undefined,
  ): EffectiveGateway {
    const env = this.config.get<GatewayConfig>(`payments.${id}`) ?? {};
    const baseUrl = stored?.baseUrl?.trim() || env.baseUrl;
    const apiKey = stored?.apiKey?.trim() || env.apiKey;
    const apiSecret = stored?.apiSecret?.trim() || env.apiSecret;
    const webhookSecret = stored?.webhookSecret?.trim() || env.webhookSecret;
    const username = stored?.username?.trim() || env.username;
    const password = stored?.password?.trim() || env.password;
    const enabled = stored?.enabled ?? true;
    const sandbox = stored?.sandbox ?? false;
    const configured = Boolean(baseUrl && apiKey);
    return {
      enabled,
      sandbox,
      configured,
      baseUrl,
      apiKey,
      apiSecret,
      webhookSecret,
      username,
      password,
    };
  }

  private ensureGatewayDoc(
    doc: PaymentSettingsDocument,
    id: PaymentGateway,
  ): PaymentGatewaySettingsDoc {
    if (!doc[id]) {
      doc[id] = {} as PaymentGatewaySettingsDoc;
    }
    return doc[id];
  }

  private applyGatewayPatch(
    target: PaymentGatewaySettingsDoc,
    patch: NonNullable<UpdatePaymentSettingsDto[PaymentGateway]>,
  ): void {
    if (patch.enabled !== undefined) target.enabled = patch.enabled;
    if (patch.sandbox !== undefined) target.sandbox = patch.sandbox;
    if (patch.baseUrl !== undefined) target.baseUrl = patch.baseUrl.trim();
    if (patch.apiKey !== undefined && patch.apiKey.trim()) {
      target.apiKey = patch.apiKey.trim();
    }
    if (patch.apiSecret !== undefined && patch.apiSecret.trim()) {
      target.apiSecret = patch.apiSecret.trim();
    }
    if (patch.webhookSecret !== undefined && patch.webhookSecret.trim()) {
      target.webhookSecret = patch.webhookSecret.trim();
    }
    if (patch.username !== undefined && patch.username.trim()) {
      target.username = patch.username.trim();
    }
    if (patch.password !== undefined && patch.password.trim()) {
      target.password = patch.password.trim();
    }
  }

  private toGatewayView(
    id: PaymentGateway,
    stored: PaymentGatewaySettingsDoc,
    effective: EffectiveGateway,
  ): PaymentGatewaySettingsView {
    const env = this.config.get<GatewayConfig>(`payments.${id}`) ?? {};
    const mode: PaymentGatewaySettingsView['mode'] = resolvePaymentGatewayMode({
      enabled: effective.enabled,
      configured: effective.configured,
      sandbox: effective.sandbox,
      sandboxAllowed: isSandboxIntegrationsAllowed(),
    });
    return {
      id,
      label: PAYMENT_GATEWAY_LABELS[id],
      hint: PAYMENT_GATEWAY_HINTS[id],
      enabled: effective.enabled,
      sandbox: effective.sandbox,
      configured: effective.configured,
      mode,
      baseUrl: effective.baseUrl,
      hasApiKey: Boolean(effective.apiKey),
      hasApiSecret: Boolean(effective.apiSecret),
      hasWebhookSecret: Boolean(effective.webhookSecret),
      hasUsername: Boolean(effective.username),
      hasPassword: Boolean(effective.password),
      apiKeyFromEnv: Boolean(env.apiKey && !stored?.apiKey?.trim()),
      apiSecretFromEnv: Boolean(env.apiSecret && !stored?.apiSecret?.trim()),
      webhookSecretFromEnv: Boolean(
        env.webhookSecret && !stored?.webhookSecret?.trim(),
      ),
      usernameFromEnv: Boolean(env.username && !stored?.username?.trim()),
      passwordFromEnv: Boolean(env.password && !stored?.password?.trim()),
    };
  }

  private async getOrCreate(): Promise<PaymentSettingsDocument> {
    const doc = await this.settingsModel
      .findOneAndUpdate(
        { key: PAYMENT_SETTINGS_KEY },
        { $setOnInsert: { key: PAYMENT_SETTINGS_KEY } },
        { upsert: true, new: true },
      )
      .exec();
    if (!doc) {
      throw new Error('Failed to load payment settings');
    }
    return doc;
  }
}
