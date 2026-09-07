import {
  Body,
  Controller,
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
import type { AuthenticatedUser } from '../auth/auth.types';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketService } from './ticket.service';

@Controller('tickets')
export class TicketController {
  constructor(private readonly tickets: TicketService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.tickets.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryTicketsDto,
  ) {
    return this.tickets.list(user, query);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin/overview')
  adminOverview() {
    return this.tickets.adminOverview();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin/staff')
  listStaff() {
    return this.tickets.listStaff();
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.getOne(user, id);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.tickets.getMessages(user, id, pagination);
  }

  @Post(':id/reply')
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.tickets.reply(user, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.tickets.updateStatus(id, dto.status);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.tickets.assign(id, dto.adminId);
  }
}
