import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaymentGateway } from '../../../common/enums';

class PaymentGatewaySettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sandbox?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  apiSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsEnum(PaymentGateway)
  defaultGateway?: PaymentGateway;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentGatewaySettingsDto)
  bkash?: PaymentGatewaySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentGatewaySettingsDto)
  nagad?: PaymentGatewaySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentGatewaySettingsDto)
  rocket?: PaymentGatewaySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentGatewaySettingsDto)
  upay?: PaymentGatewaySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentGatewaySettingsDto)
  uddoktapay?: PaymentGatewaySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentGatewaySettingsDto)
  mfs?: PaymentGatewaySettingsDto;
}
