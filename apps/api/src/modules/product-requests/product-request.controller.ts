import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { ReplyProductRequestDto } from './dto/reply-product-request.dto';
import { ProductRequestService } from './product-request.service';

@Controller('product-requests')
export class ProductRequestController {
  constructor(private readonly requests: ProductRequestService) {}

  /** Logged-in customers submit a new product request. */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductRequestDto,
  ) {
    return this.requests.create(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin')
  list(@Query() pagination: PaginationDto) {
    return this.requests.listForAdmin(pagination);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Post(':id/reply')
  reply(@Param('id') id: string, @Body() dto: ReplyProductRequestDto) {
    return this.requests.reply(id, dto.message);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.requests.remove(id);
  }
}
