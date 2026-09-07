import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AVATAR_UPLOAD_MAX_BYTES } from '../../shared/uploads/avatar-upload.constants';
import {
  avatarUploadMulterOptions,
  validateAvatarUploadFile,
} from '../../shared/uploads/avatar-upload.multer';
import { processAvatarUpload } from '../../shared/uploads/avatar-image.processor';
import { UploadsService } from '../../shared/uploads/uploads.service';
import { DevicesService } from './devices.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly devices: DevicesService,
    private readonly uploads: UploadsService,
  ) {}

  @Get('me')
  getProfile(@CurrentUser('id') userId: string) {
    return this.users.getProfile(userId);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  @Post('me/avatar-upload')
  @UseInterceptors(FileInterceptor('file', avatarUploadMulterOptions))
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: AVATAR_UPLOAD_MAX_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    validateAvatarUploadFile(file);
    const filename = await processAvatarUpload(file);
    const url = this.uploads.buildAvatarPublicUrl(filename);
    return this.users.setAvatarUrl(userId, url);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  removeAvatar(@CurrentUser('id') userId: string) {
    return this.users.clearAvatar(userId);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.users.changePassword(userId, dto);
  }

  @Get('me/devices')
  listDevices(@CurrentUser('id') userId: string) {
    return this.devices.listForUser(userId);
  }

  @Delete('me/devices/:id')
  revokeDevice(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) sessionId: Types.ObjectId,
  ) {
    return this.devices.revoke(userId, sessionId);
  }

  @Delete('me/devices')
  revokeAllDevices(@CurrentUser('id') userId: string) {
    return this.devices.revokeAll(userId);
  }
}
