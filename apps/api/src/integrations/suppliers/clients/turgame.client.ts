import { Injectable } from '@nestjs/common';
import { SupplierCode } from '../../../common/enums';
import { BaseSupplierClient } from '../base-supplier.client';

/** Turgame (game keys / top-ups). */
@Injectable()
export class TurgameClient extends BaseSupplierClient {
  readonly code = SupplierCode.Turgame;
  protected readonly cfgKey = 'turgame';
  protected override readonly fulfillPath = '/api/order/create';
  protected override readonly balancePath = '/api/balance';
  protected override readonly statusPath = '/api/order';
}
