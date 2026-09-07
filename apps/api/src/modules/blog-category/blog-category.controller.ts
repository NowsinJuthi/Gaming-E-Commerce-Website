import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BlogCategoryService } from './blog-category.service';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';

@Controller('blog-categories')
export class BlogCategoryController {
  constructor(private readonly categories: BlogCategoryService) {}

  @Public()
  @Get()
  list() {
    return this.categories.listPublic();
  }

  @Public()
  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }
}

@Controller('admin/blog-categories')
export class BlogCategoryAdminController {
  constructor(private readonly categories: BlogCategoryService) {}

  @UseGuards(PermissionsGuard)
  @Permissions('view_blog_posts')
  @Get()
  list() {
    return this.categories.listAdmin();
  }

  @UseGuards(PermissionsGuard)
  @Permissions('view_blog_posts')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.categories.getForAdmin(id);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('manage_blog_categories')
  @Post()
  create(@Body() dto: CreateBlogCategoryDto) {
    return this.categories.create(dto);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('manage_blog_categories')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBlogCategoryDto) {
    return this.categories.update(id, dto);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('manage_blog_categories')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }}
