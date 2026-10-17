import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { UsersModule } from '../users/users.module';
import { AdminMediaPlansController } from './admin-media-plans.controller';
import { AdminMediaSubscriptionsController } from './admin-media-subscriptions.controller';
import { MediaPlansBootstrap } from './media-plans.bootstrap';
import { MediaPlansService } from './media-plans.service';
import { MediaSubscriptionsService } from './media-subscriptions.service';
import { MediaPlan, MediaPlanSchema } from './schemas/media-plan.schema';
import {
  MediaSubscription,
  MediaSubscriptionSchema,
} from './schemas/media-subscription.schema';
import {
  MediaSubscriptionEvent,
  MediaSubscriptionEventSchema,
} from './schemas/media-subscription-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MediaPlan.name, schema: MediaPlanSchema },
      { name: MediaSubscription.name, schema: MediaSubscriptionSchema },
      { name: MediaSubscriptionEvent.name, schema: MediaSubscriptionEventSchema },
    ]),
    UsersModule,
    RolePermissionsModule,
  ],
  controllers: [AdminMediaPlansController, AdminMediaSubscriptionsController],
  providers: [MediaPlansService, MediaSubscriptionsService, MediaPlansBootstrap],
  exports: [MediaPlansService, MediaSubscriptionsService, MongooseModule],
})
export class MediaSubscriptionsModule {}
