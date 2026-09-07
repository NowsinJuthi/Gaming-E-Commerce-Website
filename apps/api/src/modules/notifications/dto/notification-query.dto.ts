import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationAudience } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListNotificationsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(NotificationAudience)
  audience?: NotificationAudience;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  excludeChat?: boolean;
}

export class NotificationAudienceDto {
  @IsOptional()
  @IsEnum(NotificationAudience)
  audience?: NotificationAudience;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  chatOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  excludeChat?: boolean;
}
