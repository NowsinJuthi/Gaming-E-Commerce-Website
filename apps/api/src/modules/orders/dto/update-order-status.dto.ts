import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OrderStatus } from '../../../common/enums';
import { EmailSenderChannel } from '../../../integrations/mail/email-settings.service';
import { ManualGiftCardDto } from './manual-gift-card.dto';

const EMAIL_SENDER_CHANNELS: EmailSenderChannel[] = [
  'default',
  'orders',
  'support',
  'system',
  'admin',
];

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  deliveryMessage?: string;

  @IsOptional()
  @IsIn(EMAIL_SENDER_CHANNELS)
  emailChannel?: EmailSenderChannel;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualGiftCardDto)
  giftCards?: ManualGiftCardDto[];
}
