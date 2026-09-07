import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AffiliateCommission,
  AffiliateCommissionSchema,
} from '../../database/schemas/affiliate-commission.schema';
import {
  AffiliateClick,
  AffiliateClickSchema,
} from '../../database/schemas/affiliate-click.schema';
import {
  AffiliateReferral,
  AffiliateReferralSchema,
} from '../../database/schemas/affiliate-referral.schema';
import {
  Affiliate,
  AffiliateSchema,
} from '../../database/schemas/affiliate.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Affiliate.name, schema: AffiliateSchema },
      { name: AffiliateReferral.name, schema: AffiliateReferralSchema },
      { name: AffiliateClick.name, schema: AffiliateClickSchema },
      { name: AffiliateCommission.name, schema: AffiliateCommissionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    WalletModule,
    NotificationsModule,
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
