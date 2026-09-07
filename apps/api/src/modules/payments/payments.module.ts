import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PaymentIntent,
  PaymentIntentSchema,
} from '../../database/schemas/payment-intent.schema';
import { MfsModule } from '../mfs/mfs.module';
import { PaymentsIntegrationModule } from '../../integrations/payments/payments-integration.module';
import { PAYMENTS_QUEUE } from '../../queues/queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentAdminController } from './payment-admin.controller';
import { PaymentAdminService } from './payment-admin.service';
import { PaymentController } from './payment.controller';
import { PaymentProcessor } from './payment.processor';
import { PaymentSettingsModule } from './payment-settings.module';
import { PaymentService } from './payment.service';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentIntent.name, schema: PaymentIntentSchema },
    ]),
    BullModule.registerQueue({ name: PAYMENTS_QUEUE }),
    PaymentSettingsModule,
    LicenseModule,
    forwardRef(() => MfsModule),
    PaymentsIntegrationModule,
    NotificationsModule,
    OrdersModule,
    WalletModule,
  ],
  controllers: [PaymentController, PaymentAdminController],
  providers: [PaymentService, PaymentProcessor, PaymentAdminService],
  exports: [PaymentService, PaymentSettingsModule],
})
export class PaymentsModule {}
