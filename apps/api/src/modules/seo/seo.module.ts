import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Blog, BlogSchema } from '../../database/schemas/blog.schema';
import {
  BlogCategory,
  BlogCategorySchema,
} from '../../database/schemas/blog-category.schema';
import { Brand, BrandSchema } from '../../database/schemas/brand.schema';
import {
  Category,
  CategorySchema,
} from '../../database/schemas/category.schema';
import { Product, ProductSchema } from '../../database/schemas/product.schema';
import {
  SeoSettings,
  SeoSettingsSchema,
} from '../../database/schemas/seo-settings.schema';
import { SeoAdminController } from './seo-admin.controller';
import { SeoAnalyzerService } from './seo-analyzer.service';
import { SeoPublicController } from './seo-public.controller';
import { SeoSettingsService } from './seo-settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SeoSettings.name, schema: SeoSettingsSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Brand.name, schema: BrandSchema },
      { name: Blog.name, schema: BlogSchema },
      { name: BlogCategory.name, schema: BlogCategorySchema },
    ]),
  ],
  controllers: [SeoAdminController, SeoPublicController],
  providers: [SeoSettingsService, SeoAnalyzerService],
  exports: [SeoSettingsService],
})
export class SeoModule {}
