import {
  BadRequestException,
  Body,
  Controller,
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
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { CatalogKind } from '../../database/schemas/catalog-title.schema';
import { catalogPosterUploadMulterOptions } from '../../shared/uploads/catalog-poster-upload.multer';
import { CatalogBulkAction, CatalogService } from './catalog.service';

class BulkBody {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['publish', 'unpublish', 'delete', 'feature', 'trending'])
  action!: CatalogBulkAction;
}

class UpdateBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1888)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn(['available', 'unavailable'])
  availability?: 'available' | 'unavailable';

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @IsString()
  posterUrl?: string | null;

  @IsOptional()
  @IsString()
  videoFileName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seasonCount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  overview?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  runtimeMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];
}

class TmdbApplyBody {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tmdbId!: number;

  @IsOptional()
  @IsBoolean()
  updateArtwork?: boolean;
}

@Controller()
@UseGuards(RolesGuard)
@Roles(Role.Administrator, Role.Admin)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Roles()
  @Get('media/home')
  home() {
    return this.catalog.publicHome();
  }

  @Public()
  @Roles()
  @Get('media/titles/:id')
  title(@Param('id') id: string) {
    return this.catalog.publicTitle(id);
  }

  @Get('admin/movie-collections')
  listMovies(@Query('q') q?: string, @Query('page') page?: string) {
    return this.catalog.list('movie', q, Number(page));
  }

  @Post('admin/movie-collections/bulk')
  bulkMovies(@Body() body: BulkBody) {
    return this.catalog.bulk('movie', body.ids, body.action);
  }

  @Patch('admin/movie-collections/:id')
  updateMovie(@Param('id') id: string, @Body() body: UpdateBody) {
    return this.catalog.update('movie', id, body);
  }

  @Get('admin/movie-collections/:id')
  getMovie(@Param('id') id: string) {
    return this.catalog.adminOne('movie', id);
  }

  @Post('admin/movie-collections/:id/tmdb')
  applyTmdbMovie(@Param('id') id: string, @Body() body: TmdbApplyBody) {
    return this.catalog.applyFromTmdb('movie', id, body.tmdbId, body.updateArtwork !== false);
  }

  @Post('admin/movie-collections/:id/poster')
  @UseInterceptors(FileInterceptor('file', catalogPosterUploadMulterOptions))
  uploadMoviePoster(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a poster image to upload.');
    return this.catalog.uploadPoster('movie', id, file.buffer);
  }

  @Get('admin/series-collections')
  listSeries(@Query('q') q?: string, @Query('page') page?: string) {
    return this.catalog.list('series' satisfies CatalogKind, q, Number(page));
  }

  @Post('admin/series-collections/bulk')
  bulkSeries(@Body() body: BulkBody) {
    return this.catalog.bulk('series', body.ids, body.action);
  }

  @Patch('admin/series-collections/:id')
  updateSeries(@Param('id') id: string, @Body() body: UpdateBody) {
    return this.catalog.update('series', id, body);
  }

  @Get('admin/series-collections/:id')
  getSeries(@Param('id') id: string) {
    return this.catalog.adminOne('series', id);
  }

  @Post('admin/series-collections/:id/tmdb')
  applyTmdbSeries(@Param('id') id: string, @Body() body: TmdbApplyBody) {
    return this.catalog.applyFromTmdb('series', id, body.tmdbId, body.updateArtwork !== false);
  }

  @Post('admin/series-collections/:id/poster')
  @UseInterceptors(FileInterceptor('file', catalogPosterUploadMulterOptions))
  uploadSeriesPoster(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a poster image to upload.');
    return this.catalog.uploadPoster('series', id, file.buffer);
  }
}
