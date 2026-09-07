import { Injectable } from '@nestjs/common';
import { SupplierCode } from '../../../common/enums';
import { BaseSupplierClient } from '../base-supplier.client';

/**
 * Reloadly (airtime / gift cards). Production uses an OAuth client-credentials
 * token; the access token is sent as `Authorization: Bearer`.
 */
@Injectable()
export class ReloadlyClient extends BaseSupplierClient {
  readonly code = SupplierCode.Reloadly;
  protected readonly cfgKey = 'reloadly';
  protected override readonly fulfillPath = '/orders';
  protected override readonly balancePath = '/accounts/balance';
  protected override readonly statusPath = '/orders';
}
