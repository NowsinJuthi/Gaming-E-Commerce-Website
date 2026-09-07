import { Module } from '@nestjs/common';
import { FoxReloadClient } from './clients/foxreload.client';
import { ReloadlyClient } from './clients/reloadly.client';
import { TurgameClient } from './clients/turgame.client';
import { XsollaClient } from './clients/xsolla.client';
import { SupplierRegistry } from './supplier.registry';

/** Provides every supplier adapter behind a single registry. */
@Module({
  providers: [
    ReloadlyClient,
    XsollaClient,
    TurgameClient,
    FoxReloadClient,
    SupplierRegistry,
  ],
  exports: [SupplierRegistry],
})
export class SuppliersIntegrationModule {}
