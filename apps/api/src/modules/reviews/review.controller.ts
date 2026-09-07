import {

  Body,

  Controller,

  Delete,

  Get,

  Param,

  Patch,

  Post,

  Query,

  UseGuards,

} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { Roles } from '../../common/decorators/roles.decorator';

import { Public } from '../../common/decorators/public.decorator';

import { Role } from '../../common/enums';

import { RolesGuard } from '../../common/guards/roles.guard';

import type { AuthenticatedUser } from '../auth/auth.types';

import { PaginationDto } from '../../common/dto/pagination.dto';
import { QueryPublicReviewsDto } from './dto/query-public-reviews.dto';

import { CreateReviewDto } from './dto/create-review.dto';

import { QueryReviewDto } from './dto/query-review.dto';

import { UpdateReviewDto } from './dto/update-review.dto';

import { ReviewService } from './review.service';



@Controller('reviews')

export class ReviewController {

  constructor(private readonly reviews: ReviewService) {}

  @Public()
  @Get('filters')
  filters() {
    return this.reviews.getPublicFilters();
  }

  @Public()
  @Get()
  listPublished(@Query() query: QueryPublicReviewsDto) {
    const limit = Math.min(query.limit ?? 12, 50);
    return this.reviews.listPublished(
      query.page ?? 1,
      limit,
      query.q?.trim(),
      query.productId,
      query.categoryId,
    );
  }

  @Public()
  @Get('product/:productId')
  listByProduct(
    @Param('productId') productId: string,
    @Query() query: PaginationDto,
  ) {

    const limit = Math.min(query.limit ?? 10, 50);

    return this.reviews.listPublishedByProduct(
      productId,
      query.page ?? 1,
      limit,
    );

  }



  @Get('product/:productId/eligibility')

  eligibility(

    @CurrentUser() user: AuthenticatedUser,

    @Param('productId') productId: string,

  ) {

    return this.reviews.getEligibility(user, productId);

  }



  @Post()

  create(

    @CurrentUser() user: AuthenticatedUser,

    @Body() dto: CreateReviewDto,

  ) {

    return this.reviews.create(user, dto);

  }



  @UseGuards(RolesGuard)

  @Roles(Role.Admin)

  @Get('admin/list')

  adminList(@Query() query: QueryReviewDto) {

    return this.reviews.adminList(query);

  }



  @UseGuards(RolesGuard)

  @Roles(Role.Admin)

  @Patch('admin/:id')

  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {

    return this.reviews.update(id, dto);

  }



  @UseGuards(RolesGuard)

  @Roles(Role.Admin)

  @Delete('admin/:id')

  remove(@Param('id') id: string) {

    return this.reviews.remove(id);

  }

}

