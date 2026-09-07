import { DEFAULT_CURRENCY } from '@uniqbd/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { SupplierCode } from '../../common/enums';
import { SupplierConfig } from '../../config/namespaces/suppliers.config';
import {
  DeliveredCode,
  SupplierBalance,
  SupplierClient,
  SupplierFulfillInput,
  SupplierFulfillResult,
  SupplierFulfillStatus,
} from './supplier-client.interface';

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

const HTTP_TIMEOUT_MS = 20_000;

/**
 * Shared supplier-adapter behavior: HTTP, config resolution, status mapping,
 * code extraction, and a sandbox mode that synthesizes codes when credentials
 * are absent. Concrete suppliers override endpoints / auth / mappings.
 */
@Injectable()
export abstract class BaseSupplierClient implements SupplierClient {
  abstract readonly code: SupplierCode;
  protected abstract readonly cfgKey: string;
  protected readonly fulfillPath: string = '/orders';
  protected readonly balancePath: string = '/balance';
  protected readonly statusPath: string = '/orders';
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly configService: ConfigService) {}

  protected config(): SupplierConfig {
    return (
      this.configService.get<SupplierConfig>(`suppliers.${this.cfgKey}`) ?? {}
    );
  }

  protected isConfigured(cfg: SupplierConfig = this.config()): boolean {
    return Boolean(cfg.baseUrl && (cfg.apiKey || cfg.clientId));
  }

  protected authHeaders(cfg: SupplierConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${cfg.apiKey ?? cfg.clientSecret ?? ''}`,
    };
  }

  async getBalance(): Promise<SupplierBalance> {
    const cfg = this.config();
    if (!this.isConfigured(cfg)) {
      return {
        balance: Number.POSITIVE_INFINITY,
        currency: DEFAULT_CURRENCY,
      };
    }
    const json = await this.httpJson(`${cfg.baseUrl}${this.balancePath}`, {
      method: 'GET',
      headers: this.authHeaders(cfg),
    });
    return {
      balance: asNumber(json.balance) ?? 0,
      currency:
        firstString(json, ['currency', 'currencyCode']) ?? DEFAULT_CURRENCY,
      raw: json,
    };
  }

  async fulfill(input: SupplierFulfillInput): Promise<SupplierFulfillResult> {
    const cfg = this.config();
    if (!this.isConfigured(cfg)) {
      return this.sandboxFulfill(input);
    }
    const json = await this.httpJson(`${cfg.baseUrl}${this.fulfillPath}`, {
      method: 'POST',
      headers: this.authHeaders(cfg),
      body: JSON.stringify(this.buildFulfillBody(input)),
    });
    return this.parseFulfill(json);
  }

  async checkStatus(externalOrderId: string): Promise<SupplierFulfillResult> {
    const cfg = this.config();
    if (!this.isConfigured(cfg)) {
      return { status: 'success', externalOrderId };
    }
    const json = await this.httpJson(
      `${cfg.baseUrl}${this.statusPath}/${externalOrderId}`,
      { method: 'GET', headers: this.authHeaders(cfg) },
    );
    return this.parseFulfill(json);
  }

  // --- Overridable hooks ---

  protected buildFulfillBody(input: SupplierFulfillInput): Json {
    return {
      productId: input.externalProductId,
      quantity: input.quantity,
      reference: input.reference,
      region: input.region,
      amount: input.amount,
      recipient: input.recipient,
      ...input.params,
    };
  }

  protected mapStatus(value: string | undefined): SupplierFulfillStatus {
    const v = (value ?? '').toLowerCase();
    if (
      ['success', 'successful', 'completed', 'delivered', 'fulfilled'].includes(
        v,
      )
    ) {
      return 'success';
    }
    if (['failed', 'failure', 'cancelled', 'declined', 'error'].includes(v)) {
      return 'failed';
    }
    return 'pending';
  }

  protected parseFulfill(json: Json): SupplierFulfillResult {
    const status = this.mapStatus(
      firstString(json, ['status', 'transactionStatus', 'state']),
    );
    return {
      status,
      externalOrderId: firstString(json, [
        'id',
        'orderId',
        'transactionId',
        'transaction_id',
        'reference',
      ]),
      codes: this.extractCodes(json),
      cost: asNumber(json.cost ?? json.amount ?? json.price),
      currency: firstString(json, ['currency', 'currencyCode']),
      message: firstString(json, ['message', 'error', 'detail']),
      raw: json,
    };
  }

  protected extractCodes(json: Json): DeliveredCode[] {
    const containers = [json.codes, json.cards, json.pins, json.vouchers];
    const out: DeliveredCode[] = [];
    for (const container of containers) {
      if (!Array.isArray(container)) continue;
      for (const entry of container) {
        if (typeof entry === 'string') {
          out.push({ code: entry });
        } else if (entry && typeof entry === 'object') {
          const obj = entry as Json;
          const code = firstString(obj, ['code', 'cardNumber', 'pin', 'serial']);
          if (code) {
            out.push({
              code,
              serial: firstString(obj, ['serial', 'serialNumber']),
              pin: firstString(obj, ['pin', 'pinCode']),
            });
          }
        }
      }
    }
    return out;
  }

  // --- Internals ---

  protected sandboxFulfill(input: SupplierFulfillInput): SupplierFulfillResult {
    const codes: DeliveredCode[] = Array.from(
      { length: Math.max(1, input.quantity) },
      () => ({
        code: `${this.code.toUpperCase()}-${randomBytes(6)
          .toString('hex')
          .toUpperCase()}`,
      }),
    );
    this.logger.warn(
      `${this.code} not configured — issuing sandbox fulfillment for ${input.externalProductId}`,
    );
    return {
      status: 'success',
      externalOrderId: `sandbox_${this.code}_${input.reference}`,
      codes,
      currency: DEFAULT_CURRENCY,
      raw: { sandbox: true },
    };
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
          `Supplier ${this.code} HTTP ${res.status}: ${text.slice(0, 500)}`,
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
