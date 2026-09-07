import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsMongoId,
} from 'class-validator';
import { SmsLogStatus } from '../../../database/schemas/sms-log.schema';

export class BulkUpdateSmsLogsStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids!: string[];

  @IsEnum(SmsLogStatus)
  status!: SmsLogStatus;
}
