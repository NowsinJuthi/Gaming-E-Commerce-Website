import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MfsGateway,
  MfsGatewaySchema,
} from '../../database/schemas/mfs-gateway.schema';
import {
  Order,
  OrderSchema,
} from '../../database/schemas/order.schema';
import {
  User,
  UserSchema,
} from '../../database/schemas/user.schema';
import {
  PaymentIntent,
  PaymentIntentSchema,
} from '../../database/schemas/payment-intent.schema';
import {
  SmsLog,
  SmsLogSchema,
} from '../../database/schemas/sms-log.schema';
import {
  MfsSmsFormatSettings,
  MfsSmsFormatSettingsSchema,
} from '../../database/schemas/mfs-sms-format.schema';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MfsAdminController, MfsPaymentController } from './mfs.controller';
import { MfsAppCompatController } from './mfs-app.controller';
import { MfsGatewayService } from './mfs-gateway.service';
import { MfsPaymentGateway } from './mfs-payment.gateway';
import { MfsSmsFormatService } from './mfs-sms-format.service';
import { MfsVerificationService } from './mfs-verification.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MfsGateway.name, schema: MfsGatewaySchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: SmsLog.name, schema: SmsLogSchema },
      { name: PaymentIntent.name, schema: PaymentIntentSchema },
      { name: MfsSmsFormatSettings.name, schema: MfsSmsFormatSettingsSchema },
    ]),
    forwardRef(() => PaymentsModule),
    OrdersModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [MfsPaymentController, MfsAdminController, MfsAppCompatController],
  providers: [
    MfsGatewayService,
    MfsVerificationService,
    MfsSmsFormatService,
    MfsPaymentGateway,
    UploadsService,
  ],
  exports: [MfsGatewayService, MfsVerificationService, MfsPaymentGateway, MfsSmsFormatService],
})
export class MfsModule {}
