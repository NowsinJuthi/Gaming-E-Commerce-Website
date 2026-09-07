import { SupplierCode } from '../../common/enums';

export type SupplierFulfillStatus = 'success' | 'pending' | 'failed';

export interface DeliveredCode {
  code: string;
  serial?: string;
  pin?: string;
  meta?: Record<string, unknown>;
}

export interface SupplierFulfillInput {
  /** Provider-side product/SKU id from the offering mapping. */
  externalProductId: string;
  quantity: number;
  /** Our SupplierOrder id; echoed to the provider for traceability. */
  reference: string;
  region?: string;
  /** Face value for variable-denomination products. */
  amount?: number;
  recipient?: { phone?: string; email?: string };
  params?: Record<string, unknown>;
}

export interface SupplierFulfillResult {
  status: SupplierFulfillStatus;
  externalOrderId?: string;
  codes?: DeliveredCode[];
  cost?: number;
  currency?: string;
  message?: string;
  raw?: unknown;
}

export interface SupplierBalance {
  balance: number;
  currency: string;
  raw?: unknown;
}

/**
 * Abstraction layer: every upstream supplier is normalized behind this
 * interface so routing/failover logic never depends on a vendor's API shape.
 */
export interface SupplierClient {
  readonly code: SupplierCode;
  getBalance(): Promise<SupplierBalance>;
  fulfill(input: SupplierFulfillInput): Promise<SupplierFulfillResult>;
  checkStatus(externalOrderId: string): Promise<SupplierFulfillResult>;
}
