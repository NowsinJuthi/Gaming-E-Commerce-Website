import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AuthSession,
  AuthSessionSchema,
} from '../../database/schemas/auth-session.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { Wallet, WalletSchema } from '../../database/schemas/wallet.schema';
import { MailModule } from '../../integrations/mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { DevicesService } from './devices.service';
import { UsersAdminController } from './users-admin.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Wallet.name, schema: WalletSchema },
    ]),
    MailModule,
    forwardRef(() => NotificationsModule),
    RolePermissionsModule,
  ],
  controllers: [UsersController, UsersAdminController],
  providers: [UsersService, DevicesService, UploadsService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
