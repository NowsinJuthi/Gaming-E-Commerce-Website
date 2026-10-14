import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MEDIA_LIBRARY_KINDS, type MediaLibraryKind } from '../../database/schemas/media-library.schema';
import { smbVideoUploadMulterOptions } from '../../shared/uploads/smb-video-upload.multer';
import { LibraryIndexService } from './library-index.service';
import { MediaOpsService } from './media-ops.service';

class LibraryBody {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(MEDIA_LIBRARY_KINDS)
  kind!: MediaLibraryKind;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  rootPath!: string;
}

class LibraryPatchBody {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(MEDIA_LIBRARY_KINDS)
  kind?: MediaLibraryKind;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rootPath?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class SmbBody {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  domain?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  share!: string;
}

class PasswordBody {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

class SmbPatchBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  domain?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  share?: string;
}

class AddShareLibraryBody {
  @IsString()
  serverId!: string;

  @IsString()
  path!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(MEDIA_LIBRARY_KINDS)
  kind!: MediaLibraryKind;
}

@Controller()
@UseGuards(RolesGuard)
@Roles(Role.Administrator, Role.Admin)
export class MediaOpsController {
  constructor(
    private readonly media: MediaOpsService,
    private readonly index: LibraryIndexService,
  ) {}

  @Get('admin/libraries')
  listLibraries() {
    return this.media.listLibraries();
  }

  @Get('admin/movie-server/dashboard')
  movieServerDashboard() {
    return this.media.movieServerDashboard();
  }

  @Post('admin/libraries')
  createLibrary(@Body() body: LibraryBody) {
    return this.media.createLibrary(body);
  }

  @Post('admin/libraries/:id/index')
  indexLibrary(@Param('id') id: string) {
    return this.index.syncLibrary(id);
  }

  @Get('admin/libraries/:id/items')
  libraryItems(@Param('id') id: string) {
    return this.index.libraryItems(id);
  }

  @Patch('admin/libraries/:id')
  updateLibrary(@Param('id') id: string, @Body() body: LibraryPatchBody) {
    return this.media.updateLibrary(id, body);
  }

  @Delete('admin/libraries/:id')
  removeLibrary(@Param('id') id: string) {
    return this.media.removeLibrary(id);
  }

  @Get('admin/media-shares')
  listServers() {
    return this.media.listServers();
  }

  @Post('admin/media-shares')
  createServer(@Body() body: SmbBody) {
    return this.media.createServer(body);
  }

  @Post('admin/media-shares/libraries')
  addShareLibrary(@Body() body: AddShareLibraryBody) {
    return this.media.addLibraryFromShare(body);
  }

  @Post('admin/media-shares/:id/credentials')
  savePassword(@Param('id') id: string, @Body() body: PasswordBody) {
    return this.media.savePassword(id, body.password);
  }

  @Patch('admin/media-shares/:id')
  patchServer(@Param('id') id: string, @Body() body: SmbPatchBody) {
    return this.media.updateServer(id, body);
  }

  @Delete('admin/media-shares/:id')
  removeServer(@Param('id') id: string) {
    return this.media.removeServer(id);
  }

  @Post('admin/media-shares/:id/test')
  testServer(@Param('id') id: string) {
    return this.media.testServer(id);
  }

  @Get('admin/media-shares/:id/browse')
  browse(@Param('id') id: string, @Query('path') path?: string) {
    return this.media.browse(id, path ?? '');
  }

  @Post('admin/media-shares/:id/upload')
  @UseInterceptors(FilesInterceptor('files', 50, smbVideoUploadMulterOptions))
  async uploadToShare(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const body = req.body as { path?: string; kind?: string };
    const path = typeof body.path === 'string' ? body.path : '';
    const libKind: MediaLibraryKind = body.kind === 'tv' ? 'tv' : 'movies';
    const batch = files ?? [];
    if (!batch.length) {
      throw new BadRequestException('Choose at least one video file or folder.');
    }
    const result = await this.media.uploadToShare(id, path, batch, libKind);
    void this.index.syncLibrary(result.library.id).catch(() => undefined);
    return {
      uploaded: result.uploaded,
      library: result.library,
      indexed: 0,
      matched: 0,
      unmatched: 0,
      removed: 0,
      logs: [
        `Uploaded ${result.uploaded} file(s) to Samba.`,
        'Library scan and TMDB matching run in the background (about 1–2 minutes).',
      ],
    };
  }
}
