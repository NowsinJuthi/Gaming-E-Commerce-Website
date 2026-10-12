import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { CatalogKind } from '../../database/schemas/catalog-title.schema';
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
}

@Controller()
@UseGuards(RolesGuard)
@Roles(Role.Administrator, Role.Admin)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('admin/movie-collections')
  listMovies(@Query('q') q?: string) {
    return this.catalog.list('movie', q);
  }

  @Post('admin/movie-collections/bulk')
  bulkMovies(@Body() body: BulkBody) {
    return this.catalog.bulk('movie', body.ids, body.action);
  }

  @Patch('admin/movie-collections/:id')
  updateMovie(@Param('id') id: string, @Body() body: UpdateBody) {
    return this.catalog.update('movie', id, body);
  }

  @Get('admin/series-collections')
  listSeries(@Query('q') q?: string) {
    return this.catalog.list('series' satisfies CatalogKind, q);
  }

  @Post('admin/series-collections/bulk')
  bulkSeries(@Body() body: BulkBody) {
    return this.catalog.bulk('series', body.ids, body.action);
  }

  @Patch('admin/series-collections/:id')
  updateSeries(@Param('id') id: string, @Body() body: UpdateBody) {
    return this.catalog.update('series', id, body);
  }
}
