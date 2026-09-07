import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateTelegramSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  botToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chatId?: string;

  @IsOptional()
  @IsBoolean()
  notifyOnOrderPlaced?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnCustomerChat?: boolean;
}
