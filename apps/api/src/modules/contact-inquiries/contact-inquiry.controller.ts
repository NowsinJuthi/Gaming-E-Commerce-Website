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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { ContactInquiryStatus } from '../../database/schemas/contact-inquiry.schema';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReplyContactInquiryDto } from './dto/reply-contact-inquiry.dto';
import { ContactInquiryService } from './contact-inquiry.service';

@Controller('contact-inquiries')
export class ContactInquiryController {
  constructor(private readonly inquiries: ContactInquiryService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin/overview')
  overview() {
    return this.inquiries.countNew().then((newCount) => ({ newCount }));
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin')
  list(
    @Query() pagination: PaginationDto,
    @Query('status') status?: ContactInquiryStatus,
  ) {
    return this.inquiries.listForAdmin(pagination, status);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin/:id')
  get(@Param('id') id: string) {
    return this.inquiries.getForAdmin(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Post('admin/:id/reply')
  reply(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReplyContactInquiryDto,
  ) {
    return this.inquiries.reply(id, dto.message, admin);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Patch('admin/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ContactInquiryStatus },
  ) {
    return this.inquiries.updateStatus(id, body.status);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Delete('admin/:id')
  remove(@Param('id') id: string) {
    return this.inquiries.remove(id);
  }
}
