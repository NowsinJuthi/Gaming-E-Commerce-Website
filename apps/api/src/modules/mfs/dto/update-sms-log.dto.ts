import { IsEnum } from 'class-validator';
import { SmsLogStatus } from '../../../database/schemas/sms-log.schema';

export class UpdateSmsLogStatusDto {
  @IsEnum(SmsLogStatus)
  status!: SmsLogStatus;
}
