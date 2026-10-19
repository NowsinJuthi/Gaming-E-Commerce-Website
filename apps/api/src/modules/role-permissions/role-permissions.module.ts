import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RolePermissions,
  RolePermissionsSchema,
} from '../../database/schemas/role-permissions.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { RolePermissionsAdminController } from './role-permissions-admin.controller';
import { RolePermissionsController } from './role-permissions.controller';
import { RolePermissionsService } from './role-permissions.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RedisModule } from '../../shared/cache/redis.module';
import { EventsModule } from '../../shared/events/events.module';

@Module({
  imports: [
    RedisModule,
    EventsModule,
    MongooseModule.forFeature([
      { name: RolePermissions.name, schema: RolePermissionsSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RolePermissionsAdminController, RolePermissionsController],
  providers: [RolePermissionsService, PermissionsGuard],
  exports: [RolePermissionsService, PermissionsGuard],
})
export class RolePermissionsModule {}
