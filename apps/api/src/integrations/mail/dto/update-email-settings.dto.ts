import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SmtpProviderPreset } from '../../../database/schemas/email-settings.schema';

const SMTP_PROVIDERS: SmtpProviderPreset[] = [
  'custom',
  'gmail',
  'sendgrid',
  'mailgun',
  'ses',
  'outlook',
];

export class UpdateEmailSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  mockMode?: boolean;

  @IsOptional()
  @IsBoolean()
  orderCustomerEmailsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  adminOrderAlertEmailsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fromName?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.fromEmail)
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ordersFromName?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.ordersFromEmail)
  @IsEmail()
  ordersFromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ordersSmtpUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ordersSmtpPass?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.ordersReplyTo)
  @IsEmail()
  ordersReplyTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supportFromName?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.supportFromEmail)
  @IsEmail()
  supportFromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supportSmtpUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  supportSmtpPass?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.supportReplyTo)
  @IsEmail()
  supportReplyTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  systemFromName?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.systemFromEmail)
  @IsEmail()
  systemFromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  systemSmtpUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  systemSmtpPass?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.systemReplyTo)
  @IsEmail()
  systemReplyTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  adminFromName?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.adminFromEmail)
  @IsEmail()
  adminFromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adminSmtpUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminSmtpPass?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.adminReplyTo)
  @IsEmail()
  adminReplyTo?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => !!o.replyTo)
  @IsEmail()
  replyTo?: string;

  @IsOptional()
  @IsIn(SMTP_PROVIDERS)
  smtpProvider?: SmtpProviderPreset;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUser?: string;

  /** Leave blank to keep the saved password. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  smtpPass?: string;

  @IsOptional()
  @IsIn(['light', 'dark', 'system', 'custom'])
  emailLogoSource?: 'light' | 'dark' | 'system' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  footerText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;
}
