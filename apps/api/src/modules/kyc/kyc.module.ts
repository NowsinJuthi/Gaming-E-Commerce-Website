import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  KycDocument,
  KycDocumentSchema,
} from '../../database/schemas/kyc-document.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { KycAdminController } from './kyc-admin.controller';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycDocument.name, schema: KycDocumentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UsersModule,
  ],
  controllers: [KycController, KycAdminController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
