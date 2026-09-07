import { BadRequestException, Injectable } from '@nestjs/common';
import { SupplierCode } from '../../common/enums';
import { FoxReloadClient } from './clients/foxreload.client';
import { ReloadlyClient } from './clients/reloadly.client';
import { TurgameClient } from './clients/turgame.client';
import { XsollaClient } from './clients/xsolla.client';
import { SupplierClient } from './supplier-client.interface';

/** Resolves a normalized supplier client from a {@link SupplierCode}. */
@Injectable()
export class SupplierRegistry {
  private readonly clients: Map<SupplierCode, SupplierClient>;

  constructor(
    reloadly: ReloadlyClient,
    xsolla: XsollaClient,
    turgame: TurgameClient,
    foxreload: FoxReloadClient,
  ) {
    this.clients = new Map(
      [reloadly, xsolla, turgame, foxreload].map((client) => [
        client.code,
        client,
      ]),
    );
  }

  get(code: SupplierCode): SupplierClient {
    const client = this.clients.get(code);
    if (!client) {
      throw new BadRequestException(`Unsupported supplier: ${code}`);
    }
    return client;
  }
}
