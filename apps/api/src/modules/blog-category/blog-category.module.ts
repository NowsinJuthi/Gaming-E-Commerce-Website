import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Blog, BlogSchema } from '../../database/schemas/blog.schema';
import {
  BlogCategory,
  BlogCategorySchema,
} from '../../database/schemas/blog-category.schema';
import {
  BlogCategoryAdminController,
  BlogCategoryController,
} from './blog-category.controller';
import { BlogCategoryService } from './blog-category.service';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlogCategory.name, schema: BlogCategorySchema },
      { name: Blog.name, schema: BlogSchema },
    ]),
    RolePermissionsModule,
  ],
  controllers: [BlogCategoryController, BlogCategoryAdminController],
  providers: [BlogCategoryService],
  exports: [BlogCategoryService],
})
export class BlogCategoryModule {}
