import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LicenseSettings,
  LicenseSettingsSchema,
} from '../../database/schemas/license-settings.schema';
import { CryptoModule } from '../../shared/crypto/crypto.module';
import { LicenseAdminController } from './license-admin.controller';
import { LicenseFeatureGuard } from './guards/license-feature.guard';
import { LicenseService } from './license.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LicenseSettings.name, schema: LicenseSettingsSchema },
    ]),
    CryptoModule,
  ],
  controllers: [LicenseAdminController],
  providers: [LicenseService, LicenseFeatureGuard],
  exports: [LicenseService, LicenseFeatureGuard],
})
export class LicenseModule {}
