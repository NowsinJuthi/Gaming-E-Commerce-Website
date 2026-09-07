import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LIVE_CHAT_UPLOAD_MAX_BYTES } from '../../shared/uploads/live-chat-upload.constants';
import { processLiveChatImageUpload } from '../../shared/uploads/live-chat-image.processor';
import {
  liveChatUploadMulterOptions,
  validateLiveChatUploadFile,
} from '../../shared/uploads/live-chat-upload.multer';
import { UploadsService } from '../../shared/uploads/uploads.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { RequiresLicenseFeature } from '../license/decorators/requires-license-feature.decorator';
import { LicenseFeatureGuard } from '../license/guards/license-feature.guard';
import { ChatSettingsService } from './chat-settings.service';
import { ChatService } from './chat.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { UpdateChatQuickRepliesDto } from './dto/update-chat-quick-replies.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from './presence.service';

class GuestChatSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;
}

class ListChatRoomsDto extends PaginationDto {
  /** Staff-only inbox search: customer name, email or phone number. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly chatSettings: ChatSettingsService,
    private readonly presence: PresenceService,
    private readonly uploads: UploadsService,
    private readonly auth: AuthService,
  ) {}

  private async isGuestChatAllowed(): Promise<boolean> {
    const config = await this.auth.getPanelConfig();
    return config.checkout.allowGuestChat === true;
  }

  private async isChatImageUploadAllowed(): Promise<boolean> {
    const config = await this.auth.getPanelConfig();
    return config.chat.allowImageUpload !== false;
  }

  /** Public endpoint — issues a short-lived guest JWT for anonymous chat. */
  @Public()
  @Post('guest-session')
  guestChatSession(@Body() dto: GuestChatSessionDto, @Req() req: Request) {
    const rawIp: string = req.ip ?? (req.socket as { remoteAddress?: string })?.remoteAddress ?? '';
    const ip = (rawIp.split(',')[0] ?? '').trim();
    const userAgent = req.headers['user-agent'] ?? '';
    return this.auth.guestChatSession(dto.name ?? 'Guest', { ip, userAgent });
  }

  @Get('rooms')
  async rooms(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListChatRoomsDto,
  ) {
    const allowGuestChat = await this.isGuestChatAllowed();
    this.chat.assertRegisteredChatUser(user, allowGuestChat);
    return this.chat.listRoomsForUserSerialized(user, query, query.q);
  }

  @Post('rooms/support')
  async openSupport(@CurrentUser() user: AuthenticatedUser) {
    const allowGuestChat = await this.isGuestChatAllowed();
    this.chat.assertRegisteredChatUser(user, allowGuestChat);
    return this.chat.ensureSupportRoom(user).then(async (room) => {
      const creator = await this.chat.findCreatorSummary(String(room.createdBy));
      return this.chat.serializeRoom(room, creator ?? undefined);
    });
  }

  @Get('rooms/:id/messages')
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    const allowGuestChat = await this.isGuestChatAllowed();
    this.chat.assertRegisteredChatUser(user, allowGuestChat);
    return this.chat.getHistory(user, id, pagination);
  }

  @Post('rooms/:id/messages')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateChatMessageDto,
  ) {
    const allowGuestChat = await this.isGuestChatAllowed();
    const allowImageUpload = await this.isChatImageUploadAllowed();
    const { payload, room } = await this.chat.sendRoomMessage(user, id, {
      allowGuestChat,
      allowImageUpload,
      body: dto.body,
      imageUrl: dto.imageUrl,
    });
    this.chatGateway.broadcastToRoom(room, 'message:new', payload);
    return { ok: true, id: payload.id, message: payload };
  }

  @Post('rooms/:id/image-upload')
  @UseInterceptors(FileInterceptor('file', liveChatUploadMulterOptions))
  async uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: LIVE_CHAT_UPLOAD_MAX_BYTES }),
        ],
        errorHttpStatusCode: 400,
      }),
    )
    file: Express.Multer.File,
  ) {
    const allowGuestChat = await this.isGuestChatAllowed();
    this.chat.assertRegisteredChatUser(user, allowGuestChat);
    await this.chat.getAccessibleRoom(user, id);
    if (!(await this.isChatImageUploadAllowed())) {
      throw new ForbiddenException('Picture uploads are disabled for live chat');
    }
    validateLiveChatUploadFile(file);
    try {
      const relativePath = await processLiveChatImageUpload(file, id);
      const url = this.uploads.buildLiveChatPublicUrl(relativePath);
      return { url, filename: relativePath };
    } catch (err) {
      // Clean up the temp file if Sharp processing fails.
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  @Post('rooms/:id/read')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const allowGuestChat = await this.isGuestChatAllowed();
    this.chat.assertRegisteredChatUser(user, allowGuestChat);
    return this.chat.markRead(user, id);
  }

  @Get('online')
  online() {
    return this.presence.listOnline();
  }

  @Get('support-online')
  async supportOnline(@CurrentUser() user: AuthenticatedUser) {
    const allowGuestChat = await this.isGuestChatAllowed();
    this.chat.assertRegisteredChatUser(user, allowGuestChat);
    const onlineIds = await this.presence.listOnline();
    return this.chat.listOnlineSupportStaff(onlineIds);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('admin/overview')
  adminOverview() {
    return this.chat.adminOverview();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Get('admin/quick-replies')
  listQuickReplies() {
    return this.chatSettings.getQuickReplies();
  }

  @UseGuards(RolesGuard, LicenseFeatureGuard)
  @Roles(Role.Admin)
  @Put('admin/quick-replies')
  @RequiresLicenseFeature('liveChat')
  updateQuickReplies(@Body() dto: UpdateChatQuickRepliesDto) {
    return this.chatSettings.updateQuickReplies(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Get('staff/quick-replies')
  listStaffQuickReplies() {
    return this.chatSettings.getStaffQuickReplies();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Patch('rooms/:id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.chat.updateRoomStatus(user, id, dto.status).then(async (room) => {
      const creator = room.createdBy
        ? await this.chat.findCreatorSummary(String(room.createdBy))
        : undefined;
      return this.chat.serializeRoom(room, creator ?? undefined);
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Support)
  @Delete('rooms/:id')
  deleteRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.chat.deleteRoom(user, id);
  }
}
