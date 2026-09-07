import {

  Body,

  Controller,

  Delete,

  Get,

  Param,

  Patch,

  Post,

  Query,

  UploadedFile,

  UseGuards,

  UseInterceptors,

} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import {

  MaxFileSizeValidator,

  ParseFilePipe,

} from '@nestjs/common/pipes';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { Public } from '../../common/decorators/public.decorator';

import { Permissions } from '../../common/decorators/permissions.decorator';

import { PermissionsGuard } from '../../common/guards/permissions.guard';

import { BLOG_IMAGE_UPLOAD_MAX_BYTES } from '../../shared/uploads/blog-image-upload.constants';

import {

  blogImageUploadMulterOptions,

  validateBlogImageUploadFile,

} from '../../shared/uploads/blog-image-upload.multer';

import { processBlogImageUpload } from '../../shared/uploads/blog-image.processor';

import { UploadsService } from '../../shared/uploads/uploads.service';

import type { AuthenticatedUser } from '../auth/auth.types';

import { BlogService } from './blog.service';

import { BlogSettingsService } from './blog-settings.service';

import { BlogEngagementService } from './blog-engagement.service';

import { CreateBlogDto } from './dto/create-blog.dto';

import { QueryBlogDto, QueryPublicBlogDto } from './dto/query-blog.dto';

import { UpdateBlogDto } from './dto/update-blog.dto';

import { RejectBlogDto } from './dto/reject-blog.dto';

import { CreateBlogReviewDto } from './dto/create-blog-review.dto';

import { SetBlogReactionDto } from './dto/set-blog-reaction.dto';

import { UpdateBlogSettingsDto } from './dto/update-blog-settings.dto';

import { PaginationDto } from '../../common/dto/pagination.dto';



@Controller('blogs')

export class BlogController {

  constructor(
    private readonly blogs: BlogService,
    private readonly engagement: BlogEngagementService,
    private readonly blogSettings: BlogSettingsService,
  ) {}



  @Public()

  @Get()

  list(@Query() query: QueryPublicBlogDto) {

    return this.blogs.listPublished(query);

  }



  @Public()

  @Get('page-settings')

  pageSettings() {

    return this.blogSettings.getSettings().then((doc) =>

      this.blogSettings.serializePublic(doc),

    );

  }



  @Public()

  @Get(':slug/reviews')

  listReviews(@Param('slug') slug: string, @Query() query: PaginationDto) {

    const limit = Math.min(query.limit ?? 10, 50);

    return this.engagement.listPublishedReviews(slug, query.page ?? 1, limit);

  }



  @Get(':slug/reviews/eligibility')

  reviewEligibility(

    @CurrentUser() user: AuthenticatedUser,

    @Param('slug') slug: string,

  ) {

    return this.engagement.getReviewEligibility(user, slug);

  }



  @Post(':slug/reviews')

  createReview(

    @CurrentUser() user: AuthenticatedUser,

    @Param('slug') slug: string,

    @Body() dto: CreateBlogReviewDto,

  ) {

    return this.engagement.createReview(user, slug, dto);

  }



  @Public()

  @Get(':slug/reactions')

  reactions(@Param('slug') slug: string) {

    return this.engagement.getReactions(slug);

  }



  @Get(':slug/reactions/me')

  myReaction(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {

    return this.engagement.getUserReaction(user, slug);

  }



  @Post(':slug/reactions')

  setReaction(

    @CurrentUser() user: AuthenticatedUser,

    @Param('slug') slug: string,

    @Body() dto: SetBlogReactionDto,

  ) {

    return this.engagement.setReaction(user, slug, dto.type);

  }



  @Public()

  @Get(':slug')

  bySlug(@Param('slug') slug: string) {

    return this.blogs.findPublishedBySlug(slug);

  }

}



@Controller('admin/blogs')

export class BlogAdminController {

  constructor(

    private readonly blogs: BlogService,

    private readonly uploads: UploadsService,

    private readonly blogSettings: BlogSettingsService,

  ) {}



  @UseGuards(PermissionsGuard)

  @Permissions('create_edit_blog_posts')

  @Post('image-upload')

  @UseInterceptors(FileInterceptor('file', blogImageUploadMulterOptions))

  async uploadImage(

    @UploadedFile(

      new ParseFilePipe({

        fileIsRequired: true,

        validators: [

          new MaxFileSizeValidator({ maxSize: BLOG_IMAGE_UPLOAD_MAX_BYTES }),

        ],

        errorHttpStatusCode: 400,

      }),

    )

    file: Express.Multer.File,

  ) {

    validateBlogImageUploadFile(file);

    try {

      const processed = await processBlogImageUpload(file);

      const url = this.uploads.buildBlogImagePublicUrl(processed.filename);

      return {
        url,
        filename: processed.filename,
        format: processed.format,
        sizeBytes: processed.sizeBytes,
        width: processed.width,
        height: processed.height,
      };

    } catch (err) {

      if (file.path) {

        try {

          const { unlinkSync } = await import('fs');

          unlinkSync(file.path);

        } catch {

          /* ignore */

        }

      }

      throw err;

    }

  }



  @UseGuards(PermissionsGuard)

  @Permissions('view_blog_overview')

  @Get('settings')

  getSettings() {

    return this.blogSettings.getSettings().then((doc) =>

      this.blogSettings.serializePublic(doc),

    );

  }



  @UseGuards(PermissionsGuard)

  @Permissions('publish_blog_posts')

  @Patch('settings')

  updateSettings(@Body() dto: UpdateBlogSettingsDto) {

    return this.blogSettings.updateSettings(dto).then((doc) =>

      this.blogSettings.serializePublic(doc),

    );

  }



  @UseGuards(PermissionsGuard)

  @Permissions('create_edit_blog_posts')

  @Post()

  create(

    @CurrentUser() admin: AuthenticatedUser,

    @Body() dto: CreateBlogDto,

  ) {

    return this.blogs.create(admin, dto);

  }



  @UseGuards(PermissionsGuard)

  @Permissions('view_blog_posts')

  @Get()

  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryBlogDto) {

    return this.blogs.listForAdmin(query, user);

  }



  @UseGuards(PermissionsGuard)

  @Permissions('view_blog_overview')

  @Get('overview')

  overview() {

    return this.blogs.getAdminOverview();

  }



  @UseGuards(PermissionsGuard)

  @Permissions('view_blog_posts')

  @Get(':id')

  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {

    return this.blogs.getForAdmin(id, user);

  }



  @UseGuards(PermissionsGuard)

  @Permissions('create_edit_blog_posts')

  @Patch(':id')

  update(

    @Param('id') id: string,

    @CurrentUser() admin: AuthenticatedUser,

    @Body() dto: UpdateBlogDto,

  ) {

    return this.blogs.update(id, dto, admin);

  }



  @UseGuards(PermissionsGuard)

  @Permissions('publish_blog_posts')

  @Post(':id/approve')

  approve(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {

    return this.blogs.approve(id, admin);

  }



  @UseGuards(PermissionsGuard)

  @Permissions('publish_blog_posts')

  @Post(':id/reject')

  reject(

    @Param('id') id: string,

    @CurrentUser() admin: AuthenticatedUser,

    @Body() dto: RejectBlogDto,

  ) {

    return this.blogs.reject(id, admin, dto.rejectionReason);

  }



  @UseGuards(PermissionsGuard)

  @Permissions('delete_blog_posts')

  @Delete(':id')

  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {

    return this.blogs.remove(id, user);

  }

}


