import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PaymentSettings,
  PaymentSettingsSchema,
} from '../../database/schemas/payment-settings.schema';
import { PaymentSettingsService } from './payment-settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentSettings.name, schema: PaymentSettingsSchema },
    ]),
  ],
  providers: [PaymentSettingsService],
  exports: [PaymentSettingsService],
})
export class PaymentSettingsModule {}
