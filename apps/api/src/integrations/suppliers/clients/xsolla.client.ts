import { Injectable } from '@nestjs/common';
import { SupplierCode } from '../../../common/enums';
import { SupplierConfig } from '../../../config/namespaces/suppliers.config';
import { BaseSupplierClient } from '../base-supplier.client';

/** Xsolla (game commerce). Uses HTTP Basic auth (merchantId:apiKey). */
@Injectable()
export class XsollaClient extends BaseSupplierClient {
  readonly code = SupplierCode.Xsolla;
  protected readonly cfgKey = 'xsolla';
  protected override readonly fulfillPath = '/v2/orders';
  protected override readonly balancePath = '/v2/balance';
  protected override readonly statusPath = '/v2/orders';

  protected override authHeaders(cfg: SupplierConfig): Record<string, string> {
    const token = Buffer.from(
      `${cfg.apiSecret ?? ''}:${cfg.apiKey ?? ''}`,
    ).toString('base64');
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${token}`,
    };
  }
}
