import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import { Blog, BlogSchema } from '../../database/schemas/blog.schema';

import {
  BlogSettings,
  BlogSettingsSchema,
} from '../../database/schemas/blog-settings.schema';

import {
  BlogReaction,
  BlogReactionSchema,
} from '../../database/schemas/blog-reaction.schema';

import {
  BlogReview,
  BlogReviewSchema,
} from '../../database/schemas/blog-review.schema';

import { User, UserSchema } from '../../database/schemas/user.schema';

import { UploadsService } from '../../shared/uploads/uploads.service';

import { BlogCategoryModule } from '../blog-category/blog-category.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';

import { BlogAdminController, BlogController } from './blog.controller';

import { BlogService } from './blog.service';

import { BlogSettingsService } from './blog-settings.service';

import { BlogEngagementService } from './blog-engagement.service';



@Module({

  imports: [

    MongooseModule.forFeature([
      { name: Blog.name, schema: BlogSchema },
      { name: BlogSettings.name, schema: BlogSettingsSchema },
      { name: BlogReview.name, schema: BlogReviewSchema },
      { name: BlogReaction.name, schema: BlogReactionSchema },
      { name: User.name, schema: UserSchema },
    ]),

    BlogCategoryModule,

    RolePermissionsModule,

  ],

  controllers: [BlogController, BlogAdminController],

  providers: [BlogService, BlogSettingsService, BlogEngagementService, UploadsService],

  exports: [BlogService, BlogSettingsService],

})

export class BlogModule {}


