import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  isSandboxIntegrationsAllowed,
  requireConfiguredOrSandbox,
} from '../../common/utils/sandbox-integrations';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentGateway } from '../../common/enums';
import { GatewayConfig } from '../../config/namespaces/payments.config';
import { PaymentSettingsService } from '../../modules/payments/payment-settings.service';
import {
  CreateChargeInput,
  CreateChargeResult,
  NormalizedPaymentStatus,
  PaymentGatewayClient,
  RefundChargeInput,
  RefundChargeResult,
  VerifyResult,
  WebhookParseResult,
} from './payment-gateway.interface';
import {
  gatewayRefundPath,
  isConfirmedGatewayRefund,
} from '../../modules/payments/payment-gateway-refund';

type Json = Record<string, unknown>;

const asString = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return undefined;
};

const asNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
};

const firstString = (obj: Json, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value !== undefined) return value;
  }
  return undefined;
};

const HTTP_TIMEOUT_MS = 15_000;

/**
 * Shared adapter behavior. Concrete gateways override config key, endpoint
 * paths, auth headers, and status mapping. When credentials are absent the
 * adapter degrades to a deterministic sandbox flow only when
 * ALLOW_SANDBOX_INTEGRATIONS=true outside production. Production fail-closes.
 */
@Injectable()
export abstract class BasePaymentGateway implements PaymentGatewayClient {
  abstract readonly gateway: PaymentGateway;
  protected abstract readonly cfgKey: string;
  protected readonly createPath: string = '/create';
  protected readonly verifyPath: string = '/verify';
  protected readonly refundPath: string | null = null;
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly configService: ConfigService,
    @Optional()
    protected readonly paymentSettings?: PaymentSettingsService,
  ) {}

  protected config(): GatewayConfig {
    if (this.paymentSettings) {
      return this.paymentSettings.getGatewayConfig(this.cfgKey);
    }
    return (
      this.configService.get<GatewayConfig>(`payments.${this.cfgKey}`) ?? {}
    );
  }

  protected isConfigured(cfg: GatewayConfig = this.config()): boolean {
    if (this.paymentSettings?.isSandbox(this.cfgKey)) {
      return false;
    }
    return Boolean(cfg.baseUrl && cfg.apiKey);
  }

  protected authHeaders(cfg: GatewayConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey ?? ''}`,
    };
  }

  protected mapStatus(value: string | undefined): NormalizedPaymentStatus {
    const v = (value ?? '').toLowerCase();
    if (
      ['completed', 'complete', 'success', 'succeeded', 'paid', 'approved'].includes(
        v,
      )
    ) {
      return 'succeeded';
    }
    if (
      ['failed', 'failure', 'cancelled', 'canceled', 'declined', 'error'].includes(
        v,
      )
    ) {
      return 'failed';
    }
    return 'pending';
  }

  protected callbackUrl(): string {
    const base =
      this.configService.get<string>('payments.callbackBaseUrl') ??
      'http://localhost:4000/api';
    return `${base}/payments/webhooks/${this.gateway}`;
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const cfg = this.config();
    if (!this.isConfigured(cfg)) {
      requireConfiguredOrSandbox(false, this.gateway);
      return this.sandboxCharge(input);
    }
    const body = this.buildCreateBody(input);
    const json = await this.httpJson(`${cfg.baseUrl}${this.createPath}`, {
      method: 'POST',
      headers: this.authHeaders(cfg),
      body: JSON.stringify(body),
    });
    const gatewayRef =
      firstString(json, [
        'id',
        'transactionId',
        'paymentID',
        'payment_id',
        'invoice_id',
        'invoiceId',
        'reference',
      ]) ?? input.reference;
    const checkoutUrl = firstString(json, [
      'url',
      'checkoutUrl',
      'paymentUrl',
      'payment_url',
      'bkashURL',
      'GatewayPageURL',
    ]);
    return { gatewayRef, checkoutUrl, raw: json };
  }

  async verify(gatewayRef: string): Promise<VerifyResult> {
    const cfg = this.config();
    if (!this.isConfigured(cfg)) {
      // Sandbox intents settle only via the manual/webhook path.
      return { status: 'pending' };
    }
    const json = await this.httpJson(`${cfg.baseUrl}${this.verifyPath}`, {
      method: 'POST',
      headers: this.authHeaders(cfg),
      body: JSON.stringify(this.buildVerifyBody(gatewayRef)),
    });
    return {
      status: this.mapStatus(
        firstString(json, ['status', 'transactionStatus', 'paymentStatus']),
      ),
      amount: asNumber(json.amount),
      raw: json,
    };
  }

  async refundCharge(input: RefundChargeInput): Promise<RefundChargeResult> {
    const path = this.refundPath ?? gatewayRefundPath(this.gateway);
    if (!path) {
      return { supported: false };
    }
    const cfg = this.config();
    if (!this.isConfigured(cfg)) {
      if (isSandboxIntegrationsAllowed()) {
        return {
          supported: true,
          ok: true,
          refundRef: `sandbox-void:${input.gatewayRef}`,
        };
      }
      return { supported: false };
    }
    try {
      const json = await this.httpJson(`${cfg.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          ...this.authHeaders(cfg),
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify(this.buildRefundBody(input)),
      });
      const rawStatus = firstString(json, [
        'status',
        'refundStatus',
        'transactionStatus',
      ]);
      if (!isConfirmedGatewayRefund(rawStatus) && !isConfirmedGatewayRefund(this.mapStatus(rawStatus))) {
        return {
          supported: true,
          ok: false,
          error: 'Gateway did not confirm refund',
          raw: json,
        };
      }
      return {
        supported: true,
        ok: true,
        refundRef:
          firstString(json, ['id', 'refundId', 'refund_id', 'reference']) ??
          input.idempotencyKey,
        raw: json,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/\bHTTP 404\b|\bHTTP 405\b/.test(message)) {
        return { supported: false };
      }
      return { supported: true, ok: false, error: message };
    }
  }

  parseWebhook(
    payload: unknown,
    signature: string | undefined,
    rawBody?: Buffer,
  ): WebhookParseResult {
    const raw = rawBody?.toString('utf8') ?? JSON.stringify(payload ?? {});
    const data: Json =
      payload && typeof payload === 'object' ? (payload as Json) : {};
    const gatewayRef =
      firstString(data, [
        'id',
        'transactionId',
        'paymentID',
        'payment_id',
        'invoice_id',
        'invoiceId',
        'reference',
        'merchantInvoiceNumber',
      ]) ?? '';
    return {
      gatewayRef,
      status: this.mapStatus(
        firstString(data, ['status', 'transactionStatus', 'paymentStatus']),
      ),
      amount: asNumber(data.amount),
      signatureValid: this.verifySignature(raw, signature),
      raw: data,
    };
  }

  // --- Overridable hooks ---

  protected buildCreateBody(input: CreateChargeInput): Json {
    return {
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      callbackUrl: this.callbackUrl(),
      customer: input.customer,
      metadata: input.metadata,
    };
  }

  protected buildVerifyBody(gatewayRef: string): Json {
    return { reference: gatewayRef, id: gatewayRef };
  }

  protected buildRefundBody(input: RefundChargeInput): Json {
    return {
      reference: input.gatewayRef,
      id: input.gatewayRef,
      amount: input.amount,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
    };
  }

  // --- Internals ---

  protected verifySignature(raw: string, signature?: string): boolean {
    const secret = this.config().webhookSecret;
    if (!secret) {
      // Fail CLOSED in production: an unsigned webhook must never be allowed to
      // settle a payment when no secret is configured. Only the sandbox/dev
      // flow accepts unsigned webhooks for convenience.
      if (!isSandboxIntegrationsAllowed()) {
        this.logger.error(
          `${this.gateway} webhook secret is not configured — rejecting webhook`,
        );
        return false;
      }
      return true;
    }
    if (!signature) {
      return false;
    }
    const digest = createHmac('sha256', secret).update(raw).digest('hex');
    const expected = Buffer.from(digest);
    const received = Buffer.from(signature);
    return (
      expected.length === received.length &&
      timingSafeEqual(expected, received)
    );
  }

  protected sandboxCharge(input: CreateChargeInput): CreateChargeResult {
    const gatewayRef = `${this.gateway}_${input.reference}`;
    const base =
      this.configService.get<string>('payments.callbackBaseUrl') ??
      'http://localhost:4000/api';
    const checkoutUrl = `${base}/payments/sandbox/${this.gateway}/${input.reference}`;
    this.logger.warn(
      `${this.gateway} not configured — issuing sandbox charge ${gatewayRef}`,
    );
    return { gatewayRef, checkoutUrl, raw: { sandbox: true } };
  }

  protected async httpJson(
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ): Promise<Json> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `Gateway ${this.gateway} HTTP ${res.status}: ${text.slice(0, 500)}`,
        );
      }
      if (!text) {
        return {};
      }
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? (parsed as Json) : {};
    } finally {
      clearTimeout(timer);
    }
  }
}
