import { Injectable } from '@nestjs/common';
import { SupplierCode } from '../../../common/enums';
import { BaseSupplierClient } from '../base-supplier.client';

/** FoxReload (reloads / vouchers). */
@Injectable()
export class FoxReloadClient extends BaseSupplierClient {
  readonly code = SupplierCode.FoxReload;
  protected readonly cfgKey = 'foxreload';
  protected override readonly fulfillPath = '/api/v1/purchase';
  protected override readonly balancePath = '/api/v1/balance';
  protected override readonly statusPath = '/api/v1/purchase';
}
