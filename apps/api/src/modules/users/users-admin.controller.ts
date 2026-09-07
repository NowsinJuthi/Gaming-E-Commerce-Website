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
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminCustomerEmailDto } from './dto/admin-customer-email.dto';
import { AdminCustomerNoteDto } from './dto/admin-customer-note.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminBulkDeleteUsersDto } from './dto/admin-bulk-delete-users.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UsersService } from './users.service';

@UseGuards(RolesGuard)
@Roles(Role.Admin)
@Controller('users/admin')
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  @Get('overview')
  overview() {
    return this.users.adminOverview();
  }

  @Get()
  list(@Query() query: QueryAdminUsersDto) {
    return this.users.adminList(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.users.adminGet(id);
  }

  @Post()
  create(@Body() dto: AdminCreateUserDto) {
    return this.users.adminCreate(dto);
  }

  @Post('bulk-delete')
  bulkDelete(
    @Body() dto: AdminBulkDeleteUsersDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.users.adminBulkDelete(dto.ids, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.users.adminUpdate(id, dto);
  }

  @Post(':id/note')
  saveNote(@Param('id') id: string, @Body() dto: AdminCustomerNoteDto) {
    return this.users.adminSaveNote(id, dto);
  }

  @Post(':id/email')
  sendEmail(@Param('id') id: string, @Body() dto: AdminCustomerEmailDto) {
    return this.users.adminSendEmail(id, dto);
  }

  @Post(':id/password')
  resetPassword(@Param('id') id: string, @Body() dto: AdminResetPasswordDto) {
    return this.users.adminResetPassword(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.users.adminDelete(id, admin.id);
  }
}
