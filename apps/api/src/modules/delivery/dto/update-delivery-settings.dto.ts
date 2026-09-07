import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CustomOrderFieldDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  messages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  regions?: string[];
}

export class SavedDeliveryNoteDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}

export class UpdateDeliverySettingsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomOrderFieldDto)
  customOrderFields?: CustomOrderFieldDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavedDeliveryNoteDto)
  savedDeliveryNotes?: SavedDeliveryNoteDto[];
}
