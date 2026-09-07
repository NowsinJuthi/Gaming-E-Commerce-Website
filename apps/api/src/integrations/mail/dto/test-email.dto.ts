import { IsEmail, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { EmailSenderChannel } from '../email-settings.service';

const TEST_CHANNELS: EmailSenderChannel[] = [
  'default',
  'orders',
  'support',
  'system',
  'admin',
];

export class TestEmailDto {
  /** Optional override recipient; defaults to the configured sender address. */
  @IsOptional()
  @ValidateIf((o: TestEmailDto) => !!o.to)
  @IsEmail()
  to?: string;

  /** Which sender profile to test (default, orders, support, system). */
  @IsOptional()
  @IsIn(TEST_CHANNELS)
  channel?: EmailSenderChannel;
}
