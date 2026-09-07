import { Type } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ManualGiftCardDto {
  @IsString()
  @MaxLength(500)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fieldLabel?: string;

  /** Links a gift card row to inventory stock (reserved on save, sold on delivery). */
  @IsOptional()
  @IsMongoId()
  inventoryItemId?: string;
}

export class SaveManualDeliveryDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualGiftCardDto)
  giftCards?: ManualGiftCardDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  deliveryMessage?: string;
}
