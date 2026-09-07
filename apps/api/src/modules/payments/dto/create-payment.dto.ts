import { Type } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentGateway, PaymentPurpose } from '../../../common/enums';

export class CreatePaymentDto {
  @IsEnum(PaymentGateway)
  gateway!: PaymentGateway;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  @IsEnum(PaymentPurpose)
  purpose!: PaymentPurpose;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  /** Required when {@link purpose} is `order`. */
  @IsOptional()
  @IsMongoId()
  orderId?: string;

  /** Dedupes retried create requests from a flaky client. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
